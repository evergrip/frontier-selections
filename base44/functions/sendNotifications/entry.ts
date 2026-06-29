import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { user_ids, project_id, type, title, message, link } = await req.json();
    if (!user_ids || user_ids.length === 0) return Response.json({ sent: 0 });
    const users = await base44.asServiceRole.entities.User.list();
    const targets = users.filter(u => user_ids.includes(u.id));
    let sent = 0;
    for (const u of targets) {
      try {
        await base44.asServiceRole.entities.Notification.create({
          user_id: u.id,
          project_id: project_id || null,
          type: type || "general",
          title: title || "Notification",
          message: message || "",
          link: link || "",
          is_read: false
        });
        if (u.email) {
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: u.email,
            subject: title || "Notification",
            body: (message || "") + (link ? `\n\nOpen: ${link}` : "")
          });
        }
        sent++;
      } catch (e) {}
    }
    return Response.json({ sent });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});