import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    // Check if user is active (not deactivated)
    if (user.active === false) {
      return Response.json({ error: "Account deactivated" }, { status: 403 });
    }

    const body = await req.json();
    const action = body.action;
    const now = new Date().toISOString();
    const actor = user.full_name || user.email || "user";
    const isStaff = user.role === "admin" || user.role === "staff";

    // Helper: verify the user has access to the project
    async function verifyProjectAccess(projectId) {
      const project = await base44.asServiceRole.entities.Project.get(projectId).catch(() => null);
      if (!project) return { ok: false, error: "Project not found", status: 404 };
      if (isStaff) return { ok: true, project };
      const custs = project.assigned_customers || [];
      if (!custs.includes(user.id) && !custs.includes(user.email)) {
        return { ok: false, error: "Forbidden", status: 403 };
      }
      return { ok: true, project };
    }

    // Helper: verify a child record belongs to the correct project
    async function verifyChildProject(entityName, recordId, expectedProjectId) {
      const record = await base44.asServiceRole.entities[entityName].get(recordId).catch(() => null);
      if (!record) return { ok: false, error: "Record not found", status: 404 };
      if (record.project_id !== expectedProjectId) {
        return { ok: false, error: "Record does not belong to this project", status: 403 };
      }
      return { ok: true, record };
    }

    // Helper: server-side price calculation
    function calculatePrice(basePrice, selectedOptions, optionGroups, optionValues) {
      let total = basePrice || 0;
      for (const sel of selectedOptions) {
        const opt = (optionValues || []).find(v => v.id === sel.option_id);
        if (opt) total += opt.price_modifier || 0;
      }
      return total;
    }

    // Helper: server-side allowance calculation
    function calculateAllowance(price, allowanceAmount) {
      const over = price > allowanceAmount ? price - allowanceAmount : 0;
      const under = price < allowanceAmount ? allowanceAmount - price : 0;
      return { over, under };
    }

    // Helper: create audit log
    async function createAudit(targetType, targetId, auditAction, field, oldValue, newValue, reason, projectId, extra = {}) {
      await base44.asServiceRole.entities.AuditLog.create({
        target_type: targetType, target_id: targetId, action: auditAction,
        action_type: auditAction, field: field || null, old_value: oldValue != null ? String(oldValue) : null,
        new_value: newValue != null ? String(newValue) : null, changed_by: actor,
        actor_user_id: user.id, actor_name: actor, actor_role: user.role,
        project_id: projectId || null, reason: reason || null, severity: extra.severity || 'medium',
        ...extra
      });
    }

    // ==================== CUSTOMER: SUBMIT SELECTION ====================
    if (action === "submit_selection") {
      const { project_id, area_id, requirement_id, catalogue_item_id, selected_options, customer_notes, existing_selection_id } = body;
      if (!project_id || !requirement_id || !catalogue_item_id) {
        return Response.json({ error: "project_id, requirement_id, and catalogue_item_id are required" }, { status: 400 });
      }

      // Verify project access
      const access = await verifyProjectAccess(project_id);
      if (!access.ok) return Response.json({ error: access.error }, { status: access.status });

      // Verify requirement belongs to this project
      const reqCheck = await verifyChildProject("SelectionRequirement", requirement_id, project_id);
      if (!reqCheck.ok) return Response.json({ error: reqCheck.error }, { status: reqCheck.status });
      const requirement = reqCheck.record;

      // Verify area belongs to this project if provided
      if (area_id) {
        const areaCheck = await verifyChildProject("ProjectArea", area_id, project_id);
        if (!areaCheck.ok) return Response.json({ error: areaCheck.error }, { status: areaCheck.status });
      }

      // Check if selection is locked or past approval
      if (existing_selection_id) {
        const existing = await base44.asServiceRole.entities.CustomerSelection.get(existing_selection_id).catch(() => null);
        if (existing && existing.locked) {
          return Response.json({ error: "Selection is locked. Submit a change request instead." }, { status: 400 });
        }
        if (existing && existing.project_id !== project_id) {
          return Response.json({ error: "Selection does not belong to this project" }, { status: 403 });
        }
      }

      // Server-side pricing calculation
      const catItem = await base44.asServiceRole.entities.CatalogueItem.get(catalogue_item_id).catch(() => null);
      if (!catItem) return Response.json({ error: "Catalogue item not found" }, { status: 404 });

      const optionValues = await base44.asServiceRole.entities.CatalogueOptionValue.filter({ catalogue_item_id }, null, 500);
      const calculatedPrice = calculatePrice(catItem.base_price, selected_options || [], null, optionValues);
      const allowanceAmount = requirement.allowance_amount || 0;
      const { over, under } = calculateAllowance(calculatedPrice, allowanceAmount);

      // Build the options array with validated names and prices
      const validatedOptions = (selected_options || []).map(sel => {
        const opt = optionValues.find(v => v.id === sel.option_id);
        const group = opt ? (base44.asServiceRole.entities.CatalogueOptionGroup) : null;
        return {
          group_id: sel.group_id,
          group_name: sel.group_name || "",
          option_id: sel.option_id,
          option_name: opt?.name || sel.option_name || "",
          price_modifier: opt?.price_modifier || 0
        };
      });

      let selectionId;
      if (existing_selection_id) {
        const existing = await base44.asServiceRole.entities.CustomerSelection.get(existing_selection_id);
        if (!["Pending", "Revision Requested", "Rejected"].includes(existing.status)) {
          return Response.json({ error: "Cannot update selection with status: " + existing.status }, { status: 400 });
        }
        await base44.asServiceRole.entities.CustomerSelection.update(existing_selection_id, {
          catalogue_item_id, selected_options: validatedOptions,
          calculated_price: calculatedPrice, allowance_amount: allowanceAmount,
          over_allowance: over, under_allowance: under,
          customer_notes: customer_notes || "", status: "Pending",
          submitted_date: now
        });
        selectionId = existing_selection_id;
      } else {
        // If there's a current selection, supersede it
        const existingSels = await base44.asServiceRole.entities.CustomerSelection.filter({ requirement_id });
        const current = existingSels.find(s => s.is_current);
        if (current) {
          await base44.asServiceRole.entities.CustomerSelection.update(current.id, { is_current: false, status: "Superseded" });
        }
        const newSel = await base44.asServiceRole.entities.CustomerSelection.create({
          project_id, area_id, requirement_id, catalogue_item_id,
          selected_options: validatedOptions, calculated_price: calculatedPrice,
          allowance_amount: allowanceAmount, over_allowance: over, under_allowance: under,
          customer_notes: customer_notes || "", status: "Pending", is_current: true,
          submitted_date: now, version: (current?.version || 0) + 1
        });
        selectionId = newSel.id;
      }

      // Update requirement status
      const oldReqStatus = requirement.status;
      await base44.asServiceRole.entities.SelectionRequirement.update(requirement_id, { status: "Submitted" });

      // Create allowance ledger entry (server-side)
      await base44.asServiceRole.entities.AllowanceLedger.create({
        project_id, area_id, requirement_id,
        event_type: existing_selection_id ? "Selection Changed" : "Selection Submitted",
        amount: calculatedPrice, running_balance: calculatedPrice - allowanceAmount,
        description: `${catItem.name} submitted at $${calculatedPrice.toLocaleString()}`,
        performed_by: actor
      });

      // Audit log
      await createAudit("selection", selectionId, "selection_submitted", "status",
        oldReqStatus, "Submitted", customer_notes || "Customer submitted selection", project_id,
        { severity: 'high', catalogue_item_id, calculated_price: calculatedPrice });

      return Response.json({ ok: true, selection_id: selectionId, calculated_price: calculatedPrice, over_allowance: over, under_allowance: under });
    }

    // ==================== CUSTOMER: REQUEST CHANGE ====================
    if (action === "request_change") {
      const { project_id, area_id, requirement_id, selection_id, catalogue_item_id, selected_options, reason, customer_note } = body;
      if (!project_id || !selection_id || !catalogue_item_id || !reason) {
        return Response.json({ error: "project_id, selection_id, catalogue_item_id, and reason are required" }, { status: 400 });
      }

      const access = await verifyProjectAccess(project_id);
      if (!access.ok) return Response.json({ error: access.error }, { status: access.status });

      const selCheck = await verifyChildProject("CustomerSelection", selection_id, project_id);
      if (!selCheck.ok) return Response.json({ error: selCheck.error }, { status: selCheck.status });
      const existingSelection = selCheck.record;

      if (existingSelection.locked) {
        return Response.json({ error: "Selection is locked" }, { status: 400 });
      }

      // Server-side pricing
      const catItem = await base44.asServiceRole.entities.CatalogueItem.get(catalogue_item_id).catch(() => null);
      if (!catItem) return Response.json({ error: "Catalogue item not found" }, { status: 404 });
      const optionValues = await base44.asServiceRole.entities.CatalogueOptionValue.filter({ catalogue_item_id }, null, 500);
      const calculatedPrice = calculatePrice(catItem.base_price, selected_options || [], null, optionValues);
      const originalPrice = existingSelection.calculated_price || 0;
      const priceDiff = calculatedPrice - originalPrice;

      // Get requirement for allowance
      const requirement = await base44.asServiceRole.entities.SelectionRequirement.get(requirement_id).catch(() => null);
      const allowanceAmount = requirement?.allowance_amount || 0;
      const allowanceImpact = calculatedPrice - allowanceAmount;

      const validatedOptions = (selected_options || []).map(sel => {
        const opt = optionValues.find(v => v.id === sel.option_id);
        return {
          group_id: sel.group_id, group_name: sel.group_name || "",
          option_id: sel.option_id, option_name: opt?.name || sel.option_name || "",
          price_modifier: opt?.price_modifier || 0
        };
      });

      const cr = await base44.asServiceRole.entities.ChangeRequest.create({
        project_id, area_id, requirement_id, selection_id,
        original_item_name: existingSelection.catalogue_item_id,
        original_price: originalPrice,
        requested_item_id: catalogue_item_id, requested_item_name: catItem.name,
        requested_options: validatedOptions, requested_price: calculatedPrice,
        reason, price_impact: priceDiff, allowance_impact: allowanceImpact,
        customer_note: customer_note || "", status: "Requested"
      });

      // Update requirement status
      const oldReqStatus = requirement?.status;
      await base44.asServiceRole.entities.SelectionRequirement.update(requirement_id, { status: "Change Requested" });

      // Audit log
      await createAudit("change_request", cr.id, "change_requested", "selection",
        existingSelection.catalogue_item_id, catalogue_item_id, reason, project_id,
        { severity: 'high', selection_id, price_impact: priceDiff });

      return Response.json({ ok: true, change_request_id: cr.id, price_impact: priceDiff });
    }

    // ==================== CUSTOMER: SIGN OFF ====================
    if (action === "sign_off") {
      const sel = await base44.asServiceRole.entities.CustomerSelection.get(body.selection_id).catch(() => null);
      if (!sel) return Response.json({ error: "Not found" }, { status: 404 });
      if (sel.locked) return Response.json({ error: "Selection is locked" }, { status: 400 });

      if (!isStaff) {
        const access = await verifyProjectAccess(sel.project_id);
        if (!access.ok) return Response.json({ error: access.error }, { status: access.status });
      }

      await base44.asServiceRole.entities.CustomerSelection.update(sel.id, {
        signed_off: true, signed_off_by: actor, signed_off_date: now, sign_off_note: body.note || ""
      });
      await createAudit("selection", sel.id, "signed_off", "signed_off", "false", "true",
        body.note || "Customer sign-off", sel.project_id, { severity: 'high' });
      return Response.json({ ok: true });
    }

    // ==================== STAFF-ONLY ACTIONS BELOW ====================
    if (!isStaff) return Response.json({ error: "Forbidden" }, { status: 403 });

    if (action === "review") {
      const sel = await base44.asServiceRole.entities.CustomerSelection.get(body.selection_id).catch(() => null);
      if (!sel) return Response.json({ error: "Not found" }, { status: 404 });
      const reviewAction = body.review_action;
      if (!["Approved", "Rejected", "Revision Requested"].includes(reviewAction)) {
        return Response.json({ error: "Invalid review action" }, { status: 400 });
      }

      // Server-side pricing with staff override
      const hasOverride = body.staff_price_override !== "" && body.staff_price_override != null;
      const finalPrice = hasOverride ? Number(body.staff_price_override) : (sel.calculated_price || 0);
      const allowance = sel.allowance_amount || 0;
      let over = finalPrice > allowance ? finalPrice - allowance : 0;
      let under = finalPrice < allowance ? allowance - finalPrice : 0;

      await base44.asServiceRole.entities.CustomerSelection.update(sel.id, {
        status: reviewAction,
        staff_price_override: hasOverride ? Number(body.staff_price_override) : null,
        calculated_price: finalPrice, over_allowance: over, under_allowance: under,
        staff_comments: body.customer_comments || sel.staff_comments,
        internal_notes: body.internal_notes || sel.internal_notes,
        reviewed_date: now, reviewed_by: actor
      });

      const reqStatus = reviewAction === "Approved" ? "Approved" : reviewAction === "Rejected" ? "Rejected" : "Revision Requested";
      await base44.asServiceRole.entities.SelectionRequirement.update(sel.requirement_id, { status: reqStatus });

      await createAudit("selection", sel.id, `review_${reviewAction.toLowerCase().replace(/ /g, "_")}`,
        "status", sel.status, reviewAction, body.customer_comments || "", sel.project_id,
        { severity: 'high', reviewed_by: actor });

      if (reviewAction === "Approved") {
        // Server-side ledger entry
        await base44.asServiceRole.entities.AllowanceLedger.create({
          project_id: sel.project_id, area_id: sel.area_id, requirement_id: sel.requirement_id,
          event_type: hasOverride ? "Staff Override" : "Selection Approved",
          amount: finalPrice, running_balance: over - under,
          description: `Selection approved at $${finalPrice.toLocaleString()}`,
          performed_by: actor
        });

        // Create procurement item if not exists
        const existingProc = await base44.asServiceRole.entities.ProcurementItem.filter({ selection_id: sel.id });
        if (existingProc.length === 0) {
          const catItem = await base44.asServiceRole.entities.CatalogueItem.get(sel.catalogue_item_id).catch(() => null);
          await base44.asServiceRole.entities.ProcurementItem.create({
            project_id: sel.project_id, area_id: sel.area_id, requirement_id: sel.requirement_id,
            selection_id: sel.id, catalogue_item_id: sel.catalogue_item_id,
            item_name: catItem?.name || "", category: catItem?.category || "",
            supplier: catItem?.supplier || "", brand: catItem?.brand || "",
            sku: catItem?.sku || "", quantity: 1,
            unit_of_measure: catItem?.unit_of_measure || "", status: "Not Ready to Order"
          });
        }
      }
      return Response.json({ ok: true });
    }

    if (action === "change_requirement_status") {
      const req = await base44.asServiceRole.entities.SelectionRequirement.get(body.requirement_id).catch(() => null);
      if (!req) return Response.json({ error: "Not found" }, { status: 404 });
      const oldStatus = req.status;
      await base44.asServiceRole.entities.SelectionRequirement.update(req.id, { status: body.new_status });
      await createAudit("requirement", req.id, "status_changed", "status", oldStatus, body.new_status,
        body.reason || "Staff status change", req.project_id, { severity: 'medium' });
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
        await base44.asServiceRole.entities.CustomerSelection.update(s.id, { sign_off_requested: true });
        await createAudit("selection", s.id, "sign_off_requested", "sign_off_requested", "false", "true",
          "Sign-off requested", s.project_id, { severity: 'medium' });
        count++;
      }
      if (body.project_id && count > 0) {
        const project = await base44.asServiceRole.entities.Project.get(body.project_id);
        for (const cid of (project.assigned_customers || [])) {
          await base44.asServiceRole.entities.Notification.create({
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
        await base44.asServiceRole.entities.CustomerSelection.update(s.id, {
          locked: true, locked_date: now, locked_by: actor, locked_reason: body.reason || "Locked after sign-off"
        });
        await createAudit("selection", s.id, "locked", "locked", "false", "true",
          body.reason || "Locked after sign-off", s.project_id, { severity: 'high', locked_by: actor });
        count++;
      }
      return Response.json({ ok: true, count });
    }

    if (action === "unlock") {
      if (!body.reason || !body.reason.trim()) return Response.json({ error: "Reason required" }, { status: 400 });
      const s = await base44.asServiceRole.entities.CustomerSelection.get(body.selection_id).catch(() => null);
      if (!s) return Response.json({ error: "Not found" }, { status: 404 });
      await base44.asServiceRole.entities.CustomerSelection.update(s.id, { locked: false, unlock_reason: body.reason });
      await createAudit("selection", s.id, "unlocked", "locked", "true", "false",
        body.reason, s.project_id, { severity: 'high', unlocked_by: actor });
      return Response.json({ ok: true });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});