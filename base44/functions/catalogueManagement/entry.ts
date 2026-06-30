import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// In-memory idempotency cache (survives within same isolate, handles rapid double-clicks)
const idempotencyCache = new Map();
const IDEMPOTENCY_TTL = 60000;

function checkIdempotency(requestId) {
  if (!requestId) return null;
  const entry = idempotencyCache.get(requestId);
  if (entry && Date.now() - entry.ts < IDEMPOTENCY_TTL) return entry.res;
  if (entry) idempotencyCache.delete(requestId);
  return null;
}

function storeIdempotency(requestId, res) {
  if (!requestId) return;
  idempotencyCache.set(requestId, { res, ts: Date.now() });
  if (idempotencyCache.size > 200) {
    const now = Date.now();
    for (const [k, v] of idempotencyCache) {
      if (now - v.ts > IDEMPOTENCY_TTL) idempotencyCache.delete(k);
    }
  }
}

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

    // Idempotency check — return cached response for duplicate request_id
    const cached = checkIdempotency(body.request_id);
    if (cached) return Response.json(cached);

    // ===== Shared: verify project access =====
    async function verifyProjectAccess(projectId) {
      if (!projectId) return { ok: false, error: "project_id required", status: 400 };
      const project = await base44.asServiceRole.entities.Project.get(projectId).catch(() => null);
      if (!project) return { ok: false, error: "Project not found", status: 404 };
      if (user.role === "admin") return { ok: true, project };
      const perms = user.permissions || [];
      if (perms.includes("view_all_projects") || perms.includes("manage_catalogue")) {
        return { ok: true, project };
      }
      const assigned = project.assigned_staff || [];
      if (!assigned.includes(user.id) && !assigned.includes(user.email)) {
        return { ok: false, error: "Forbidden - project not assigned", status: 403 };
      }
      return { ok: true, project };
    }

    // ===== QUICK ADD =====
    if (action === "quick_add") {
      const { name, category, supplier, base_price, default_quantity, unit_of_measure, line_item_type, tax_status, parent_group, subgroup, ...rest } = body;

      if (!name || !name.trim()) return Response.json({ error: "Item name is required" }, { status: 400 });
      if (!category) return Response.json({ error: "Category is required" }, { status: 400 });

      // Duplicate detection: name + supplier, or SKU
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
        name: name.trim(), category, supplier: supplier || "",
        base_price: Number(base_price || 0), default_quantity: Number(default_quantity || 1),
        unit_of_measure: unit_of_measure || "ea", line_item_type: line_item_type || "",
        tax_status: tax_status || "Taxable", taxable: tax_status !== "Non-Taxable",
        parent_group: parent_group || "", subgroup: subgroup || "",
        is_active: true, status: "Active", last_reviewed_date: now,
        ...rest
      });

      await base44.asServiceRole.entities.AuditLog.create({
        target_type: "catalogue_item", target_id: newItem.id, action: "quick_add",
        description: `Quick-added catalogue item "${newItem.name}"`,
        actor_user_id: user.id, actor_name: actor, actor_role: user.role, severity: "medium"
      }).catch(() => {});

      const response = { ok: true, item: newItem };
      storeIdempotency(body.request_id, response);
      return Response.json(response);
    }

    // ===== DUPLICATE ITEM =====
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

      const { id, created_date, updated_date, created_by_id, ...sourceData } = source;
      const newItemData = {
        ...sourceData, name: name.trim(),
        is_active: true, status: "Active", is_discontinued: false,
        last_reviewed_date: now, ...overrides
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

        const values = await base44.asServiceRole.entities.CatalogueOptionValue.filter({ option_group_id: gid }, null, 500);
        for (const v of values) {
          const { id: vid, created_date: vcd, updated_date: vud, ...vData } = v;
          await base44.asServiceRole.entities.CatalogueOptionValue.create({
            ...vData, catalogue_item_id: newItem.id, option_group_id: newGroup.id
          });
        }
      }

      // Copy option rules
      const rules = await base44.asServiceRole.entities.CatalogueOptionRule.filter({ catalogue_item_id: source_item_id }, null, 500);
      for (const r of rules) {
        const { id: rid, created_date: rcd, updated_date: rud, ...rData } = r;
        await base44.asServiceRole.entities.CatalogueOptionRule.create({
          ...rData, catalogue_item_id: newItem.id,
          condition_group_id: groupIdMap[r.condition_group_id] || "",
          target_group_id: groupIdMap[r.target_group_id] || ""
        });
      }

      await base44.asServiceRole.entities.AuditLog.create({
        target_type: "catalogue_item", target_id: newItem.id, action: "duplicate_item",
        description: `Duplicated catalogue item from "${source.name}" to "${newItem.name}"`,
        actor_user_id: user.id, actor_name: actor, actor_role: user.role, severity: "medium"
      }).catch(() => {});

      const response = { ok: true, item: newItem };
      storeIdempotency(body.request_id, response);
      return Response.json(response);
    }

    // ===== BULK EDIT =====
    if (action === "bulk_edit") {
      const { item_ids, updates } = body;
      if (!item_ids || !Array.isArray(item_ids) || item_ids.length === 0) {
        return Response.json({ error: "item_ids array is required" }, { status: 400 });
      }
      if (!updates || Object.keys(updates).length === 0) {
        return Response.json({ error: "updates object is required" }, { status: 400 });
      }

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
        actor_user_id: user.id, actor_name: actor, actor_role: user.role, severity: "medium"
      }).catch(() => {});

      return Response.json({ ok: true, results, updated_count: results.filter(r => r.ok).length });
    }

    // ===== ASSIGN TO PROJECT (with project access verification) =====
    if (action === "assign_to_project") {
      const { project_id, catalogue_item_id, area_id, requirement_id, display_order, is_recommended, customer_note, staff_note, price_override, custom_allowance } = body;

      if (!project_id || !catalogue_item_id) {
        return Response.json({ error: "project_id and catalogue_item_id are required" }, { status: 400 });
      }

      const access = await verifyProjectAccess(project_id);
      if (!access.ok) return Response.json({ error: access.error }, { status: access.status });

      const catItem = await base44.asServiceRole.entities.CatalogueItem.get(catalogue_item_id).catch(() => null);
      if (!catItem) return Response.json({ error: "Catalogue item not found" }, { status: 404 });

      // Duplicate check: same catalogue_item_id + project_id + requirement_id
      const filter = { project_id, catalogue_item_id };
      if (requirement_id) filter.requirement_id = requirement_id;
      if (area_id) filter.area_id = area_id;

      const existing = await base44.asServiceRole.entities.ProjectAvailableCatalogueItem.filter(filter, null, 5);
      if (existing.length > 0) {
        const response = {
          ok: true, already_assigned: true, assignment: existing[0],
          message: "This item is already assigned to this project/area/requirement"
        };
        storeIdempotency(body.request_id, response);
        return Response.json(response);
      }

      const assignment = await base44.asServiceRole.entities.ProjectAvailableCatalogueItem.create({
        project_id, catalogue_item_id,
        area_id: area_id || null, requirement_id: requirement_id || null,
        display_order: display_order || 0, is_recommended: is_recommended || false,
        customer_note: customer_note || "", staff_note: staff_note || "",
        price_override: price_override != null ? price_override : null,
        custom_allowance: custom_allowance != null ? custom_allowance : null,
        is_available: true, created_by: actor
      });

      const response = { ok: true, assignment, already_assigned: false };
      storeIdempotency(body.request_id, response);
      return Response.json(response);
    }

    // ===== BULK ASSIGN (with project access verification) =====
    if (action === "bulk_assign") {
      const { project_id, catalogue_item_ids, area_id, requirement_id } = body;
      if (!project_id || !catalogue_item_ids || !Array.isArray(catalogue_item_ids)) {
        return Response.json({ error: "project_id and catalogue_item_ids array are required" }, { status: 400 });
      }

      const access = await verifyProjectAccess(project_id);
      if (!access.ok) return Response.json({ error: access.error }, { status: access.status });

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

      const response = {
        ok: true, results,
        assigned_count: results.filter(r => r.ok && !r.already_assigned).length,
        skipped_count: results.filter(r => r.already_assigned).length
      };
      storeIdempotency(body.request_id, response);
      return Response.json(response);
    }

    // ===== ARCHIVE: Safe soft-delete — sets Inactive, preserves all history =====
    if (action === "archive") {
      const { item_ids } = body;
      if (!item_ids || !Array.isArray(item_ids) || item_ids.length === 0) {
        return Response.json({ error: "item_ids array is required" }, { status: 400 });
      }

      const updates = { is_active: false, status: "Inactive" };
      const results = [];
      for (const itemId of item_ids) {
        try {
          await base44.asServiceRole.entities.CatalogueItem.update(itemId, updates);
          results.push({ id: itemId, ok: true });
        } catch (e) {
          results.push({ id: itemId, ok: false, error: e.message });
        }
      }

      await base44.asServiceRole.entities.AuditLog.create({
        target_type: "catalogue_item", target_id: "bulk", action: "archive",
        description: `Archived ${results.filter(r => r.ok).length} catalogue items (set to Inactive)`,
        actor_user_id: user.id, actor_name: actor, actor_role: user.role, severity: "medium"
      }).catch(() => {});

      return Response.json({ ok: true, results, archived_count: results.filter(r => r.ok).length });
    }

    // ===== DISCONTINUE: Marks item as discontinued, preserves all history =====
    if (action === "discontinue") {
      const { item_ids } = body;
      if (!item_ids || !Array.isArray(item_ids) || item_ids.length === 0) {
        return Response.json({ error: "item_ids array is required" }, { status: 400 });
      }

      const updates = { is_active: false, is_discontinued: true, status: "Discontinued" };
      const results = [];
      for (const itemId of item_ids) {
        try {
          await base44.asServiceRole.entities.CatalogueItem.update(itemId, updates);
          results.push({ id: itemId, ok: true });
        } catch (e) {
          results.push({ id: itemId, ok: false, error: e.message });
        }
      }

      await base44.asServiceRole.entities.AuditLog.create({
        target_type: "catalogue_item", target_id: "bulk", action: "discontinue",
        description: `Discontinued ${results.filter(r => r.ok).length} catalogue items`,
        actor_user_id: user.id, actor_name: actor, actor_role: user.role, severity: "medium"
      }).catch(() => {});

      return Response.json({ ok: true, results, discontinued_count: results.filter(r => r.ok).length });
    }

    // ===== BULK DELETE: Admin-only, requires reason, checks references before hard delete =====
    if (action === "bulk_delete") {
      if (user.role !== "admin") {
        return Response.json({
          error: "Hard delete is admin-only. Use archive or discontinue for a safer alternative that preserves history."
        }, { status: 403 });
      }

      const { item_ids, reason } = body;
      if (!item_ids || !Array.isArray(item_ids) || item_ids.length === 0) {
        return Response.json({ error: "item_ids array is required" }, { status: 400 });
      }
      if (!reason || !reason.trim()) {
        return Response.json({ error: "A reason is required for hard delete" }, { status: 400 });
      }

      const results = [];
      for (const itemId of item_ids) {
        try {
          // Check references before deleting
          const [selections, procurement, substitutions, assignments] = await Promise.all([
            base44.asServiceRole.entities.CustomerSelection.filter({ catalogue_item_id: itemId }, null, 1),
            base44.asServiceRole.entities.ProcurementItem.filter({ catalogue_item_id: itemId }, null, 1),
            base44.asServiceRole.entities.SubstitutionRecommendation.filter({ original_item_id: itemId }, null, 1),
            base44.asServiceRole.entities.ProjectAvailableCatalogueItem.filter({ catalogue_item_id: itemId }, null, 1)
          ]);

          const refs = [];
          if (selections.length > 0) refs.push(`${selections.length}+ selection(s)`);
          if (procurement.length > 0) refs.push(`${procurement.length}+ procurement item(s)`);
          if (substitutions.length > 0) refs.push(`${substitutions.length}+ substitution(s)`);
          if (assignments.length > 0) refs.push(`${assignments.length}+ project assignment(s)`);

          if (refs.length > 0) {
            results.push({
              id: itemId, ok: false,
              error: `Cannot hard delete: item is referenced by ${refs.join(", ")}. Use archive or discontinue instead.`
            });
            continue;
          }

          // Safe to delete — remove child entities first
          await base44.asServiceRole.entities.CatalogueOptionValue.deleteMany({ catalogue_item_id: itemId }).catch(() => {});
          await base44.asServiceRole.entities.CatalogueOptionGroup.deleteMany({ catalogue_item_id: itemId }).catch(() => {});
          await base44.asServiceRole.entities.CatalogueOptionRule.deleteMany({ catalogue_item_id: itemId }).catch(() => {});
          await base44.asServiceRole.entities.CatalogueItem.delete(itemId);
          results.push({ id: itemId, ok: true });
        } catch (e) {
          results.push({ id: itemId, ok: false, error: e.message });
        }
      }

      await base44.asServiceRole.entities.AuditLog.create({
        target_type: "catalogue_item", target_id: "bulk", action: "bulk_delete",
        description: `Hard deleted ${results.filter(r => r.ok).length} catalogue items. Reason: ${reason}`,
        actor_user_id: user.id, actor_name: actor, actor_role: user.role,
        severity: "high", reason: reason.trim()
      }).catch(() => {});

      const response = { ok: true, results, deleted_count: results.filter(r => r.ok).length };
      storeIdempotency(body.request_id, response);
      return Response.json(response);
    }

    // ===== BULK STATUS: Activate / deactivate / discontinue =====
    if (action === "bulk_status") {
      const { item_ids, status } = body;
      if (!item_ids || !Array.isArray(item_ids) || item_ids.length === 0) {
        return Response.json({ error: "item_ids array is required" }, { status: 400 });
      }
      if (!["activate", "deactivate", "discontinue"].includes(status)) {
        return Response.json({ error: "status must be activate, deactivate, or discontinue" }, { status: 400 });
      }

      const updates = status === "activate"
        ? { is_active: true, is_discontinued: false, status: "Active" }
        : status === "deactivate"
        ? { is_active: false, status: "Inactive" }
        : { is_active: false, is_discontinued: true, status: "Discontinued" };

      const results = [];
      for (const itemId of item_ids) {
        try {
          await base44.asServiceRole.entities.CatalogueItem.update(itemId, updates);
          results.push({ id: itemId, ok: true });
        } catch (e) {
          results.push({ id: itemId, ok: false, error: e.message });
        }
      }

      await base44.asServiceRole.entities.AuditLog.create({
        target_type: "catalogue_item", target_id: "bulk", action: "bulk_status",
        description: `Bulk ${status} ${results.filter(r => r.ok).length} catalogue items`,
        actor_user_id: user.id, actor_name: actor, actor_role: user.role, severity: "medium"
      }).catch(() => {});

      return Response.json({ ok: true, results, updated_count: results.filter(r => r.ok).length });
    }

    // ===== MARK REVIEWED =====
    if (action === "mark_reviewed") {
      const { item_ids } = body;
      if (!item_ids || !Array.isArray(item_ids) || item_ids.length === 0) {
        return Response.json({ error: "item_ids array is required" }, { status: 400 });
      }

      const results = [];
      for (const itemId of item_ids) {
        try {
          await base44.asServiceRole.entities.CatalogueItem.update(itemId, { last_reviewed_date: now });
          results.push({ id: itemId, ok: true });
        } catch (e) {
          results.push({ id: itemId, ok: false, error: e.message });
        }
      }

      return Response.json({ ok: true, updated_count: results.filter(r => r.ok).length });
    }

    // ===== DASHBOARD STATS =====
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