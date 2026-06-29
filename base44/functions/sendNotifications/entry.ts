import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const action = body.action;
    
    // Direct email sending for customer invitations using Resend
    if (action === "sendEmail") {
      const { to, subject, body: emailBody, from_name } = body;
      if (!to || !subject || !emailBody) {
        return Response.json({ error: "Missing required fields: to, subject, body" }, { status: 400 });
      }
      
      const apiKey = Deno.env.get("EMAIL_API_KEY");
      if (!apiKey) {
        return Response.json({ error: "EMAIL_API_KEY not configured" }, { status: 500 });
      }
      
      // Use Resend API to send email
      const resendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          from: from_name ? `${from_name} <onboarding@resend.dev>` : "Frontier Building Group <onboarding@resend.dev>",
          to: [to],
          subject: subject,
          html: emailBody.replace(/\n/g, "<br>")
        })
      });
      
      if (!resendRes.ok) {
        const errorData = await resendRes.json().catch(() => ({}));
        return Response.json({ error: `Failed to send email: ${errorData.message || resendRes.statusText}` }, { status: 500 });
      }
      
      return Response.json({ success: true });
    }
    
    const { user_ids, project_id, type, title, message, link, target_all_staff, skip_email } = body;
    const users = await base44.asServiceRole.entities.User.list();
    let targets;
    if (target_all_staff) {
      targets = users.filter(u => u.role === "admin" || u.role === "staff");
    } else {
      if (!user_ids || user_ids.length === 0) return Response.json({ sent: 0 });
      targets = users.filter(u => user_ids.includes(u.id));
    }
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
        if (u.email && !skip_email) {
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