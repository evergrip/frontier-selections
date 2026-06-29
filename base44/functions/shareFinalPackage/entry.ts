import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user || (user.role !== "admin" && user.role !== "staff")) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    const { project_id } = await req.json();
    const project = await base44.asServiceRole.entities.Project.get(project_id);
    const custIds = project.assigned_customers || [];
    if (custIds.length === 0) return Response.json({ sent: 0, error: "No customers assigned to this project" });
    const users = await base44.asServiceRole.entities.User.list();
    const emails = users.filter(u => custIds.includes(u.id) && u.email).map(u => u.email);
    if (emails.length === 0) return Response.json({ sent: 0, error: "No customer emails found" });
    const origin = new URL(req.url).origin;
    const link = `${origin}/portal/project/${project_id}/final-package`;
    for (const email of emails) {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: email,
        subject: `Final Selections Package ready — ${project.name}`,
        body: `Your final selections package for ${project.name} is ready to view.\n\nOpen it here: ${link}\n\nFrontier Building Group`
      });
    }
    return Response.json({ sent: emails.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});