import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin' && user.role !== 'staff') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const action = body.action;
    const origin = new URL(req.url).origin;
    const portalUrl = `${origin}/login`;

    // linkUser is callable by customers themselves (to link their own account on first login)
    if (action === 'linkUser') {
      const invitations = await base44.asServiceRole.entities.CustomerInvitation.filter({ email: user.email });
      for (const inv of invitations) {
        if (inv.status === 'Invitation sent' || inv.status === 'Invitation opened') {
          await base44.asServiceRole.entities.CustomerInvitation.update(inv.id, {
            status: 'Active', user_id: user.id, last_login: new Date().toISOString()
          });
        }
      }
      return Response.json({ message: 'User linked', count: invitations.length });
    }

    // All other actions require staff/admin
    if (user.role !== 'admin' && user.role !== 'staff') return Response.json({ error: 'Forbidden' }, { status: 403 });

    // Helper: send invitation email
    async function sendInviteEmail(email, customerName, projectNames, expiryDate) {
      const projectList = projectNames.length > 1
        ? projectNames.map(n => `  • ${n}`).join('\n')
        : projectNames[0] || 'your project';
      const expiryStr = expiryDate ? new Date(expiryDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '7 days';
      const body = `Hello ${customerName || ''},

You've been invited to Frontier Selections — the client portal for your construction project with Frontier Building Group.

${projectNames.length > 1 ? 'Your projects:' : 'Your project:'}
${projectList}

Through the Frontier Selections portal, you can:
  • Browse and select materials for your project
  • Configure product options (colours, sizes, finishes)
  • Track your selection allowances and budget
  • Submit selections for staff review
  • Request changes to approved items
  • View your final selections package

To get started, click the link below to set up your account:
${portalUrl}

This invitation expires on ${expiryStr}. If you have any questions, please contact your Frontier Building Group project coordinator.

Thank you,
Frontier Building Group`;

      return await base44.integrations.Core.SendEmail({
        to: email,
        subject: "You've been invited to Frontier Selections",
        body: body,
        from_name: "Frontier Building Group"
      });
    }

    // Helper: create audit log
    async function createAuditLog(auditBase44, action, description, projectId, extra = {}) {
      await auditBase44.entities.AuditLog.create({
        target_type: 'customer_invitation',
        target_id: extra.invitation_id || 'N/A',
        action: action,
        action_type: action,
        description: description,
        actor_user_id: user.id,
        actor_name: user.full_name || user.email,
        actor_role: user.role,
        project_id: projectId || null,
        severity: extra.severity || 'medium',
        ...extra
      });
    }

    if (action === 'create') {
      const { email, customer_name, phone, project_ids, project_names } = body;
      if (!email || !project_ids || project_ids.length === 0) {
        return Response.json({ error: 'Email and at least one project are required' }, { status: 400 });
      }

      // Check for existing invitation
      const existing = await base44.asServiceRole.entities.CustomerInvitation.filter({ email: email });
      if (existing.length > 0 && existing[0].status !== 'Cancelled' && existing[0].status !== 'Deactivated') {
        return Response.json({ error: 'An active invitation already exists for this email' }, { status: 400 });
      }

      const expiryDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const now = new Date().toISOString();

      // Create or reactivate invitation
      let invitation;
      if (existing.length > 0) {
        invitation = await base44.asServiceRole.entities.CustomerInvitation.update(existing[0].id, {
          customer_name, phone, project_ids, project_names,
          status: 'Invitation sent', invited_by: user.id, invited_by_name: user.full_name || user.email,
          invited_date: now, expiry_date: expiryDate, last_sent_date: now
        });
      } else {
        invitation = await base44.asServiceRole.entities.CustomerInvitation.create({
          email, customer_name, phone, project_ids, project_names,
          status: 'Invitation sent', invited_by: user.id, invited_by_name: user.full_name || user.email,
          invited_date: now, expiry_date: expiryDate, last_sent_date: now
        });
      }

      // Invite user to the platform
      try {
        await base44.asServiceRole.users.inviteUser(email, 'user');
      } catch (e) {
        // User may already exist — that's OK
      }

      // Add customer to projects' assigned_customers
      for (const pid of project_ids) {
        try {
          const project = await base44.asServiceRole.entities.Project.get(pid);
          const current = project.assigned_customers || [];
          if (!current.includes(email)) {
            await base44.asServiceRole.entities.Project.update(pid, {
              assigned_customers: [...current, email]
            });
          }
        } catch (e) { /* project may not exist */ }
      }

      // Send custom email
      try {
        await sendInviteEmail(email, customer_name, project_names || [], expiryDate);
      } catch (e) { /* email may fail */ }

      // Audit log
      await createAuditLog(base44.asServiceRole, 'customer_invited',
        `${user.full_name || user.email} invited ${customer_name || email} to project(s): ${(project_names || []).join(', ')}`,
        project_ids[0], { severity: 'high' });

      return Response.json({ message: 'Invitation sent successfully', invitation });
    }

    if (action === 'resend') {
      const { invitation_id } = body;
      const invitation = await base44.asServiceRole.entities.CustomerInvitation.get(invitation_id);
      const expiryDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const now = new Date().toISOString();

      await base44.asServiceRole.entities.CustomerInvitation.update(invitation_id, {
        status: 'Invitation sent', expiry_date: expiryDate, last_sent_date: now
      });

      try {
        await base44.asServiceRole.users.inviteUser(invitation.email, 'user');
      } catch (e) { /* may already exist */ }

      try {
        await sendInviteEmail(invitation.email, invitation.customer_name, invitation.project_names || [], expiryDate);
      } catch (e) { /* email may fail */ }

      await createAuditLog(base44.asServiceRole, 'invitation_resent',
        `${user.full_name || user.email} resent invitation to ${invitation.customer_name || invitation.email}`,
        (invitation.project_ids || [])[0], { invitation_id, severity: 'medium' });

      return Response.json({ message: 'Invitation resent' });
    }

    if (action === 'cancel') {
      const { invitation_id } = body;
      const invitation = await base44.asServiceRole.entities.CustomerInvitation.get(invitation_id);
      await base44.asServiceRole.entities.CustomerInvitation.update(invitation_id, { status: 'Cancelled' });

      // Remove from projects
      for (const pid of invitation.project_ids || []) {
        try {
          const project = await base44.asServiceRole.entities.Project.get(pid);
          const current = project.assigned_customers || [];
          await base44.asServiceRole.entities.Project.update(pid, {
            assigned_customers: current.filter(c => c !== invitation.email)
          });
        } catch (e) { /* */ }
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

      // Remove from projects
      for (const pid of invitation.project_ids || []) {
        try {
          const project = await base44.asServiceRole.entities.Project.get(pid);
          const current = project.assigned_customers || [];
          await base44.asServiceRole.entities.Project.update(pid, {
            assigned_customers: current.filter(c => c !== invitation.email)
          });
        } catch (e) { /* */ }
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

      // Add back to projects
      for (const pid of invitation.project_ids || []) {
        try {
          const project = await base44.asServiceRole.entities.Project.get(pid);
          const current = project.assigned_customers || [];
          if (!current.includes(invitation.email)) {
            await base44.asServiceRole.entities.Project.update(pid, {
              assigned_customers: [...current, invitation.email]
            });
          }
        } catch (e) { /* */ }
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
        await base44.asServiceRole.entities.Project.update(project_id, {
          assigned_customers: current.filter(c => c !== invitation.email)
        });
      } catch (e) { /* */ }

      await createAuditLog(base44.asServiceRole, 'customer_removed_from_project',
        `${user.full_name || user.email} removed ${invitation.customer_name || invitation.email} from project`,
        project_id, { invitation_id, severity: 'high' });

      return Response.json({ message: 'Customer removed from project' });
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