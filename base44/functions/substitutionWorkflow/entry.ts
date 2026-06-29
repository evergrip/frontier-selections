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
    const recId = body.recommendation_id;

    async function notifyCustomers(projectId, title, message, link) {
      const project = await base44.asServiceRole.entities.Project.get(projectId);
      for (const cid of (project.assigned_customers || [])) {
        await base44.entities.Notification.create({ user_id: cid, project_id: projectId, type: "substitution", title, message, link });
      }
    }
    async function notifyStaff(projectId, title, message, link) {
      const project = await base44.asServiceRole.entities.Project.get(projectId);
      for (const sid of (project.assigned_staff || [])) {
        await base44.entities.Notification.create({ user_id: sid, project_id: projectId, type: "substitution", title, message, link });
      }
    }

    if (action === "send") {
      if (!isStaff) return Response.json({ error: "Forbidden" }, { status: 403 });
      const rec = await base44.entities.SubstitutionRecommendation.get(recId);
      await base44.entities.SubstitutionRecommendation.update(recId, { status: "Sent to customer", sent_date: now });
      await notifyCustomers(rec.project_id, "Substitution recommendation", `A substitution has been recommended for ${rec.original_item_name}.`, `/portal/project/${rec.project_id}`);
      return Response.json({ ok: true });
    }

    if (action === "accept" || action === "reject") {
      const rec = await base44.entities.SubstitutionRecommendation.get(recId);
      if (!isStaff) {
        const project = await base44.asServiceRole.entities.Project.get(rec.project_id);
        const custs = project.assigned_customers || [];
        if (!custs.includes(user.id) && !custs.includes(user.email)) return Response.json({ error: "Forbidden" }, { status: 403 });
      }
      const status = action === "accept" ? "Customer accepted" : "Customer rejected";
      await base44.entities.SubstitutionRecommendation.update(recId, { status, customer_decision_date: now, customer_note: body.note != null ? body.note : rec.customer_note });
      await notifyStaff(rec.project_id, `Substitution ${action === "accept" ? "accepted" : "rejected"}`, `Customer ${action === "accept" ? "accepted" : "rejected"} the substitution for ${rec.original_item_name}.`, `/substitution/${recId}`);
      return Response.json({ ok: true });
    }

    if (action === "approve") {
      if (!isStaff) return Response.json({ error: "Forbidden" }, { status: 403 });
      const rec = await base44.entities.SubstitutionRecommendation.get(recId);
      if (rec.status !== "Customer accepted") return Response.json({ error: "Customer must accept first" }, { status: 400 });
      const oldSel = await base44.entities.CustomerSelection.get(rec.selection_id);
      const newPrice = body.calculated_price != null ? Number(body.calculated_price) : (rec.recommended_price || 0);
      const allowance = oldSel.allowance_amount || 0;
      const over = newPrice > allowance ? newPrice - allowance : 0;
      const under = newPrice < allowance ? allowance - newPrice : 0;
      await base44.entities.CustomerSelection.update(oldSel.id, { is_current: false, status: "Superseded" });
      const newSel = await base44.entities.CustomerSelection.create({
        project_id: rec.project_id, area_id: rec.area_id, requirement_id: rec.requirement_id,
        catalogue_item_id: rec.recommended_item_id, selected_options: rec.recommended_options || [],
        calculated_price: newPrice, allowance_amount: allowance, over_allowance: over, under_allowance: under,
        status: "Approved", submitted_date: oldSel.submitted_date, reviewed_date: now, reviewed_by: actor,
        version: (oldSel.version || 1) + 1, is_current: true,
        customer_notes: rec.customer_explanation || "", internal_notes: rec.staff_note || ""
      });
      await base44.entities.SelectionRequirement.update(rec.requirement_id, { status: "Approved" });
      const procs = await base44.asServiceRole.entities.ProcurementItem.filter({ selection_id: oldSel.id });
      const recItem = await base44.asServiceRole.entities.CatalogueItem.get(rec.recommended_item_id);
      if (procs.length > 0) {
        await base44.entities.ProcurementItem.update(procs[0].id, {
          selection_id: newSel.id, catalogue_item_id: rec.recommended_item_id,
          item_name: recItem?.name || rec.recommended_item_name, supplier: recItem?.supplier || "",
          brand: recItem?.brand || "", sku: recItem?.sku || "", status: "Substitution Required"
        });
      }
      await base44.entities.SubstitutionRecommendation.update(recId, { status: "Staff approved", staff_approved_by: actor, staff_approved_date: now });
      await base44.entities.AuditLog.create({
        target_type: "selection", target_id: newSel.id, action: "substitution_applied",
        field: "catalogue_item_id", old_value: oldSel.catalogue_item_id, new_value: rec.recommended_item_id,
        changed_by: actor, reason: rec.reason || "Substitution approved"
      });
      return Response.json({ ok: true, selection_id: newSel.id });
    }

    if (action === "cancel") {
      if (!isStaff) return Response.json({ error: "Forbidden" }, { status: 403 });
      await base44.entities.SubstitutionRecommendation.update(recId, { status: "Cancelled" });
      return Response.json({ ok: true });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});