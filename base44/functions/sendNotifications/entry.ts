import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.active === false) return Response.json({ error: "Account deactivated" }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const action = body.action;
    const isStaff = user.role === "admin" || user.role === "staff";
    
    if (action === "checkConfig") {
      if (!isStaff) return Response.json({ error: "Forbidden" }, { status: 403 });
      const apiKey = Deno.env.get("EMAIL_API_KEY");
      return Response.json({ configured: !!apiKey, provider: apiKey ? "Resend" : "Not configured" });
    }
    
    if (action === "sendEmail") {
      if (!isStaff) return Response.json({ error: "Forbidden" }, { status: 403 });
      const { to, subject, body: emailBody, from_name } = body;
      if (!to || !subject || !emailBody) {
        return Response.json({ error: "Missing required fields: to, subject, body" }, { status: 400 });
      }
      const apiKey = Deno.env.get("EMAIL_API_KEY");
      if (!apiKey) {
        return Response.json({ success: false, email_sent: false, reason: "EMAIL_API_KEY not configured" }, { status: 200 });
      }
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
          body: JSON.stringify({
            from: "Frontier Building Group <onboarding@resend.dev>",
            to: [to],
            subject: subject,
            html: emailBody.replace(/\n/g, "<br>")
          })
        });
        const responseData = await res.json().catch(() => ({}));
        if (!res.ok) {
          console.error("Resend error:", responseData);
          const isDomainError = responseData.message?.includes("unverified domain") || responseData.message?.includes("not authorized");
          return Response.json({ 
            success: false, 
            email_sent: false, 
            error: isDomainError ? "Domain not verified - can only send to verified email addresses" : (responseData.message || res.statusText),
            resend_response: responseData
          }, { status: 200 });
        }
        return Response.json({ success: true, email_sent: true });
      } catch (e) {
        return Response.json({ success: false, email_sent: false, error: e.message }, { status: 200 });
      }
    }
    
    if (!isStaff) return Response.json({ error: "Forbidden" }, { status: 403 });
    const { user_ids, project_id, type, title, message, link, target_all_staff, skip_email } = body;
    const users = await base44.asServiceRole.entities.User.list();
    let targets = target_all_staff ? users.filter(u => u.role === "admin" || u.role === "staff") : users.filter(u => user_ids?.includes(u.id));
    if (!target_all_staff && (!user_ids || user_ids.length === 0)) {
      return Response.json({ sent: 0 });
    }
    const apiKey = Deno.env.get("EMAIL_API_KEY");
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
        if (u.email && !skip_email && apiKey) {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
            body: JSON.stringify({
              from: "Frontier Building Group <onboarding@resend.dev>",
              to: [u.email],
              subject: title || "Notification",
              html: ((message || "") + (link ? `\n\nOpen: ${link}` : "")).replace(/\n/g, "<br>")
            })
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