import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin' && user.role !== 'staff') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const action = body.action;
    const debugMode = body.debug === true || Deno.env.get("DEBUG_MODE") === "true";

    // Helper: verify staff user has access to a project before inviting to it
    async function verifyStaffProjectAccess(projectId) {
      if (user.role === 'admin') return true;
      const project = await base44.asServiceRole.entities.Project.get(projectId).catch(() => null);
      if (!project) return false;
      const perms = user.permissions || [];
      if (perms.includes('view_all_projects')) return true;
      const assigned = project.assigned_staff || [];
      return assigned.includes(user.id) || assigned.includes(user.email);
    }
    // Use the app's configured base URL - hardcoded for production app
    const appBaseUrl = Deno.env.get("BASE44_APP_BASE_URL") || Deno.env.get("VITE_BASE44_APP_BASE_URL") || "https://archetypal-frontier-build-flow.base44.app";
    const portalUrl = `${appBaseUrl}/login`;

    async function createAuditLog(aBase44, action, desc, projectId, extra = {}) {
      await aBase44.entities.AuditLog.create({
        target_type: 'customer_invitation', target_id: extra.invitation_id || 'N/A',
        action, action_type: action, description: desc, actor_user_id: user.id,
        actor_name: user.full_name || user.email, actor_role: user.role,
        project_id: projectId || null, severity: extra.severity || 'medium', ...extra
      });
    }

    async function sendInviteEmail(email, customerName, projectNames, invitationId) {
      const projectList = projectNames.length > 1 
        ? `Projects:\n${projectNames.map(n => `• ${n}`).join('\n')}`
        : `Project: ${projectNames[0] || 'your project'}`;
      const inviteLink = `${appBaseUrl}/register?invite=${invitationId}`;
      const emailBody = `Hello ${customerName || ''},\n\nYou've been invited to Frontier Selections.\n\n${projectList}\n\nTo get started: ${inviteLink}\n\nThis invitation expires on ${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}.\n\nThank you,\nFrontier Building Group`;
      
      const emailRes = await base44.functions.invoke("sendNotifications", {
        action: "sendEmail", to: email, subject: "You've been invited to Frontier Selections",
        body: emailBody, from_name: "Frontier Building Group"
      });
      return emailRes.data;
    }

    if (action === 'create') {
      const { email, customer_name, phone, project_ids, project_names } = body;
      if (!email || !project_ids || project_ids.length === 0) {
        return Response.json({ error: 'Email and at least one project are required' }, { status: 400 });
      }

      // Verify staff has access to all projects they're inviting to
      for (const pid of project_ids) {
        if (!(await verifyStaffProjectAccess(pid))) {
          return Response.json({ error: 'You do not have access to one or more of the selected projects' }, { status: 403 });
        }
      }

      const existing = await base44.asServiceRole.entities.CustomerInvitation.filter({ email });
      if (existing.length > 0 && existing[0].status !== 'Cancelled' && existing[0].status !== 'Deactivated') {
        return Response.json({ error: 'An active invitation already exists for this email' }, { status: 400 });
      }

      const expiryDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const now = new Date().toISOString();

      let invitation;
      if (existing.length > 0) {
        invitation = await base44.asServiceRole.entities.CustomerInvitation.update(existing[0].id, {
          customer_name, phone, project_ids, project_names, status: 'Invitation sent',
          invited_by: user.id, invited_by_name: user.full_name || user.email,
          invited_date: now, expiry_date: expiryDate, last_sent_date: now
        });
      } else {
        invitation = await base44.asServiceRole.entities.CustomerInvitation.create({
          email, customer_name, phone, project_ids, project_names, status: 'Invitation sent',
          invited_by: user.id, invited_by_name: user.full_name || user.email,
          invited_date: now, expiry_date: expiryDate, last_sent_date: now
        });
      }

      try { await base44.asServiceRole.users.inviteUser(email, 'user'); } catch (e) {}

      for (const pid of project_ids) {
        try {
          const project = await base44.asServiceRole.entities.Project.get(pid);
          const current = project.assigned_customers || [];
          if (!current.includes(email)) {
            await base44.asServiceRole.entities.Project.update(pid, { assigned_customers: [...current, email] });
          }
        } catch (e) {}
      }

      let emailResult = null, emailError = null;
      try {
        emailResult = await sendInviteEmail(email, customer_name, project_names || [], invitation.id);
        if (emailResult && !emailResult.email_sent) emailError = emailResult.reason || emailResult.error;
      } catch (e) { emailError = e.message; }

      const inviteLink = `${portalUrl}?invite=${invitation.id}`;
      const auditExtra = { severity: 'high', invitation_id: invitation.id, email_sent: emailResult?.email_sent || false, email_error: emailError };
      if (debugMode) auditExtra.invite_link = inviteLink;
      
      if (emailError) {
        await createAuditLog(base44.asServiceRole, 'customer_invited_email_failed',
          `${user.full_name || user.email} invited ${customer_name || email} but email failed: ${emailError}`,
          project_ids[0], auditExtra);
      } else {
        await createAuditLog(base44.asServiceRole, 'customer_invited',
          `${user.full_name || user.email} invited ${customer_name || email} to project(s): ${(project_names || []).join(', ')}`,
          project_ids[0], auditExtra);
      }

      return Response.json({ 
        message: emailResult?.email_sent ? 'Invitation sent successfully' : 'Invitation created (email not sent)', 
        invitation, invite_link: inviteLink, email_sent: emailResult?.email_sent || false, email_error: emailError 
      });
    }

    if (action === 'resend') {
      const { invitation_id } = body;
      const invitation = await base44.asServiceRole.entities.CustomerInvitation.get(invitation_id);
      const expiryDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const now = new Date().toISOString();

      await base44.asServiceRole.entities.CustomerInvitation.update(invitation_id, {
        status: 'Invitation sent', expiry_date: expiryDate, last_sent_date: now
      });

      try { await base44.asServiceRole.users.inviteUser(invitation.email, 'user'); } catch (e) {}

      let emailResult = null, emailError = null;
      try {
        emailResult = await sendInviteEmail(invitation.email, invitation.customer_name, invitation.project_names || [], invitation_id);
        if (emailResult && !emailResult.email_sent) emailError = emailResult.reason || emailResult.error;
      } catch (e) { emailError = e.message; }

      const inviteLink = `${portalUrl}?invite=${invitation.id}`;
      const auditExtra = { invitation_id, email_sent: emailResult?.email_sent || false, email_error: emailError };
      if (debugMode) auditExtra.invite_link = inviteLink;

      if (emailError) {
        await createAuditLog(base44.asServiceRole, 'invitation_resent_email_failed',
          `${user.full_name || user.email} resent invitation but email failed: ${emailError}`,
          (invitation.project_ids || [])[0], auditExtra);
      } else {
        await createAuditLog(base44.asServiceRole, 'invitation_resent',
          `${user.full_name || user.email} resent invitation to ${invitation.customer_name || invitation.email}`,
          (invitation.project_ids || [])[0], auditExtra);
      }

      return Response.json({ 
        message: emailResult?.email_sent ? 'Invitation resent successfully' : 'Invitation reset (email not sent)',
        invite_link: inviteLink, email_sent: emailResult?.email_sent || false, email_error: emailError 
      });
    }

    if (action === 'cancel') {
      const { invitation_id } = body;
      const invitation = await base44.asServiceRole.entities.CustomerInvitation.get(invitation_id);
      await base44.asServiceRole.entities.CustomerInvitation.update(invitation_id, { status: 'Cancelled' });

      for (const pid of invitation.project_ids || []) {
        try {
          const project = await base44.asServiceRole.entities.Project.get(pid);
          const current = project.assigned_customers || [];
          await base44.asServiceRole.entities.Project.update(pid, { assigned_customers: current.filter(c => c !== invitation.email) });
        } catch (e) {}
      }

      await createAuditLog(base44.asServiceRole, 'invitation_cancelled',
        `${user.full_name || user.email} cancelled invitation to ${invitation.customer_name || invitation.email}`,
        (invitation.project_ids || [])[0], { invitation_id, severity: 'high' });

      return Response.json({ message: 'Invitation cancelled' });
    }

    if (action === 'deactivate') {
      const { invitation_id } = body;
      const invitation = await base44.asServiceRole.entities.CustomerInvitation.get(invitation_id);
      await base44.asServiceRole.entities.CustomerInvitation.update(invitation_id, {
        status: 'Deactivated', deactivated_date: new Date().toISOString()
      });

      for (const pid of invitation.project_ids || []) {
        try {
          const project = await base44.asServiceRole.entities.Project.get(pid);
          const current = project.assigned_customers || [];
          await base44.asServiceRole.entities.Project.update(pid, { assigned_customers: current.filter(c => c !== invitation.email) });
        } catch (e) {}
      }

      await createAuditLog(base44.asServiceRole, 'customer_deactivated',
        `${user.full_name || user.email} deactivated customer access for ${invitation.customer_name || invitation.email}`,
        (invitation.project_ids || [])[0], { invitation_id, severity: 'sensitive' });

      return Response.json({ message: 'Customer access deactivated' });
    }

    if (action === 'reactivate') {
      const { invitation_id } = body;
      const invitation = await base44.asServiceRole.entities.CustomerInvitation.get(invitation_id);
      await base44.asServiceRole.entities.CustomerInvitation.update(invitation_id, { status: 'Active' });

      for (const pid of invitation.project_ids || []) {
        try {
          const project = await base44.asServiceRole.entities.Project.get(pid);
          const current = project.assigned_customers || [];
          if (!current.includes(invitation.email)) {
            await base44.asServiceRole.entities.Project.update(pid, { assigned_customers: [...current, invitation.email] });
          }
        } catch (e) {}
      }

      await createAuditLog(base44.asServiceRole, 'customer_reactivated',
        `${user.full_name || user.email} reactivated customer access for ${invitation.customer_name || invitation.email}`,
        (invitation.project_ids || [])[0], { invitation_id, severity: 'high' });

      return Response.json({ message: 'Customer access reactivated' });
    }

    if (action === 'removeFromProject') {
      const { invitation_id, project_id } = body;
      const invitation = await base44.asServiceRole.entities.CustomerInvitation.get(invitation_id);
      const newProjectIds = (invitation.project_ids || []).filter(id => id !== project_id);
      const newProjectNames = (invitation.project_names || []).filter((_, i) => (invitation.project_ids || [])[i] !== project_id);

      await base44.asServiceRole.entities.CustomerInvitation.update(invitation_id, {
        project_ids: newProjectIds, project_names: newProjectNames
      });

      try {
        const project = await base44.asServiceRole.entities.Project.get(project_id);
        const current = project.assigned_customers || [];
        await base44.asServiceRole.entities.Project.update(project_id, { assigned_customers: current.filter(c => c !== invitation.email) });
      } catch (e) {}

      await createAuditLog(base44.asServiceRole, 'customer_removed_from_project',
        `${user.full_name || user.email} removed ${invitation.customer_name || invitation.email} from project`,
        project_id, { invitation_id, severity: 'high' });

      return Response.json({ message: 'Customer removed from project' });
    }

    if (action === 'linkUser') {
      const me = await base44.auth.me();
      if (!me) {
        console.log("linkUser: no authenticated user");
        return Response.json({ linked: 0 });
      }
      console.log("linkUser: checking invitations for", me.email);
      const invitations = await base44.entities.CustomerInvitation.filter({ email: me.email });
      console.log("linkUser: found", invitations.length, "invitations");
      let linked = 0;
      const now = new Date().toISOString();
      
      for (const inv of invitations) {
        console.log("linkUser: processing invitation", inv.id, "status:", inv.status);
        if (inv.status !== 'Cancelled' && inv.status !== 'Deactivated' && inv.status !== 'Active') {
          // Update invitation status to Active
          await base44.entities.CustomerInvitation.update(inv.id, {
            user_id: me.id,
            status: 'Active',
            last_login: now,
            last_opened_date: now,
            opened_count: (inv.opened_count || 0) + 1
          });
          console.log("linkUser: updated invitation", inv.id, "to Active");
          
          for (const pid of inv.project_ids || []) {
            try {
              const project = await base44.entities.Project.get(pid);
              const current = project.assigned_customers || [];
              // Add user ID to assigned_customers (not email)
              if (!current.includes(me.id)) {
                await base44.entities.Project.update(pid, { assigned_customers: [...current, me.id] });
                linked++;
                console.log("linkUser: linked to project", pid);
              }
            } catch (e) {
              console.error("Failed to link project:", pid, e);
            }
          }
          
          // Log account creation/linking
          await createAuditLog(base44.asServiceRole, 'invite_accepted_account_created',
            `${me.email} accepted invitation and created account`,
            (inv.project_ids || [])[0], { 
              invitation_id: inv.id, 
              user_id: me.id,
              severity: 'high' 
            });
        } else {
          console.log("linkUser: skipping invitation", inv.id, "status:", inv.status);
        }
      }
      console.log("linkUser complete:", { linked, email: me.email, invitationsCount: invitations.length });
      return Response.json({ linked, email: me.email, invitationsCount: invitations.length });
    }

    if (action === 'sendLoginLink') {
      const { invitation_id } = body;
      const invitation = await base44.asServiceRole.entities.CustomerInvitation.get(invitation_id);
      
      if (!invitation || invitation.status === 'Cancelled' || invitation.status === 'Deactivated') {
        return Response.json({ error: 'Invalid invitation' }, { status: 400 });
      }
      
      const loginLink = `${appBaseUrl}/login`;
      const projectList = invitation.project_names && invitation.project_names.length > 0
        ? `Projects:\n${invitation.project_names.map(n => `• ${n}`).join('\n')}`
        : `Project: your project`;
      
      const emailBody = `Hello ${invitation.customer_name || ''},\n\nWelcome back to Frontier Selections!\n\n${projectList}\n\nLogin here: ${loginLink}\n\nThank you,\nFrontier Building Group`;
      
      let emailResult = null, emailError = null;
      try {
        emailResult = await base44.functions.invoke("sendNotifications", {
          action: "sendEmail",
          to: invitation.email,
          subject: "Login to Frontier Selections",
          body: emailBody,
          from_name: "Frontier Building Group"
        });
        if (emailResult && !emailResult.email_sent) emailError = emailResult.reason || emailResult.error;
      } catch (e) { emailError = e.message; }
      
      await createAuditLog(base44.asServiceRole, 'login_link_sent',
        `${user.full_name || user.email} sent login link to ${invitation.customer_name || invitation.email}`,
        (invitation.project_ids || [])[0], { 
          invitation_id, 
          email_sent: emailResult?.email_sent || false,
          email_error: emailError 
        });
      
      return Response.json({ 
        message: emailResult?.email_sent ? 'Login link sent' : 'Login link generated (email not sent)',
        login_link: loginLink,
        email_sent: emailResult?.email_sent || false,
        email_error: emailError 
      });
    }

    if (action === 'listExistingUsers') {
      const users = await base44.asServiceRole.entities.User.list('-created_date', 500);
      const customers = users.filter(u => u.role === 'customer' || (!u.role && u.role !== 'admin' && u.role !== 'staff'));
      return Response.json({ users: customers });
    }

    if (action === 'linkExistingUser') {
      const { user_id, project_ids, project_names, phone } = body;
      if (!user_id || !project_ids || project_ids.length === 0) {
        return Response.json({ error: 'User and at least one project are required' }, { status: 400 });
      }

      for (const pid of project_ids) {
        if (!(await verifyStaffProjectAccess(pid))) {
          return Response.json({ error: 'You do not have access to one or more of the selected projects' }, { status: 403 });
        }
      }

      const existingUser = await base44.asServiceRole.entities.User.get(user_id).catch(() => null);
      if (!existingUser) {
        return Response.json({ error: 'User not found' }, { status: 404 });
      }

      const email = existingUser.email;
      const customerName = existingUser.full_name || existingUser.email;
      const now = new Date().toISOString();

      // Check for existing invitation record for this email
      const existing = await base44.asServiceRole.entities.CustomerInvitation.filter({ email });

      let invitation;
      if (existing.length > 0) {
        const inv = existing[0];
        const mergedProjectIds = [...new Set([...(inv.project_ids || []), ...project_ids])];
        const mergedProjectNames = [...new Set([...(inv.project_names || []), ...project_names])];
        invitation = await base44.asServiceRole.entities.CustomerInvitation.update(inv.id, {
          customer_name: customerName, phone: phone || inv.phone,
          project_ids: mergedProjectIds, project_names: mergedProjectNames,
          status: 'Active', user_id: existingUser.id,
          invited_by: user.id, invited_by_name: user.full_name || user.email,
          invited_date: inv.invited_date || now, last_login: now
        });
      } else {
        invitation = await base44.asServiceRole.entities.CustomerInvitation.create({
          email, customer_name: customerName, phone,
          project_ids, project_names, status: 'Active', user_id: existingUser.id,
          invited_by: user.id, invited_by_name: user.full_name || user.email,
          invited_date: now, last_login: now, opened_count: 1
        });
      }

      // Add the user ID (not email) to assigned_customers for each project
      for (const pid of project_ids) {
        try {
          const project = await base44.asServiceRole.entities.Project.get(pid);
          const current = project.assigned_customers || [];
          if (!current.includes(existingUser.id)) {
            await base44.asServiceRole.entities.Project.update(pid, { assigned_customers: [...current, existingUser.id] });
          }
        } catch (e) {}
      }

      await createAuditLog(base44.asServiceRole, 'existing_user_linked',
        `${user.full_name || user.email} linked existing user ${customerName} (${email}) to project(s): ${(project_names || []).join(', ')}`,
        project_ids[0], { invitation_id: invitation.id, user_id: existingUser.id, severity: 'high' });

      return Response.json({ message: 'Customer access granted', invitation });
    }

    if (action === 'list') {
      const invitations = await base44.asServiceRole.entities.CustomerInvitation.list('-invited_date', 200);
      return Response.json({ invitations });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});