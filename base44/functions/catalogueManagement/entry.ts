import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin" && user.role !== "staff") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const action = body.action;
    const actor = user.full_name || user.email || "user";
    const now = new Date().toISOString();

    // ===== QUICK ADD: Create catalogue item with duplicate prevention =====
    if (action === "quick_add") {
      const { name, category, supplier, base_price, default_quantity, unit_of_measure, line_item_type, tax_status, parent_group, subgroup, ...rest } = body;

      if (!name || !name.trim()) return Response.json({ error: "Item name is required" }, { status: 400 });
      if (!category) return Response.json({ error: "Category is required" }, { status: 400 });

      // Duplicate detection: check by name + supplier, or by SKU
      const existingByName = await base44.asServiceRole.entities.CatalogueItem.filter({ name: name.trim() }, null, 10);
      const supplierMatch = existingByName.find(e =>
        (e.supplier || "").toLowerCase() === (supplier || "").toLowerCase()
      );
      if (supplierMatch) {
        return Response.json({
          error: "A catalogue item with this name and supplier already exists",
          duplicate: { id: supplierMatch.id, name: supplierMatch.name, supplier: supplierMatch.supplier }
        }, { status: 409 });
      }

      if (rest.sku && rest.sku.trim()) {
        const existingBySku = await base44.asServiceRole.entities.CatalogueItem.filter({ sku: rest.sku.trim() }, null, 5);
        if (existingBySku.length > 0) {
          return Response.json({
            error: "A catalogue item with this SKU already exists",
            duplicate: { id: existingBySku[0].id, name: existingBySku[0].name, sku: existingBySku[0].sku }
          }, { status: 409 });
        }
      }

      const newItem = await base44.asServiceRole.entities.CatalogueItem.create({
        name: name.trim(),
        category,
        supplier: supplier || "",
        base_price: Number(base_price || 0),
        default_quantity: Number(default_quantity || 1),
        unit_of_measure: unit_of_measure || "ea",
        line_item_type: line_item_type || "",
        tax_status: tax_status || "Taxable",
        taxable: tax_status !== "Non-Taxable",
        parent_group: parent_group || "",
        subgroup: subgroup || "",
        is_active: true,
        status: "Active",
        last_reviewed_date: now,
        ...rest
      });

      await base44.asServiceRole.entities.AuditLog.create({
        target_type: "catalogue_item", target_id: newItem.id, action: "quick_add",
        description: `Quick-added catalogue item "${newItem.name}"`,
        actor_user_id: user.id, actor_name: actor, actor_role: user.role,
        severity: "medium"
      }).catch(() => {});

      return Response.json({ ok: true, item: newItem });
    }

    // ===== DUPLICATE ITEM: Copy item + option groups + values + rules =====
    if (action === "duplicate_item") {
      const { source_item_id, name, ...overrides } = body;
      if (!source_item_id) return Response.json({ error: "source_item_id is required" }, { status: 400 });
      if (!name || !name.trim()) return Response.json({ error: "New item name is required" }, { status: 400 });

      const source = await base44.asServiceRole.entities.CatalogueItem.get(source_item_id).catch(() => null);
      if (!source) return Response.json({ error: "Source item not found" }, { status: 404 });

      // Duplicate detection on new name
      const existing = await base44.asServiceRole.entities.CatalogueItem.filter({ name: name.trim() }, null, 5);
      if (existing.length > 0) {
        return Response.json({
          error: "An item with this name already exists",
          duplicate: { id: existing[0].id, name: existing[0].name }
        }, { status: 409 });
      }

      // Create the new item (copy all fields from source, apply overrides)
      const { id, created_date, updated_date, created_by_id, ...sourceData } = source;
      const newItemData = {
        ...sourceData,
        name: name.trim(),
        is_active: true,
        status: "Active",
        is_discontinued: false,
        last_reviewed_date: now,
        ...overrides
      };
      const newItem = await base44.asServiceRole.entities.CatalogueItem.create(newItemData);

      // Copy option groups
      const groups = await base44.asServiceRole.entities.CatalogueOptionGroup.filter({ catalogue_item_id: source_item_id }, null, 500);
      const groupIdMap = {};

      for (const g of groups) {
        const { id: gid, created_date: gcd, updated_date: gud, ...gData } = g;
        const newGroup = await base44.asServiceRole.entities.CatalogueOptionGroup.create({
          ...gData, catalogue_item_id: newItem.id
        });
        groupIdMap[gid] = newGroup.id;

        // Copy option values for this group
        const values = await base44.asServiceRole.entities.CatalogueOptionValue.filter({ option_group_id: gid }, null, 500);
        const valueIdMap = {};
        for (const v of values) {
          const { id: vid, created_date: vcd, updated_date: vud, ...vData } = v;
          const newVal = await base44.asServiceRole.entities.CatalogueOptionValue.create({
            ...vData, catalogue_item_id: newItem.id, option_group_id: newGroup.id
          });
          valueIdMap[vid] = newVal.id;
        }

        // We can't remap unavailable_with_option_ids/required_with_option_ids right now
        // because they reference option value IDs from the source item.
        // A second pass would be needed to remap them — noted as a known limitation.
      }

      // Copy option rules
      const rules = await base44.asServiceRole.entities.CatalogueOptionRule.filter({ catalogue_item_id: source_item_id }, null, 500);
      for (const r of rules) {
        const { id: rid, created_date: rcd, updated_date: rud, ...rData } = r;
        await base44.asServiceRole.entities.CatalogueOptionRule.create({
          ...rData,
          catalogue_item_id: newItem.id,
          condition_group_id: groupIdMap[r.condition_group_id] || "",
          target_group_id: groupIdMap[r.target_group_id] || ""
          // Note: condition_option_value_id and target_option_value_id would need remapping
          // This is a known limitation — rules referencing specific option values may need manual fixing
        });
      }

      await base44.asServiceRole.entities.AuditLog.create({
        target_type: "catalogue_item", target_id: newItem.id, action: "duplicate_item",
        description: `Duplicated catalogue item from "${source.name}" to "${newItem.name}"`,
        actor_user_id: user.id, actor_name: actor, actor_role: user.role,
        severity: "medium"
      }).catch(() => {});

      return Response.json({ ok: true, item: newItem });
    }

    // ===== BULK EDIT: Update multiple items =====
    if (action === "bulk_edit") {
      const { item_ids, updates } = body;
      if (!item_ids || !Array.isArray(item_ids) || item_ids.length === 0) {
        return Response.json({ error: "item_ids array is required" }, { status: 400 });
      }
      if (!updates || Object.keys(updates).length === 0) {
        return Response.json({ error: "updates object is required" }, { status: 400 });
      }

      // Filter to allowed fields only
      const allowedFields = [
        "supplier", "category", "parent_group", "subgroup", "cost_code",
        "markup", "markup_type", "line_item_type", "tax_status", "is_active",
        "tags", "brand", "collection", "cost_type"
      ];
      const cleanUpdates = {};
      for (const key of allowedFields) {
        if (key in updates) cleanUpdates[key] = updates[key];
      }
      if (cleanUpdates.tax_status) {
        cleanUpdates.taxable = cleanUpdates.tax_status === "Taxable";
      }

      if (Object.keys(cleanUpdates).length === 0) {
        return Response.json({ error: "No valid fields to update" }, { status: 400 });
      }

      const results = [];
      for (const itemId of item_ids) {
        try {
          await base44.asServiceRole.entities.CatalogueItem.update(itemId, cleanUpdates);
          results.push({ id: itemId, ok: true });
        } catch (e) {
          results.push({ id: itemId, ok: false, error: e.message });
        }
      }

      await base44.asServiceRole.entities.AuditLog.create({
        target_type: "catalogue_item", target_id: "bulk", action: "bulk_edit",
        description: `Bulk edited ${item_ids.length} catalogue items. Fields: ${Object.keys(cleanUpdates).join(", ")}`,
        actor_user_id: user.id, actor_name: actor, actor_role: user.role,
        severity: "medium"
      }).catch(() => {});

      return Response.json({ ok: true, results, updated_count: results.filter(r => r.ok).length });
    }

    // ===== ASSIGN TO PROJECT: Create ProjectAvailableCatalogueItem with duplicate check =====
    if (action === "assign_to_project") {
      const { project_id, catalogue_item_id, area_id, requirement_id, display_order, is_recommended, customer_note, staff_note, price_override, custom_allowance } = body;

      if (!project_id || !catalogue_item_id) {
        return Response.json({ error: "project_id and catalogue_item_id are required" }, { status: 400 });
      }

      // Verify project exists
      const project = await base44.asServiceRole.entities.Project.get(project_id).catch(() => null);
      if (!project) return Response.json({ error: "Project not found" }, { status: 404 });

      // Verify catalogue item exists
      const catItem = await base44.asServiceRole.entities.CatalogueItem.get(catalogue_item_id).catch(() => null);
      if (!catItem) return Response.json({ error: "Catalogue item not found" }, { status: 404 });

      // DUPLICATE CHECK: same catalogue_item_id + project_id + requirement_id (if specified)
      const filter = { project_id, catalogue_item_id };
      if (requirement_id) filter.requirement_id = requirement_id;
      if (area_id) filter.area_id = area_id;

      const existing = await base44.asServiceRole.entities.ProjectAvailableCatalogueItem.filter(filter, null, 5);
      if (existing.length > 0) {
        return Response.json({
          ok: true,
          already_assigned: true,
          assignment: existing[0],
          message: "This item is already assigned to this project/area/requirement"
        });
      }

      const assignment = await base44.asServiceRole.entities.ProjectAvailableCatalogueItem.create({
        project_id,
        catalogue_item_id,
        area_id: area_id || null,
        requirement_id: requirement_id || null,
        display_order: display_order || 0,
        is_recommended: is_recommended || false,
        customer_note: customer_note || "",
        staff_note: staff_note || "",
        price_override: price_override != null ? price_override : null,
        custom_allowance: custom_allowance != null ? custom_allowance : null,
        is_available: true,
        created_by: actor
      });

      return Response.json({ ok: true, assignment, already_assigned: false });
    }

    // ===== BULK ASSIGN: Assign multiple items at once =====
    if (action === "bulk_assign") {
      const { project_id, catalogue_item_ids, area_id, requirement_id } = body;
      if (!project_id || !catalogue_item_ids || !Array.isArray(catalogue_item_ids)) {
        return Response.json({ error: "project_id and catalogue_item_ids array are required" }, { status: 400 });
      }

      const results = [];
      for (let i = 0; i < catalogue_item_ids.length; i++) {
        const catId = catalogue_item_ids[i];
        const filter = { project_id, catalogue_item_id: catId };
        if (requirement_id) filter.requirement_id = requirement_id;
        if (area_id) filter.area_id = area_id;

        const existing = await base44.asServiceRole.entities.ProjectAvailableCatalogueItem.filter(filter, null, 5);
        if (existing.length > 0) {
          results.push({ catalogue_item_id: catId, ok: true, already_assigned: true });
          continue;
        }

        try {
          await base44.asServiceRole.entities.ProjectAvailableCatalogueItem.create({
            project_id, catalogue_item_id: catId,
            area_id: area_id || null, requirement_id: requirement_id || null,
            display_order: i, is_available: true, created_by: actor
          });
          results.push({ catalogue_item_id: catId, ok: true, already_assigned: false });
        } catch (e) {
          results.push({ catalogue_item_id: catId, ok: false, error: e.message });
        }
      }

      return Response.json({
        ok: true,
        results,
        assigned_count: results.filter(r => r.ok && !r.already_assigned).length,
        skipped_count: results.filter(r => r.already_assigned).length
      });
    }

    // ===== DASHBOARD STATS: Get catalogue dashboard statistics =====
    if (action === "dashboard_stats") {
      const items = await base44.asServiceRole.entities.CatalogueItem.list("-updated_date", 2000);
      const groups = await base44.asServiceRole.entities.CatalogueOptionGroup.filter({ is_active: true }, null, 2000);
      const assignments = await base44.asServiceRole.entities.ProjectAvailableCatalogueItem.list(null, 2000);

      const assignedItemIds = new Set(assignments.map(a => a.catalogue_item_id));
      const itemsWithGroups = new Set(groups.map(g => g.catalogue_item_id));

      const stats = {
        total_active: items.filter(i => i.is_active !== false && i.status === "Active").length,
        inactive_discontinued: items.filter(i => i.is_discontinued || ["Inactive", "Discontinued"].includes(i.status)).length,
        missing_pricing: items.filter(i => !i.base_price || i.base_price === 0).length,
        missing_bt_fields: items.filter(i => !i.cost_code || !i.line_item_type || !i.tax_status || !i.parent_group || !i.subgroup).length,
        missing_images: items.filter(i => !i.default_image).length,
        incomplete_option_groups: items.filter(i => !itemsWithGroups.has(i.id) && i.category !== "Other").length,
        not_assigned_to_any_project: items.filter(i => !assignedItemIds.has(i.id)).length,
        recently_updated: items.slice(0, 10),
        needing_review: items.filter(i => !i.last_reviewed_date || (new Date(i.last_reviewed_date) < new Date(Date.now() - 90 * 24 * 60 * 60 * 1000))).slice(0, 20)
      };

      return Response.json({ ok: true, stats });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});