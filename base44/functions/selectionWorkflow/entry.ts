import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const body = await req.json();
    const action = body.action;
    const now = new Date().toISOString();
    const actor = user.full_name || user.email || "user";
    const isStaff = user.role === "admin" || user.role === "staff";

    if (action === "sign_off") {
      const sel = await base44.entities.CustomerSelection.get(body.selection_id).catch(() => null);
      if (!sel) return Response.json({ error: "Not found" }, { status: 404 });
      if (sel.locked) return Response.json({ error: "Selection is locked" }, { status: 400 });
      if (!isStaff) {
        const project = await base44.asServiceRole.entities.Project.get(sel.project_id).catch(() => null);
        const custs = project?.assigned_customers || [];
        if (!custs.includes(user.id) && !custs.includes(user.email)) {
          return Response.json({ error: "Forbidden" }, { status: 403 });
        }
      }
      await base44.entities.CustomerSelection.update(sel.id, {
        signed_off: true, signed_off_by: actor, signed_off_date: now, sign_off_note: body.note || ""
      });
      await base44.entities.AuditLog.create({
        target_type: "selection", target_id: sel.id, action: "signed_off",
        field: "signed_off", old_value: "false", new_value: "true",
        changed_by: actor, reason: body.note || "Customer sign-off"
      });
      return Response.json({ ok: true });
    }

    if (!isStaff) return Response.json({ error: "Forbidden" }, { status: 403 });

    if (action === "review") {
      const sel = await base44.entities.CustomerSelection.get(body.selection_id).catch(() => null);
      if (!sel) return Response.json({ error: "Not found" }, { status: 404 });
      const reviewAction = body.review_action;
      if (!["Approved", "Rejected", "Revision Requested"].includes(reviewAction)) {
        return Response.json({ error: "Invalid review action" }, { status: 400 });
      }
      const hasOverride = body.staff_price_override !== "" && body.staff_price_override != null;
      const finalPrice = hasOverride ? Number(body.staff_price_override) : (sel.calculated_price || 0);
      const allowance = sel.allowance_amount || 0;
      let over = finalPrice > allowance ? finalPrice - allowance : 0;
      let under = finalPrice < allowance ? allowance - finalPrice : 0;
      if (body.allowance_impact !== "" && body.allowance_impact != null) {
        const adj = Number(body.allowance_impact);
        if (adj > 0) over += adj; else under += -adj;
      }
      await base44.entities.CustomerSelection.update(sel.id, {
        status: reviewAction,
        staff_price_override: hasOverride ? Number(body.staff_price_override) : null,
        calculated_price: finalPrice,
        over_allowance: over, under_allowance: under,
        staff_comments: body.customer_comments || sel.staff_comments,
        internal_notes: body.internal_notes || sel.internal_notes,
        reviewed_date: now, reviewed_by: actor
      });
      const reqStatus = reviewAction === "Approved" ? "Approved" : reviewAction === "Rejected" ? "Rejected" : "Revision Requested";
      await base44.entities.SelectionRequirement.update(sel.requirement_id, { status: reqStatus });
      await base44.entities.AuditLog.create({
        target_type: "selection", target_id: sel.id, action: `review_${reviewAction.toLowerCase().replace(/ /g, "_")}`,
        field: "status", old_value: sel.status, new_value: reviewAction,
        changed_by: actor, reason: body.customer_comments || ""
      });
      if (reviewAction === "Approved") {
        await base44.entities.AllowanceLedger.create({
          project_id: sel.project_id, area_id: sel.area_id, requirement_id: sel.requirement_id,
          event_type: hasOverride ? "Staff Override" : "Selection Approved",
          amount: finalPrice, running_balance: over - under,
          description: `Selection approved at $${finalPrice.toLocaleString()}`,
          performed_by: actor
        });
        const existingProc = await base44.entities.ProcurementItem.filter({ selection_id: sel.id });
        if (existingProc.length === 0) {
          const catItem = await base44.asServiceRole.entities.CatalogueItem.get(sel.catalogue_item_id).catch(() => null);
          await base44.entities.ProcurementItem.create({
            project_id: sel.project_id, area_id: sel.area_id, requirement_id: sel.requirement_id,
            selection_id: sel.id, catalogue_item_id: sel.catalogue_item_id,
            item_name: catItem?.name || "", category: catItem?.category || "",
            supplier: catItem?.supplier || "", brand: catItem?.brand || "",
            sku: catItem?.sku || "", quantity: 1,
            unit_of_measure: catItem?.unit_of_measure || "",
            status: "Not Ready to Order"
          });
        }
      }
      return Response.json({ ok: true });
    }

    if (action === "change_requirement_status") {
      const req = await base44.entities.SelectionRequirement.get(body.requirement_id).catch(() => null);
      if (!req) return Response.json({ error: "Not found" }, { status: 404 });
      const oldStatus = req.status;
      await base44.entities.SelectionRequirement.update(req.id, { status: body.new_status });
      await base44.entities.AuditLog.create({
        target_type: "requirement", target_id: req.id, action: `status_changed`,
        field: "status", old_value: oldStatus, new_value: body.new_status,
        changed_by: actor, reason: body.reason || "Staff status change"
      });
      return Response.json({ ok: true });
    }

    async function getScopedSelections() {
      if (body.selection_id) {
        const s = await base44.asServiceRole.entities.CustomerSelection.get(body.selection_id);
        return [s];
      }
      let reqs;
      if (body.area_id) reqs = await base44.asServiceRole.entities.SelectionRequirement.filter({ area_id: body.area_id }, null, 1000);
      else if (body.project_id) reqs = await base44.asServiceRole.entities.SelectionRequirement.filter({ project_id: body.project_id }, null, 1000);
      else return [];
      const reqIds = reqs.map(r => r.id);
      const sels = await base44.asServiceRole.entities.CustomerSelection.filter({ project_id: body.project_id }, null, 1000);
      return sels.filter(s => s.is_current && reqIds.includes(s.requirement_id));
    }

    if (action === "request_signoff") {
      const sels = await getScopedSelections();
      const approved = sels.filter(s => s.status === "Approved" && !s.signed_off);
      let count = 0;
      for (const s of approved) {
        await base44.entities.CustomerSelection.update(s.id, { sign_off_requested: true });
        await base44.entities.AuditLog.create({
          target_type: "selection", target_id: s.id, action: "sign_off_requested",
          field: "sign_off_requested", old_value: "false", new_value: "true",
          changed_by: actor, reason: "Sign-off requested"
        });
        count++;
      }
      if (body.project_id && count > 0) {
        const project = await base44.asServiceRole.entities.Project.get(body.project_id);
        for (const cid of (project.assigned_customers || [])) {
          await base44.entities.Notification.create({
            user_id: cid, project_id: body.project_id, type: "sign_off_request",
            title: "Sign-off requested", message: `Sign-off has been requested for ${count} selection(s) in ${project.name}.`,
            link: `/portal/project/${body.project_id}`
          });
        }
      }
      return Response.json({ ok: true, count });
    }

    if (action === "lock") {
      const sels = await getScopedSelections();
      const lockable = sels.filter(s => s.status === "Approved" && s.signed_off && !s.locked);
      let count = 0;
      for (const s of lockable) {
        await base44.entities.CustomerSelection.update(s.id, {
          locked: true, locked_date: now, locked_by: actor, locked_reason: body.reason || "Locked after sign-off"
        });
        await base44.entities.AuditLog.create({
          target_type: "selection", target_id: s.id, action: "locked",
          field: "locked", old_value: "false", new_value: "true",
          changed_by: actor, reason: body.reason || "Locked after sign-off"
        });
        count++;
      }
      return Response.json({ ok: true, count });
    }

    if (action === "unlock") {
      if (!body.reason || !body.reason.trim()) return Response.json({ error: "Reason required" }, { status: 400 });
      const s = await base44.entities.CustomerSelection.get(body.selection_id).catch(() => null);
      if (!s) return Response.json({ error: "Not found" }, { status: 404 });
      await base44.entities.CustomerSelection.update(s.id, { locked: false, unlock_reason: body.reason });
      await base44.entities.AuditLog.create({
        target_type: "selection", target_id: s.id, action: "unlocked",
        field: "locked", old_value: "true", new_value: "false",
        changed_by: actor, reason: body.reason
      });
      return Response.json({ ok: true });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});