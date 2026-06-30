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

    // ==================== ACCESS VERIFICATION ====================
    async function verifyProjectAccess(projectId) {
      const project = await base44.asServiceRole.entities.Project.get(projectId).catch(() => null);
      if (!project) return { ok: false, error: "Project not found", status: 404 };
      if (isStaff) {
        const perms = user.permissions || [];
        const hasViewAll = user.role === "admin" || perms.includes("view_all_projects");
        if (!hasViewAll) {
          const assigned = project.assigned_staff || [];
          const userAssigned = assigned.includes(user.id) || assigned.includes(user.email);
          if (!userAssigned) {
            return { ok: false, error: "Forbidden - project not assigned", status: 403 };
          }
        }
        return { ok: true, project, isStaff: true };
      }
      const custs = project.assigned_customers || [];
      if (!custs.includes(user.id) && !custs.includes(user.email)) {
        await base44.asServiceRole.entities.AuditLog.create({
          target_type: "project", target_id: projectId, action: "selection_access_denied",
          action_type: "selection_access_denied",
          description: `${user.email} denied selection access to project ${project.name}`,
          actor_user_id: user.id, actor_name: actor, actor_role: user.role,
          project_id: projectId, severity: "high"
        }).catch(() => {});
        return { ok: false, error: "Forbidden", status: 403 };
      }
      return { ok: true, project, isStaff: false };
    }

    async function verifyChildProject(entityName, recordId, expectedProjectId) {
      const record = await base44.asServiceRole.entities[entityName].get(recordId).catch(() => null);
      if (!record) return { ok: false, error: "Record not found", status: 404 };
      if (record.project_id !== expectedProjectId) {
        return { ok: false, error: "Record does not belong to this project", status: 403 };
      }
      return { ok: true, record };
    }

    function calculatePrice(basePrice, selectedOptions, optionValues) {
      let total = basePrice || 0;
      for (const sel of selectedOptions) {
        const opt = (optionValues || []).find(v => v.id === sel.option_id);
        if (opt) total += opt.price_modifier || 0;
      }
      return total;
    }

    function calculateAllowance(price, allowanceAmount) {
      const over = price > allowanceAmount ? price - allowanceAmount : 0;
      const under = price < allowanceAmount ? allowanceAmount - price : 0;
      return { over, under };
    }

    async function createAudit(targetType, targetId, auditAction, field, oldValue, newValue, reason, projectId, extra = {}) {
      await base44.asServiceRole.entities.AuditLog.create({
        target_type: targetType, target_id: targetId, action: auditAction,
        action_type: auditAction, field: field || null,
        old_value: oldValue != null ? String(oldValue) : null,
        new_value: newValue != null ? String(newValue) : null, changed_by: actor,
        actor_user_id: user.id, actor_name: actor, actor_role: user.role,
        project_id: projectId || null, reason: reason || null, severity: extra.severity || 'medium',
        ...extra
      });
    }

    // ==================== VALIDATE CATALOGUE ITEM ELIGIBILITY ====================
    async function validateCatalogueItem(projectId, requirementId, catalogueItemId, selectedOptions) {
      const requirement = await base44.asServiceRole.entities.SelectionRequirement.get(requirementId).catch(() => null);
      if (!requirement) return { ok: false, error: "Requirement not found", status: 404 };
      if (requirement.lock_after_approval && requirement.status === "Locked") {
        return { ok: false, error: "Requirement is locked", status: 400 };
      }

      const catItem = await base44.asServiceRole.entities.CatalogueItem.get(catalogueItemId).catch(() => null);
      if (!catItem) return { ok: false, error: "Catalogue item not found", status: 404 };

      // Check item status - reject unavailable items
      const blockedStatuses = ["Discontinued", "Draft", "Inactive"];
      if (blockedStatuses.includes(catItem.status)) {
        return { ok: false, error: `Catalogue item is not available (status: ${catItem.status})`, status: 400 };
      }

      // Check category matches requirement category
      if (requirement.category && catItem.category && requirement.category !== catItem.category) {
        return { ok: false, error: `Catalogue item category (${catItem.category}) does not match requirement category (${requirement.category})`, status: 400 };
      }

      // Check customer catalogue access mode
      const accessMode = requirement.customer_catalogue_access_mode || "suggested_only";
      if (accessMode === "staff_only") {
        return { ok: false, error: "This selection is staff-only. Customers cannot submit directly.", status: 403 };
      }

      // If suggested_only or suggested_plus_request, verify item is in suggested list
      if (accessMode === "suggested_only" || accessMode === "suggested_plus_request") {
        const suggested = await base44.asServiceRole.entities.ProjectAvailableCatalogueItem.filter(
          { requirement_id: requirementId, catalogue_item_id: catalogueItemId }
        );
        if (suggested.length === 0 || suggested[0].is_available === false) {
          return { ok: false, error: "This catalogue item is not in the suggested options for this requirement", status: 403 };
        }
      }

      // Verify selected option groups and values belong to this catalogue item
      const [optionGroups, optionValues] = await Promise.all([
        base44.asServiceRole.entities.CatalogueOptionGroup.filter({ catalogue_item_id: catalogueItemId }, null, 500),
        base44.asServiceRole.entities.CatalogueOptionValue.filter({ catalogue_item_id: catalogueItemId }, null, 500)
      ]);

      const validGroupIds = new Set(optionGroups.map(g => g.id));
      const validValueIds = new Set(optionValues.map(v => v.id));

      for (const sel of selectedOptions || []) {
        if (!validGroupIds.has(sel.group_id)) {
          return { ok: false, error: `Option group ${sel.group_name || sel.group_id} does not belong to this catalogue item`, status: 400 };
        }
        if (!validValueIds.has(sel.option_id)) {
          return { ok: false, error: `Option value ${sel.option_name || sel.option_id} does not belong to this catalogue item`, status: 400 };
        }
      }

      // Verify required option groups are complete
      const requiredGroups = optionGroups.filter(g => g.is_required !== false);
      const selectedGroupIds = new Set((selectedOptions || []).map(s => s.group_id));
      for (const rg of requiredGroups) {
        if (!selectedGroupIds.has(rg.id)) {
          return { ok: false, error: `Required option group "${rg.name}" is not selected`, status: 400 };
        }
      }

      // Verify option rules are respected
      const optionRules = await base44.asServiceRole.entities.CatalogueOptionRule.filter(
        { catalogue_item_id: catalogueItemId, is_active: true }, null, 500
      );
      const selectedMap = {};
      (selectedOptions || []).forEach(s => { selectedMap[s.group_id] = s.option_id; });

      for (const rule of optionRules) {
        if (rule.action === "hide" && rule.target_option_value_id) {
          // If condition is met, target option should NOT be selected
          if (selectedMap[rule.condition_group_id] === rule.condition_option_value_id) {
            if (selectedMap[rule.target_group_id] === rule.target_option_value_id) {
              return { ok: false, error: "Selected option combination violates a configuration rule", status: 400 };
            }
          }
        }
        if (rule.action === "show" && rule.target_option_value_id) {
          // Target option can ONLY be selected if condition is met
          if (selectedMap[rule.target_group_id] === rule.target_option_value_id) {
            if (selectedMap[rule.condition_group_id] !== rule.condition_option_value_id) {
              return { ok: false, error: "Selected option combination violates a configuration rule (conditional option)", status: 400 };
            }
          }
        }
      }

      return { ok: true, catItem, requirement, optionValues, optionGroups };
    }

    // ==================== SUBMIT SELECTION ====================
    if (action === "submit_selection") {
      const { project_id, area_id, requirement_id, catalogue_item_id, selected_options, customer_notes, existing_selection_id } = body;
      if (!project_id || !requirement_id || !catalogue_item_id) {
        return Response.json({ error: "project_id, requirement_id, and catalogue_item_id are required" }, { status: 400 });
      }

      const access = await verifyProjectAccess(project_id);
      if (!access.ok) return Response.json({ error: access.error }, { status: access.status });

      // Verify requirement belongs to this project
      const reqCheck = await verifyChildProject("SelectionRequirement", requirement_id, project_id);
      if (!reqCheck.ok) return Response.json({ error: reqCheck.error }, { status: reqCheck.status });

      // Verify area belongs to this project if provided
      if (area_id) {
        const areaCheck = await verifyChildProject("ProjectArea", area_id, project_id);
        if (!areaCheck.ok) return Response.json({ error: areaCheck.error }, { status: areaCheck.status });
      }

      // Validate catalogue item eligibility (category, access mode, options, rules)
      const validation = await validateCatalogueItem(project_id, requirement_id, catalogue_item_id, selected_options);
      if (!validation.ok) return Response.json({ error: validation.error }, { status: validation.status });
      const { catItem, requirement, optionValues } = validation;

      // Check existing selection lock/status
      if (existing_selection_id) {
        const existing = await base44.asServiceRole.entities.CustomerSelection.get(existing_selection_id).catch(() => null);
        if (!existing) return Response.json({ error: "Existing selection not found" }, { status: 404 });
        if (existing.project_id !== project_id) return Response.json({ error: "Selection does not belong to this project" }, { status: 403 });
        if (existing.locked) return Response.json({ error: "Selection is locked. Submit a change request instead." }, { status: 400 });
        if (!["Pending", "Revision Requested", "Rejected"].includes(existing.status)) {
          return Response.json({ error: "Cannot update selection with status: " + existing.status }, { status: 400 });
        }
      }

      // SERVER-SIDE price calculation - ignore any client-supplied price
      const calculatedPrice = calculatePrice(catItem.base_price, selected_options || [], optionValues);
      const allowanceAmount = requirement.allowance_amount || 0;
      const { over, under } = calculateAllowance(calculatedPrice, allowanceAmount);

      // Build validated options array with server-confirmed names and prices
      const validatedOptions = (selected_options || []).map(sel => {
        const opt = optionValues.find(v => v.id === sel.option_id);
        const grp = optionValues.find(v => v.id === sel.option_id);
        return {
          group_id: sel.group_id,
          group_name: opt ? (validation.optionGroups.find(g => g.id === sel.group_id)?.name || "") : (sel.group_name || ""),
          option_id: sel.option_id,
          option_name: opt?.name || sel.option_name || "",
          price_modifier: opt?.price_modifier || 0
        };
      });

      let selectionId;
      if (existing_selection_id) {
        await base44.asServiceRole.entities.CustomerSelection.update(existing_selection_id, {
          catalogue_item_id, selected_options: validatedOptions,
          calculated_price: calculatedPrice, allowance_amount: allowanceAmount,
          over_allowance: over, under_allowance: under,
          customer_notes: customer_notes || "", status: "Pending",
          submitted_date: now
        });
        selectionId = existing_selection_id;
      } else {
        // Supersede existing current selection
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

      // Create allowance ledger entry
      await base44.asServiceRole.entities.AllowanceLedger.create({
        project_id, area_id, requirement_id,
        event_type: existing_selection_id ? "Selection Changed" : "Selection Submitted",
        amount: calculatedPrice, running_balance: calculatedPrice - allowanceAmount,
        description: `${catItem.name} submitted at $${calculatedPrice.toLocaleString()}`,
        performed_by: actor
      });

      await createAudit("selection", selectionId, "selection_submitted", "status",
        oldReqStatus, "Submitted", customer_notes || "Customer submitted selection", project_id,
        { severity: 'high', catalogue_item_id, calculated_price: calculatedPrice });

      return Response.json({ ok: true, selection_id: selectionId, calculated_price: calculatedPrice, over_allowance: over, under_allowance: under });
    }

    // ==================== REQUEST CHANGE ====================
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

      if (existingSelection.locked) return Response.json({ error: "Selection is locked" }, { status: 400 });

      // Verify change requests are allowed based on current status
      if (!["Approved", "Pending"].includes(existingSelection.status)) {
        return Response.json({ error: `Cannot request change on selection with status: ${existingSelection.status}` }, { status: 400 });
      }

      // Duplicate check: prevent multiple open change requests for the same selection
      const existingCRs = await base44.asServiceRole.entities.ChangeRequest.filter(
        { selection_id, requirement_id }, "-created_date", 50
      );
      const openCR = existingCRs.find(cr => !["Approved", "Rejected", "Cancelled"].includes(cr.status));
      if (openCR) {
        return Response.json({ error: "There is already an open change request for this selection. Please wait for staff to review it." }, { status: 409 });
      }

      // Validate new catalogue item
      const validation = await validateCatalogueItem(project_id, requirement_id, catalogue_item_id, selected_options);
      if (!validation.ok) return Response.json({ error: validation.error }, { status: validation.status });
      const { catItem, requirement, optionValues } = validation;

      // Server-side pricing
      const calculatedPrice = calculatePrice(catItem.base_price, selected_options || [], optionValues);
      const originalPrice = existingSelection.calculated_price || 0;
      const priceDiff = calculatedPrice - originalPrice;
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

      const oldReqStatus = requirement?.status;
      await base44.asServiceRole.entities.SelectionRequirement.update(requirement_id, { status: "Change Requested" });

      await createAudit("change_request", cr.id, "change_requested", "selection",
        existingSelection.catalogue_item_id, catalogue_item_id, reason, project_id,
        { severity: 'high', selection_id, price_impact: priceDiff });

      return Response.json({ ok: true, change_request_id: cr.id, price_impact: priceDiff });
    }

    // ==================== SIGN OFF ====================
    if (action === "sign_off") {
      const { selection_id, note } = body;
      if (!selection_id) return Response.json({ error: "selection_id required" }, { status: 400 });

      const sel = await base44.asServiceRole.entities.CustomerSelection.get(selection_id).catch(() => null);
      if (!sel) return Response.json({ error: "Selection not found" }, { status: 404 });
      if (sel.locked) return Response.json({ error: "Selection is locked" }, { status: 400 });

      // Verify project access
      const access = await verifyProjectAccess(sel.project_id);
      if (!access.ok) return Response.json({ error: access.error }, { status: access.status });

      // Verify sign-off was requested
      if (!sel.sign_off_requested) {
        return Response.json({ error: "Sign-off has not been requested for this selection" }, { status: 400 });
      }
      // Prevent double sign-off
      if (sel.signed_off) {
        return Response.json({ error: "Selection has already been signed off" }, { status: 400 });
      }

      await base44.asServiceRole.entities.CustomerSelection.update(sel.id, {
        signed_off: true, signed_off_by: actor, signed_off_date: now, sign_off_note: note || ""
      });
      await createAudit("selection", sel.id, "signed_off", "signed_off", "false", "true",
        note || "Customer sign-off", sel.project_id, { severity: 'high' });
      return Response.json({ ok: true });
    }

    // ==================== STAFF-ONLY ACTIONS ====================
    if (!isStaff) return Response.json({ error: "Forbidden" }, { status: 403 });

    if (action === "review") {
      const sel = await base44.asServiceRole.entities.CustomerSelection.get(body.selection_id).catch(() => null);
      if (!sel) return Response.json({ error: "Not found" }, { status: 404 });
      const reviewAccess = await verifyProjectAccess(sel.project_id);
      if (!reviewAccess.ok) return Response.json({ error: reviewAccess.error }, { status: reviewAccess.status });
      const reviewAction = body.review_action;
      if (!["Approved", "Rejected", "Revision Requested"].includes(reviewAction)) {
        return Response.json({ error: "Invalid review action" }, { status: 400 });
      }

      // Idempotency guard: prevent duplicate approval actions
      if (reviewAction === "Approved" && sel.status === "Approved") {
        const hasOverride = body.staff_price_override !== "" && body.staff_price_override != null;
        if (!hasOverride && !body.customer_comments && !body.internal_notes) {
          // Already approved, no changes needed - return early without creating duplicate entries
          await createAudit("selection", sel.id, "review_noop", "status", "Approved", "Approved",
            "Selection was already approved - no duplicate action taken", sel.project_id,
            { severity: 'low', reviewed_by: actor });
          return Response.json({ ok: true, already_approved: true, message: "Selection was already approved. No duplicate allowance entry created." });
        }
        // If there's a price override, treat as price adjustment only (not a second approval)
        if (hasOverride) {
          const oldPrice = sel.calculated_price || 0;
          const newPrice = Number(body.staff_price_override);
          const priceDelta = newPrice - oldPrice;
          const allowance = sel.allowance_amount || 0;
          const over = newPrice > allowance ? newPrice - allowance : 0;
          const under = newPrice < allowance ? allowance - newPrice : 0;

          await base44.asServiceRole.entities.CustomerSelection.update(sel.id, {
            staff_price_override: newPrice,
            calculated_price: newPrice, over_allowance: over, under_allowance: under,
            reviewed_date: now, reviewed_by: actor
          });

          // Create ledger entry for the delta only, not the full amount
          if (priceDelta !== 0) {
            await base44.asServiceRole.entities.AllowanceLedger.create({
              project_id: sel.project_id, area_id: sel.area_id, requirement_id: sel.requirement_id,
              event_type: "Price Adjustment",
              amount: priceDelta, running_balance: over - under,
              description: `Price adjustment: $${oldPrice.toLocaleString()} → $${newPrice.toLocaleString()} (delta: ${priceDelta >= 0 ? '+' : ''}$${priceDelta.toLocaleString()})`,
              performed_by: actor
            });
          }
          await createAudit("selection", sel.id, "price_adjusted", "calculated_price", oldPrice, newPrice,
            "Staff price adjustment on approved selection", sel.project_id, { severity: 'medium' });
          return Response.json({ ok: true, price_adjustment: priceDelta });
        }
      }

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
        // Check for existing approval ledger entry BY SELECTION_ID to prevent duplicates
        const existingLedger = await base44.asServiceRole.entities.AllowanceLedger.filter({
          project_id: sel.project_id,
          requirement_id: sel.requirement_id,
          event_type: "Selection Approved"
        });
        // Check by selection_id field (exact match) instead of description text
        const hasApprovalEntry = existingLedger.some(entry => {
          // Use selection_id if available, fallback to description check for legacy entries
          const desc = entry.description || "";
          return (entry.requirement_id === sel.requirement_id && desc.includes(sel.id)) || 
                 desc.includes(`approved at $${finalPrice.toLocaleString()}`);
        });

        if (!hasApprovalEntry) {
          await base44.asServiceRole.entities.AllowanceLedger.create({
            project_id: sel.project_id, area_id: sel.area_id, requirement_id: sel.requirement_id,
            event_type: "Selection Approved",
            amount: finalPrice, running_balance: over - under,
            description: `Selection ${sel.id} approved at $${finalPrice.toLocaleString()}`,
            performed_by: actor
          });
        }

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
      const reqAccess = await verifyProjectAccess(req.project_id);
      if (!reqAccess.ok) return Response.json({ error: reqAccess.error }, { status: reqAccess.status });
      const oldStatus = req.status;
      await base44.asServiceRole.entities.SelectionRequirement.update(req.id, { status: body.new_status });
      await createAudit("requirement", req.id, "status_changed", "status", oldStatus, body.new_status,
        body.reason || "Staff status change", req.project_id, { severity: 'medium' });
      return Response.json({ ok: true });
    }

    if (action === "create_requirement") {
      const { project_id, area_id, name, category, is_required, allowance_amount, approval_required, due_date, customer_catalogue_access_mode } = body;
      if (!project_id || !area_id || !name) {
        return Response.json({ error: "project_id, area_id, and name are required" }, { status: 400 });
      }
      const reqAccess = await verifyProjectAccess(project_id);
      if (!reqAccess.ok) return Response.json({ error: reqAccess.error }, { status: reqAccess.status });
      const created = await base44.asServiceRole.entities.SelectionRequirement.create({
        project_id, area_id, name,
        category: category || "Other",
        is_required: is_required !== false,
        allowance_amount: Number(allowance_amount) || 0,
        approval_required: approval_required !== false,
        due_date: due_date || null,
        customer_catalogue_access_mode: customer_catalogue_access_mode || "suggested_only",
        status: "Not Started"
      });
      await createAudit("requirement", created.id, "requirement_created", "name", null, name,
        "Staff created selection requirement", project_id, { severity: 'medium' });
      return Response.json({ ok: true, requirement_id: created.id });
    }

    if (action === "update_area") {
      const area = await base44.asServiceRole.entities.ProjectArea.get(body.area_id).catch(() => null);
      if (!area) return Response.json({ error: "Area not found" }, { status: 404 });
      const areaAccess = await verifyProjectAccess(area.project_id);
      if (!areaAccess.ok) return Response.json({ error: areaAccess.error }, { status: areaAccess.status });
      const updates = {};
      if (body.allowance != null) updates.allowance = Number(body.allowance) || 0;
      if (body.due_date !== undefined) updates.due_date = body.due_date || null;
      if (body.name) updates.name = body.name;
      if (body.status) updates.status = body.status;
      const oldValues = {};
      for (const k of Object.keys(updates)) oldValues[k] = area[k];
      await base44.asServiceRole.entities.ProjectArea.update(area.id, updates);
      for (const [field, newVal] of Object.entries(updates)) {
        await createAudit("area", area.id, "area_updated", field, oldValues[field], newVal,
          "Staff updated area", area.project_id, { severity: 'low' });
      }
      return Response.json({ ok: true });
    }

    if (action === "update_requirement") {
      const req = await base44.asServiceRole.entities.SelectionRequirement.get(body.requirement_id).catch(() => null);
      if (!req) return Response.json({ error: "Not found" }, { status: 404 });
      const reqAccess = await verifyProjectAccess(req.project_id);
      if (!reqAccess.ok) return Response.json({ error: reqAccess.error }, { status: reqAccess.status });
      const updates = {};
      if (body.allowance_amount != null) updates.allowance_amount = Number(body.allowance_amount) || 0;
      if (body.customer_catalogue_access_mode) updates.customer_catalogue_access_mode = body.customer_catalogue_access_mode;
      if (body.due_date !== undefined) updates.due_date = body.due_date || null;
      if (body.customer_instructions !== undefined) updates.customer_instructions = body.customer_instructions;
      if (body.is_required !== undefined) updates.is_required = body.is_required;
      if (body.approval_required !== undefined) updates.approval_required = body.approval_required;
      const oldValues = {};
      for (const k of Object.keys(updates)) oldValues[k] = req[k];
      await base44.asServiceRole.entities.SelectionRequirement.update(req.id, updates);
      for (const [field, newVal] of Object.entries(updates)) {
        await createAudit("requirement", req.id, "requirement_updated", field, oldValues[field], newVal,
          "Staff updated requirement", req.project_id, { severity: 'low' });
      }
      return Response.json({ ok: true });
    }

    if (action === "link_mood_board") {
      const { mood_board_item_id, requirement_id } = body;
      if (!mood_board_item_id || !requirement_id) {
        return Response.json({ error: "mood_board_item_id and requirement_id are required" }, { status: 400 });
      }
      const req = await base44.asServiceRole.entities.SelectionRequirement.get(requirement_id).catch(() => null);
      if (!req) return Response.json({ error: "Requirement not found" }, { status: 404 });
      const mbAccess = await verifyProjectAccess(req.project_id);
      if (!mbAccess.ok) return Response.json({ error: mbAccess.error }, { status: mbAccess.status });
      const mb = await base44.asServiceRole.entities.MoodBoardItem.get(mood_board_item_id).catch(() => null);
      if (!mb) return Response.json({ error: "Mood board item not found" }, { status: 404 });
      await base44.asServiceRole.entities.MoodBoardItem.update(mood_board_item_id, { linked_requirement_id: requirement_id });
      await createAudit("requirement", requirement_id, "mood_board_linked", "linked_requirement_id", null, mood_board_item_id,
        "Staff linked mood board item to requirement", req.project_id, { severity: 'low' });
      return Response.json({ ok: true });
    }

    async function getScopedSelections() {
      if (body.selection_id) {
        const s = await base44.asServiceRole.entities.CustomerSelection.get(body.selection_id).catch(() => null);
        if (!s) return { ok: false, error: "Selection not found", status: 404 };
        return { ok: true, selections: [s] };
      }

      let scopedProjectId;
      if (body.area_id) {
        const area = await base44.asServiceRole.entities.ProjectArea.get(body.area_id).catch(() => null);
        if (!area) return { ok: false, error: "Area not found", status: 404 };
        scopedProjectId = area.project_id;
      } else if (body.project_id) {
        scopedProjectId = body.project_id;
      } else {
        return { ok: false, error: "selection_id, area_id, or project_id is required", status: 400 };
      }

      const filterKey = body.area_id ? "area_id" : "project_id";
      const filterVal = body.area_id ? body.area_id : scopedProjectId;
      const reqs = await base44.asServiceRole.entities.SelectionRequirement.filter(
        { [filterKey]: filterVal }, null, 1000
      );
      const reqIds = reqs.map(r => r.id);
      if (reqIds.length === 0) return { ok: true, selections: [] };

      const sels = await base44.asServiceRole.entities.CustomerSelection.filter(
        { project_id: scopedProjectId }, null, 1000
      );
      const scoped = sels.filter(s => s.is_current && reqIds.includes(s.requirement_id));
      return { ok: true, selections: scoped, project_id: scopedProjectId };
    }

    if (action === "request_signoff") {
      const scoped = await getScopedSelections();
      if (!scoped.ok) return Response.json({ error: scoped.error }, { status: scoped.status });
      const sels = scoped.selections;
      for (const s of sels) {
        const a = await verifyProjectAccess(s.project_id);
        if (!a.ok) return Response.json({ error: a.error }, { status: a.status });
      }
      // Idempotent: only request sign-off on selections that haven't been requested yet
      const approved = sels.filter(s => s.status === "Approved" && !s.signed_off && !s.sign_off_requested);
      let count = 0;
      for (const s of approved) {
        await base44.asServiceRole.entities.CustomerSelection.update(s.id, { sign_off_requested: true });
        await createAudit("selection", s.id, "sign_off_requested", "sign_off_requested", "false", "true",
          "Sign-off requested", s.project_id, { severity: 'medium' });
        count++;
      }
      const notifyProjectId = scoped.project_id || body.project_id;
      if (notifyProjectId && count > 0) {
        const project = await base44.asServiceRole.entities.Project.get(notifyProjectId).catch(() => null);
        if (project) {
          for (const cid of (project.assigned_customers || [])) {
            await base44.asServiceRole.entities.Notification.create({
              user_id: cid, project_id: notifyProjectId, type: "sign_off_request",
              title: "Sign-off requested", message: `Sign-off has been requested for ${count} selection(s) in ${project.name}.`,
              link: `/portal/project/${notifyProjectId}`
            });
          }
        }
      }
      return Response.json({ ok: true, count });
    }

    if (action === "lock") {
      const scoped = await getScopedSelections();
      if (!scoped.ok) return Response.json({ error: scoped.error }, { status: scoped.status });
      const sels = scoped.selections;
      for (const s of sels) {
        const a = await verifyProjectAccess(s.project_id);
        if (!a.ok) return Response.json({ error: a.error }, { status: a.status });
      }
      // Idempotent: only lock selections that aren't already locked
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
      const unlockAccess = await verifyProjectAccess(s.project_id);
      if (!unlockAccess.ok) return Response.json({ error: unlockAccess.error }, { status: unlockAccess.status });
      await base44.asServiceRole.entities.CustomerSelection.update(s.id, { locked: false, unlock_reason: body.reason });
      await createAudit("selection", s.id, "unlocked", "locked", "true", "false",
        body.reason, s.project_id, { severity: 'high', unlocked_by: actor });
      return Response.json({ ok: true });
    }

    // ==================== REPAIR DUPLICATE ALLOWANCE ENTRIES ====================
    if (action === "repair_selection_allowance") {
      const { project_id, requirement_id, selection_id } = body;
      if (!project_id) return Response.json({ error: "project_id required" }, { status: 400 });

      const access = await verifyProjectAccess(project_id);
      if (!access.ok) return Response.json({ error: access.error }, { status: access.status });

      // Find the current selection
      let targetSelection;
      if (selection_id) {
        targetSelection = await base44.asServiceRole.entities.CustomerSelection.get(selection_id).catch(() => null);
        if (!targetSelection) return Response.json({ error: "Selection not found" }, { status: 404 });
      } else if (requirement_id) {
        const allSels = await base44.asServiceRole.entities.CustomerSelection.filter({ requirement_id }, null, 100);
        targetSelection = allSels.find(s => s.is_current === true);
        if (!targetSelection) return Response.json({ error: "No current selection found for this requirement" }, { status: 404 });
      } else {
        return Response.json({ error: "requirement_id or selection_id required" }, { status: 400 });
      }

      // Find all approval ledger entries for this requirement
      const allLedger = await base44.asServiceRole.entities.AllowanceLedger.filter({
        project_id: targetSelection.project_id,
        requirement_id: targetSelection.requirement_id
      });

      const approvalEntries = allLedger.filter(entry =>
        entry.event_type === "Selection Approved" || entry.event_type === "Staff Override"
      ).sort((a, b) => (a.created_date || "").localeCompare(b.created_date || ""));

      // Identify duplicates (more than one approval entry)
      const duplicateEntries = approvalEntries.slice(1); // Keep the first, mark rest as duplicates
      const duplicateAmount = duplicateEntries.reduce((sum, entry) => sum + (entry.amount || 0), 0);

      // Create reversing entries for duplicates
      let correctionsCreated = 0;
      for (const dup of duplicateEntries) {
        await base44.asServiceRole.entities.AllowanceLedger.create({
          project_id: targetSelection.project_id,
          area_id: targetSelection.area_id,
          requirement_id: targetSelection.requirement_id,
          event_type: "Correction",
          amount: -(dup.amount || 0),
          running_balance: 0,
          description: `Reversal of duplicate approval entry (ID: ${dup.id})`,
          performed_by: actor
        });
        correctionsCreated++;
      }

      // Recalculate selection over/under allowance
      const price = targetSelection.calculated_price || 0;
      const allowance = targetSelection.allowance_amount || 0;
      const over = price > allowance ? price - allowance : 0;
      const under = price < allowance ? allowance - price : 0;

      if (over !== targetSelection.over_allowance || under !== targetSelection.under_allowance) {
        await base44.asServiceRole.entities.CustomerSelection.update(targetSelection.id, {
          over_allowance: over,
          under_allowance: under
        });
      }

      // Calculate corrected remaining allowance for the project
      const currentSels = await base44.asServiceRole.entities.CustomerSelection.filter({ project_id });
      const currentSelections = currentSels.filter(s => s.is_current === true);
      const selectedTotal = currentSelections.reduce((sum, s) => sum + (s.calculated_price || 0), 0);
      const project = access.project;
      const correctedRemaining = (project.total_allowance || 0) - selectedTotal;

      await createAudit("selection", targetSelection.id, "allowance_repaired", "over_allowance",
        targetSelection.over_allowance, over, `Corrected ${correctionsCreated} duplicate ledger entries`,
        project_id, { severity: 'high', duplicate_entries_found: correctionsCreated, duplicate_amount_reversed: duplicateAmount });

      return Response.json({
        ok: true,
        duplicate_ledger_entries_found: correctionsCreated,
        duplicate_amount_reversed: duplicateAmount,
        current_selected_total: selectedTotal,
        corrected_remaining_allowance: correctedRemaining
      });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});