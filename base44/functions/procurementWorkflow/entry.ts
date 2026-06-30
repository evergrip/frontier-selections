import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.active === false) return Response.json({ error: "Account deactivated" }, { status: 403 });

    const isStaff = user.role === "admin" || user.role === "staff";
    if (!isStaff) {
      return Response.json({ error: "Forbidden - staff access required" }, { status: 403 });
    }

    const body = await req.json();
    const action = body.action;
    const itemIds = body.item_ids || [];
    const requestId = body.request_id || null;
    const now = new Date().toISOString();
    const today = now.slice(0, 10);
    const actor = user.full_name || user.email || "user";

    // Idempotency: if request_id was seen before, return cached result
    if (requestId) {
      const existing = await base44.asServiceRole.entities.AuditLog.filter({
        target_type: "procurement_bulk",
        reason: `request_id:${requestId}`
      }).catch(() => []);
      if (existing && existing.length > 0) {
        return Response.json({
          idempotent: true,
          message: "This request was already processed",
          updated_count: 0,
          failed: []
        });
      }
    }

    if (!itemIds.length) {
      return Response.json({ error: "No item IDs provided" }, { status: 400 });
    }

    // ==================== ACCESS VERIFICATION ====================
    async function verifyProjectAccess(projectId) {
      if (!projectId) return { ok: true };
      const project = await base44.asServiceRole.entities.Project.get(projectId).catch(() => null);
      if (!project) return { ok: false, error: "Project not found" };
      if (user.role === "admin") return { ok: true, project };
      const perms = user.permissions || [];
      const hasViewAll = perms.includes("view_all_projects");
      if (hasViewAll) return { ok: true, project };
      const assigned = project.assigned_staff || [];
      if (!assigned.includes(user.id) && !assigned.includes(user.email)) {
        return { ok: false, error: "Forbidden - project not assigned" };
      }
      return { ok: true, project };
    }

    async function createAudit(targetType, targetId, auditAction, field, oldValue, newValue, projectId, extra = {}) {
      await base44.asServiceRole.entities.AuditLog.create({
        target_type: targetType,
        target_id: targetId,
        action: auditAction,
        action_type: auditAction,
        field: field || null,
        old_value: oldValue != null ? String(oldValue) : null,
        new_value: newValue != null ? String(newValue) : null,
        changed_by: actor,
        actor_user_id: user.id,
        actor_name: actor,
        actor_role: user.role,
        project_id: projectId || null,
        severity: extra.severity || "medium",
        ...extra
      }).catch(() => {});
    }

    // ==================== LOAD ALL ITEMS ====================
    const items = [];
    for (const id of itemIds) {
      const item = await base44.asServiceRole.entities.ProcurementItem.get(id).catch(() => null);
      if (item) {
        items.push(item);
      }
    }

    if (items.length === 0) {
      return Response.json({ error: "No valid procurement items found" }, { status: 404 });
    }

    // Verify project access for all items
    const projectIds = [...new Set(items.map(i => i.project_id).filter(Boolean))];
    for (const pid of projectIds) {
      const access = await verifyProjectAccess(pid);
      if (!access.ok) {
        return Response.json({ error: access.error }, { status: 403 });
      }
    }

    // ==================== ACTION HANDLERS ====================
    const STATUS_ACTION_MAP = {
      bulk_mark_ordered: { status: "Ordered", dateField: "order_date" },
      bulk_mark_received: { status: "Received", dateField: "actual_received_date" },
      bulk_mark_delivered_to_site: { status: "Delivered to Site", dateField: "delivered_to_site_date" },
      bulk_mark_installed: { status: "Installed", dateField: "installed_date" },
    };

    const FIELD_ACTION_MAP = {
      bulk_set_supplier: "supplier",
      bulk_set_expected_delivery_date: "expected_delivery_date",
    };

    const succeeded = [];
    const failed = [];

    if (action in STATUS_ACTION_MAP) {
      const config = STATUS_ACTION_MAP[action];
      const newValue = config.status;
      const dateValue = today;

      for (const item of items) {
        try {
          const oldStatus = item.status;
          const updateData = { status: newValue, [config.dateField]: dateValue };
          await base44.asServiceRole.entities.ProcurementItem.update(item.id, updateData);
          succeeded.push(item.id);
          await createAudit(
            "procurement", item.id, action, "status",
            oldStatus, newValue, item.project_id,
            { description: `Bulk marked ${item.item_name || item.id} as ${newValue}`, severity: "medium" }
          );
        } catch (e) {
          failed.push({ id: item.id, error: e.message });
        }
      }
    } else if (action in FIELD_ACTION_MAP) {
      const field = FIELD_ACTION_MAP[action];
      const value = body.value;
      if (value == null || value === "") {
        return Response.json({ error: `Missing value for ${action}` }, { status: 400 });
      }

      for (const item of items) {
        try {
          const oldValue = item[field];
          await base44.asServiceRole.entities.ProcurementItem.update(item.id, { [field]: value });
          succeeded.push(item.id);
          await createAudit(
            "procurement", item.id, action, field,
            oldValue, value, item.project_id,
            { description: `Bulk set ${field} on ${item.item_name || item.id}`, severity: "low" }
          );
        } catch (e) {
          failed.push({ id: item.id, error: e.message });
        }
      }
    } else {
      return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    // Log the bulk operation itself for idempotency tracking
    if (requestId) {
      await createAudit(
        "procurement_bulk", requestId, action, null,
        null, `${succeeded.length} items updated`, projectIds[0] || null,
        { description: `Bulk action ${action} on ${succeeded.length} items`, reason: `request_id:${requestId}`, severity: "medium" }
      );
    }

    return Response.json({
      action,
      updated_count: succeeded.length,
      failed,
      request_id: requestId || null
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});