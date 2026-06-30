import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.active === false) return Response.json({ error: "Account deactivated" }, { status: 403 });

    const body = await req.json();
    const action = body.action;
    const now = new Date().toISOString();
    const actor = user.full_name || user.email || "user";
    const isStaff = user.role === "admin" || user.role === "staff";
    const recId = body.recommendation_id;

    // ==================== ACCESS VERIFICATION ====================
    async function verifyProjectAccess(projectId) {
      const project = await base44.asServiceRole.entities.Project.get(projectId).catch(() => null);
      if (!project) return { ok: false, error: "Project not found", status: 404 };
      if (isStaff) {
        const perms = user.permissions || [];
        const hasViewAll = user.role === "admin" || perms.includes("view_all_projects");
        if (!hasViewAll) {
          const assigned = project.assigned_staff || [];
          if (!assigned.includes(user.id) && !assigned.includes(user.email)) {
            return { ok: false, error: "Forbidden - project not assigned", status: 403 };
          }
        }
        return { ok: true, project, isStaff: true };
      }
      const custs = project.assigned_customers || [];
      if (!custs.includes(user.id) && !custs.includes(user.email)) {
        await base44.asServiceRole.entities.AuditLog.create({
          target_type: "project", target_id: projectId, action: "substitution_access_denied",
          action_type: "substitution_access_denied",
          description: `${user.email} denied substitution access to project ${project.name}`,
          actor_user_id: user.id, actor_name: actor, actor_role: user.role,
          project_id: projectId, severity: "high"
        }).catch(() => {});
        return { ok: false, error: "Forbidden", status: 403 };
      }
      return { ok: true, project, isStaff: false };
    }

    async function audit(targetType, targetId, auditAction, description, projectId, extra = {}) {
      await base44.asServiceRole.entities.AuditLog.create({
        target_type: targetType, target_id: targetId, action: auditAction,
        action_type: auditAction, description,
        actor_user_id: user.id, actor_name: actor, actor_role: user.role,
        project_id: projectId || null, severity: extra.severity || 'medium',
        ...extra
      }).catch(() => {});
    }

    async function notifyCustomers(projectId, title, message, link) {
      const project = await base44.asServiceRole.entities.Project.get(projectId);
      for (const cid of (project.assigned_customers || [])) {
        await base44.asServiceRole.entities.Notification.create({ user_id: cid, project_id: projectId, type: "substitution", title, message, link });
      }
    }
    async function notifyStaff(projectId, title, message, link) {
      const project = await base44.asServiceRole.entities.Project.get(projectId);
      for (const sid of (project.assigned_staff || [])) {
        await base44.asServiceRole.entities.Notification.create({ user_id: sid, project_id: projectId, type: "substitution", title, message, link });
      }
    }

    // ==================== SEND (staff-only) ====================
    if (action === "send") {
      if (!isStaff) return Response.json({ error: "Forbidden" }, { status: 403 });
      const rec = await base44.asServiceRole.entities.SubstitutionRecommendation.get(recId).catch(() => null);
      if (!rec) return Response.json({ error: "Not found" }, { status: 404 });
      const access = await verifyProjectAccess(rec.project_id);
      if (!access.ok) return Response.json({ error: access.error }, { status: access.status });
      await base44.asServiceRole.entities.SubstitutionRecommendation.update(recId, { status: "Sent to customer", sent_date: now });
      await notifyCustomers(rec.project_id, "Substitution recommendation", `A substitution has been recommended for ${rec.original_item_name}.`, `/portal/project/${rec.project_id}`);
      await audit("substitution", recId, "substitution_sent", `${actor} sent substitution recommendation for ${rec.original_item_name} to customer`, rec.project_id, { severity: 'high' });
      return Response.json({ ok: true });
    }

    // ==================== ACCEPT / REJECT (customer or staff) ====================
    if (action === "accept" || action === "reject") {
      const rec = await base44.asServiceRole.entities.SubstitutionRecommendation.get(recId).catch(() => null);
      if (!rec) return Response.json({ error: "Not found" }, { status: 404 });
      const access = await verifyProjectAccess(rec.project_id);
      if (!access.ok) return Response.json({ error: access.error }, { status: access.status });
      // Only customers (not staff) can accept/reject; staff use approve/cancel
      if (access.isStaff) return Response.json({ error: "Staff must use approve or cancel, not accept/reject" }, { status: 400 });
      const status = action === "accept" ? "Customer accepted" : "Customer rejected";
      await base44.asServiceRole.entities.SubstitutionRecommendation.update(recId, { status, customer_decision_date: now, customer_note: body.note != null ? body.note : rec.customer_note });
      await notifyStaff(rec.project_id, `Substitution ${action === "accept" ? "accepted" : "rejected"}`, `Customer ${action === "accept" ? "accepted" : "rejected"} the substitution for ${rec.original_item_name}.`, `/substitution/${recId}`);
      await audit("substitution", recId, `substitution_${action === "accept" ? "accepted" : "rejected"}`, `${actor} ${action === "accept" ? "accepted" : "rejected"} substitution for ${rec.original_item_name}`, rec.project_id, { severity: 'high', customer_note: body.note });
      return Response.json({ ok: true });
    }

    // ==================== APPROVE (staff-only) ====================
    if (action === "approve") {
      if (!isStaff) return Response.json({ error: "Forbidden" }, { status: 403 });
      const rec = await base44.asServiceRole.entities.SubstitutionRecommendation.get(recId).catch(() => null);
      if (!rec) return Response.json({ error: "Not found" }, { status: 404 });
      const access = await verifyProjectAccess(rec.project_id);
      if (!access.ok) return Response.json({ error: access.error }, { status: access.status });
      if (rec.status !== "Customer accepted") return Response.json({ error: "Customer must accept first" }, { status: 400 });
      const oldSel = await base44.asServiceRole.entities.CustomerSelection.get(rec.selection_id).catch(() => null);
      if (!oldSel) return Response.json({ error: "Original selection not found" }, { status: 404 });

      // SERVER-SIDE price calculation — ignore any client-supplied calculated_price
      const catItem = await base44.asServiceRole.entities.CatalogueItem.get(rec.recommended_item_id).catch(() => null);
      if (!catItem) return Response.json({ error: "Recommended catalogue item not found" }, { status: 404 });

      // Fetch option values for the recommended item to get server-confirmed price modifiers
      const optionValues = await base44.asServiceRole.entities.CatalogueOptionValue.filter(
        { catalogue_item_id: rec.recommended_item_id, is_active: true }, null, 500
      );

      // Calculate price from server-fetched base_price + server-confirmed option modifiers
      let calculatedPrice = catItem.base_price || 0;
      for (const sel of (rec.recommended_options || [])) {
        const opt = optionValues.find(v => v.id === sel.option_id);
        if (opt) calculatedPrice += opt.price_modifier || 0;
      }

      const allowance = oldSel.allowance_amount || 0;
      const over = calculatedPrice > allowance ? calculatedPrice - allowance : 0;
      const under = calculatedPrice < allowance ? allowance - calculatedPrice : 0;

      await base44.asServiceRole.entities.CustomerSelection.update(oldSel.id, { is_current: false, status: "Superseded" });
      const newSel = await base44.asServiceRole.entities.CustomerSelection.create({
        project_id: rec.project_id, area_id: rec.area_id, requirement_id: rec.requirement_id,
        catalogue_item_id: rec.recommended_item_id, selected_options: rec.recommended_options || [],
        calculated_price: calculatedPrice, allowance_amount: allowance, over_allowance: over, under_allowance: under,
        status: "Approved", submitted_date: oldSel.submitted_date, reviewed_date: now, reviewed_by: actor,
        version: (oldSel.version || 1) + 1, is_current: true,
        customer_notes: rec.customer_explanation || "", internal_notes: rec.staff_note || ""
      });
      await base44.asServiceRole.entities.SelectionRequirement.update(rec.requirement_id, { status: "Approved" });
      const procs = await base44.asServiceRole.entities.ProcurementItem.filter({ selection_id: oldSel.id });
      if (procs.length > 0) {
        await base44.asServiceRole.entities.ProcurementItem.update(procs[0].id, {
          selection_id: newSel.id, catalogue_item_id: rec.recommended_item_id,
          item_name: catItem?.name || rec.recommended_item_name, supplier: catItem?.supplier || "",
          brand: catItem?.brand || "", sku: catItem?.sku || "", status: "Substitution Required"
        });
      }
      await base44.asServiceRole.entities.SubstitutionRecommendation.update(recId, { status: "Staff approved", staff_approved_by: actor, staff_approved_date: now });
      await audit("selection", newSel.id, "substitution_applied",
        `${actor} applied substitution: ${rec.original_item_name} → ${rec.recommended_item_name} at $${calculatedPrice.toLocaleString()}`,
        rec.project_id,
        { severity: 'high', selection_id: newSel.id, field: "catalogue_item_id",
          old_value: oldSel.catalogue_item_id, new_value: rec.recommended_item_id,
          changed_by: actor, reason: rec.reason || "Substitution approved", calculated_price: calculatedPrice });
      return Response.json({ ok: true, selection_id: newSel.id, calculated_price: calculatedPrice });
    }

    // ==================== CANCEL (staff-only) ====================
    if (action === "cancel") {
      if (!isStaff) return Response.json({ error: "Forbidden" }, { status: 403 });
      const rec = await base44.asServiceRole.entities.SubstitutionRecommendation.get(recId).catch(() => null);
      if (!rec) return Response.json({ error: "Not found" }, { status: 404 });
      const access = await verifyProjectAccess(rec.project_id);
      if (!access.ok) return Response.json({ error: access.error }, { status: access.status });
      await base44.asServiceRole.entities.SubstitutionRecommendation.update(recId, { status: "Cancelled" });
      await audit("substitution", recId, "substitution_cancelled", `${actor} cancelled substitution recommendation for ${rec.original_item_name}`, rec.project_id, { severity: 'medium' });
      return Response.json({ ok: true });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});