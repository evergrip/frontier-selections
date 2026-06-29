import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    const event = payload.event || {};
    const data = payload.data || {};
    const oldData = payload.old_data || {};
    const entity = event.entity_name;
    const etype = event.type;
    const entityId = event.entity_id;

    async function staffIds() {
      const users = await base44.asServiceRole.entities.User.list();
      return users.filter(u => u.role === "admin" || u.role === "staff").map(u => u.id);
    }
    async function customerIds(projectId) {
      if (!projectId) return [];
      const p = await base44.asServiceRole.entities.Project.get(projectId);
      return p.assigned_customers || [];
    }
    async function ctx(projectId, areaId, reqId) {
      const [project, area, req] = await Promise.all([
        projectId ? base44.asServiceRole.entities.Project.get(projectId).catch(() => null) : Promise.resolve(null),
        areaId ? base44.asServiceRole.entities.ProjectArea.get(areaId).catch(() => null) : Promise.resolve(null),
        reqId ? base44.asServiceRole.entities.SelectionRequirement.get(reqId).catch(() => null) : Promise.resolve(null)
      ]);
      return { project, area, req };
    }
    function buildMsg(c, action) {
      return `Project: ${c.project?.name || ""} | Area: ${c.area?.name || ""} | Selection: ${c.req?.name || ""} | Action: ${action}`;
    }
    function staffLink(c) {
      if (c.req) return `/projects/${c.project?.id}/area/${c.area?.id}/requirement/${c.req.id}`;
      return `/projects/${c.project?.id || ""}`;
    }
    function custLink(c) {
      if (c.area) return `/portal/project/${c.project?.id}/area/${c.area.id}`;
      return `/portal/project/${c.project?.id || ""}`;
    }
    async function notifyStaff(projectId, areaId, reqId, type, title, action) {
      const c = await ctx(projectId, areaId, reqId);
      const ids = await staffIds();
      if (ids.length === 0) return;
      await base44.functions.invoke("sendNotifications", {
        user_ids: ids, project_id: projectId, type, title,
        message: buildMsg(c, action), link: staffLink(c)
      });
    }
    async function notifyCust(projectId, areaId, reqId, type, title, action) {
      const c = await ctx(projectId, areaId, reqId);
      const ids = await customerIds(projectId);
      if (ids.length === 0) return;
      await base44.functions.invoke("sendNotifications", {
        user_ids: ids, project_id: projectId, type, title,
        message: buildMsg(c, action), link: custLink(c)
      });
    }

    if (entity === "CustomerSelection") {
      if (etype === "create" && data.status === "Pending") {
        await notifyStaff(data.project_id, data.area_id, data.requirement_id, "selection_submitted", "New selection submitted", "Customer submitted a selection for review");
        if ((data.over_allowance || 0) > 0) {
          await notifyStaff(data.project_id, data.area_id, data.requirement_id, "over_allowance", "Selection over allowance", "A submitted selection is over the allowance");
        }
      } else if (etype === "update") {
        if (data.status === "Pending" && oldData.status && oldData.status !== "Pending") {
          await notifyStaff(data.project_id, data.area_id, data.requirement_id, "selection_revised", "Selection revised", "Customer revised a pending selection");
        }
        if ((data.over_allowance || 0) > 0 && (oldData.over_allowance || 0) === 0) {
          await notifyStaff(data.project_id, data.area_id, data.requirement_id, "over_allowance", "Selection over allowance", "A selection is over the allowance");
        }
      }
    } else if (entity === "ChangeRequest") {
      if (etype === "create") {
        await notifyStaff(data.project_id, data.area_id, data.requirement_id, "change_requested", "New change request", "Customer requested a change");
      } else if (etype === "update" && oldData.status !== data.status) {
        if (data.status === "Approved") await notifyCust(data.project_id, data.area_id, data.requirement_id, "change_approved", "Change request approved", "Staff approved your change request");
        else if (data.status === "Rejected") await notifyCust(data.project_id, data.area_id, data.requirement_id, "change_rejected", "Change request rejected", "Staff rejected your change request");
      }
    } else if (entity === "SelectionRequirement") {
      if (etype === "create") {
        await notifyCust(data.project_id, data.area_id, entityId, "selection_assigned", "New selection assigned", "A new selection has been assigned to you");
      } else if (etype === "update" && oldData.status !== data.status) {
        if (data.status === "Approved") await notifyCust(data.project_id, data.area_id, entityId, "selection_approved", "Selection approved", "Staff approved your selection");
        else if (data.status === "Rejected") await notifyCust(data.project_id, data.area_id, entityId, "selection_rejected", "Selection rejected", "Staff rejected your selection");
        else if (data.status === "Revision Requested") await notifyCust(data.project_id, data.area_id, entityId, "revision_requested", "Revision requested", "Staff requested a revision to your selection");
        else if (data.status === "Locked") await notifyCust(data.project_id, data.area_id, entityId, "selection_locked", "Selection locked", "Your selection has been locked");
      }
    } else if (entity === "ProcurementItem") {
      if (etype === "update" && oldData.status !== data.status && (data.status === "Backordered" || data.status === "Delayed")) {
        const c = await ctx(data.project_id, data.area_id, data.requirement_id);
        const ids = await staffIds();
        if (ids.length > 0) {
          await base44.functions.invoke("sendNotifications", {
            user_ids: ids, project_id: data.project_id, type: "procurement_delayed",
            title: `Procurement ${data.status.toLowerCase()}`,
            message: `Project: ${c.project?.name || ""} | Item: ${data.item_name || ""} | Action: Procurement item is ${data.status.toLowerCase()}`,
            link: `/procurement`
          });
        }
      }
    } else if (entity === "Project") {
      if (etype === "update") {
        const oldCust = (oldData.assigned_customers) || [];
        const newCust = (data.assigned_customers) || [];
        const added = newCust.filter(id => !oldCust.includes(id));
        if (added.length > 0) {
          const c = await ctx(entityId, null, null);
          await base44.functions.invoke("sendNotifications", {
            user_ids: added, project_id: entityId, type: "project_invited",
            title: "You've been invited to a project",
            message: `Project: ${c.project?.name || ""} | Action: You have been invited to this project`,
            link: `/portal/project/${entityId}`
          });
        }
      }
    }

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});