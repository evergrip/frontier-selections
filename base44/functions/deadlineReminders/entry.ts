import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const today = new Date(); today.setHours(0, 0, 0, 0);

    async function staffIds() {
      const users = await base44.asServiceRole.entities.User.list();
      return users.filter(u => u.role === "admin" || u.role === "staff").map(u => u.id);
    }
    async function customerIds(projectId) {
      if (!projectId) return [];
      const p = await base44.asServiceRole.entities.Project.get(projectId).catch(() => null);
      return p?.assigned_customers || [];
    }
    async function notify(userIds, projectId, type, title, message, link) {
      if (!userIds || userIds.length === 0) return;
      await base44.functions.invoke("sendNotifications", { user_ids: userIds, project_id: projectId, type, title, message, link });
    }
    function stageFor(diff) {
      if (diff === 7) return "7";
      if (diff === 3) return "3";
      if (diff === 1) return "1";
      if (diff === 0) return "due";
      if (diff < 0) return "overdue";
      return null;
    }
    function diffDays(dueStr) {
      const due = new Date(dueStr + "T00:00:00");
      return Math.round((due - today) / 86400000);
    }

    const DONE = ["Approved", "Locked", "Ready to Order", "Ordered", "Received", "Installed"];

    // Requirements
    const reqs = await base44.asServiceRole.entities.SelectionRequirement.list(null, 1000);
    for (const req of reqs) {
      if (!req.due_date) continue;
      if (DONE.includes(req.status)) continue;
      const stage = stageFor(diffDays(req.due_date));
      if (!stage || req.reminder_stage === stage) continue;
      const [project, area] = await Promise.all([
        base44.asServiceRole.entities.Project.get(req.project_id).catch(() => null),
        req.area_id ? base44.asServiceRole.entities.ProjectArea.get(req.area_id).catch(() => null) : Promise.resolve(null)
      ]);
      const msg = `Project: ${project?.name || ""} | Area: ${area?.name || ""} | Selection: ${req.name} | Due: ${req.due_date}`;
      const custIds = await customerIds(req.project_id);
      if (stage === "overdue") {
        await notify(custIds, req.project_id, "deadline_overdue", "Selection overdue", msg + " | Action: Your selection is overdue", `/portal/project/${req.project_id}/area/${req.area_id}`);
        const sIds = await staffIds();
        await notify(sIds, req.project_id, "deadline_missed", "Selection deadline missed", msg + " | Action: Customer selection is overdue", `/projects/${req.project_id}/area/${req.area_id}/requirement/${req.id}`);
      } else {
        await notify(custIds, req.project_id, "deadline_reminder", "Selection due soon", msg + " | Action: Complete your selection before the deadline", `/portal/project/${req.project_id}/area/${req.area_id}`);
      }
      await base44.asServiceRole.entities.SelectionRequirement.update(req.id, { reminder_stage: stage });
    }

    // Areas
    const areas = await base44.asServiceRole.entities.ProjectArea.list(null, 1000);
    for (const area of areas) {
      if (!area.due_date) continue;
      const stage = stageFor(diffDays(area.due_date));
      if (!stage || area.reminder_stage === stage) continue;
      const project = await base44.asServiceRole.entities.Project.get(area.project_id).catch(() => null);
      const msg = `Project: ${project?.name || ""} | Area: ${area.name} | Due: ${area.due_date}`;
      const custIds = await customerIds(area.project_id);
      await notify(custIds, area.project_id, "area_deadline", "Area selections due soon", msg + " | Action: Complete selections for this area", `/portal/project/${area.project_id}/area/${area.id}`);
      await base44.asServiceRole.entities.ProjectArea.update(area.id, { reminder_stage: stage });
    }

    // Projects
    const projects = await base44.asServiceRole.entities.Project.list(null, 1000);
    for (const project of projects) {
      if (!project.selections_due_date) continue;
      const stage = stageFor(diffDays(project.selections_due_date));
      if (!stage || project.reminder_stage === stage) continue;
      const msg = `Project: ${project.name} | Selections due: ${project.selections_due_date}`;
      const custIds = await customerIds(project.id);
      await notify(custIds, project.id, "project_deadline", "Project selections due soon", msg + " | Action: Complete your selections", `/portal/project/${project.id}`);
      await base44.asServiceRole.entities.Project.update(project.id, { reminder_stage: stage });
    }

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});