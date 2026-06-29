import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin' && user.role !== 'staff') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const action = body.action;

    function hasPermission(perm) {
      if (user.role === 'admin') return true;
      const perms = user.permissions || [];
      return perms.includes(perm);
    }

    if (action === 'start') {
      const { mode, customer_user_id, customer_name, project_id, project_name, reason } = body;
      if (!mode || !customer_user_id || !project_id) {
        return Response.json({ error: 'mode, customer_user_id, and project_id are required' }, { status: 400 });
      }
      if (mode === 'view' && !hasPermission('view_as_customer')) {
        return Response.json({ error: 'You do not have permission to view as customer' }, { status: 403 });
      }
      if (mode === 'act' && !hasPermission('act_as_customer')) {
        return Response.json({ error: 'You do not have permission to act as customer' }, { status: 403 });
      }
      if (mode === 'act' && !reason) {
        return Response.json({ error: 'A reason is required to act as customer' }, { status: 400 });
      }

      const sessionId = crypto.randomUUID();
      const now = new Date().toISOString();

      await base44.asServiceRole.entities.AuditLog.create({
        target_type: 'impersonation',
        target_id: sessionId,
        action: mode === 'view' ? 'view_as_customer_started' : 'act_as_customer_started',
        action_type: mode === 'view' ? 'view_as_customer_started' : 'act_as_customer_started',
        description: `${user.full_name || user.email} started ${mode === 'view' ? 'View as Customer' : 'Act as Customer'} mode for ${customer_name} on project ${project_name || project_id}${reason ? '. Reason: ' + reason : ''}`,
        actor_user_id: user.id,
        actor_name: user.full_name || user.email,
        acting_as_user_id: customer_user_id,
        acting_as_name: customer_name,
        actor_role: user.role,
        project_id: project_id,
        reason: reason || null,
        severity: 'sensitive'
      });

      return Response.json({
        session_id: sessionId,
        mode: mode,
        customer_user_id: customer_user_id,
        customer_name: customer_name,
        project_id: project_id,
        project_name: project_name,
        staff_name: user.full_name || user.email,
        staff_user_id: user.id,
        started_at: now
      });
    }

    if (action === 'exit') {
      const { session_id, mode, customer_name, project_id } = body;
      await base44.asServiceRole.entities.AuditLog.create({
        target_type: 'impersonation',
        target_id: session_id || 'N/A',
        action: mode === 'view' ? 'view_as_customer_exited' : 'act_as_customer_exited',
        action_type: mode === 'view' ? 'view_as_customer_exited' : 'act_as_customer_exited',
        description: `${user.full_name || user.email} exited ${mode === 'view' ? 'View as Customer' : 'Act as Customer'} mode for ${customer_name}`,
        actor_user_id: user.id,
        actor_name: user.full_name || user.email,
        actor_role: user.role,
        project_id: project_id || null,
        severity: 'sensitive'
      });
      return Response.json({ message: 'Exited customer mode' });
    }

    if (action === 'logAction') {
      const { session_id, mode, customer_user_id, customer_name, project_id, action_type, description, before_value, after_value } = body;
      if (mode === 'act' && !hasPermission('act_as_customer')) {
        return Response.json({ error: 'Permission denied' }, { status: 403 });
      }

      await base44.asServiceRole.entities.AuditLog.create({
        target_type: 'impersonation_action',
        target_id: session_id || 'N/A',
        action: action_type,
        action_type: action_type,
        description: `${user.full_name || user.email} ${description} on behalf of ${customer_name}`,
        actor_user_id: user.id,
        actor_name: user.full_name || user.email,
        acting_as_user_id: customer_user_id,
        acting_as_name: customer_name,
        actor_role: user.role,
        project_id: project_id || null,
        before_value: before_value ? JSON.stringify(before_value) : null,
        after_value: after_value ? JSON.stringify(after_value) : null,
        severity: 'sensitive'
      });

      return Response.json({ message: 'Action logged' });
    }

    if (action === 'log_customer_portal_entry') {
      const { mode, project_id, customer_user_id, customer_name, reason } = body;
      if (!project_id || !customer_user_id) {
        return Response.json({ error: 'project_id and customer_user_id are required' }, { status: 400 });
      }
      if (mode === 'act' && !hasPermission('act_as_customer')) {
        return Response.json({ error: 'Permission denied' }, { status: 403 });
      }

      const sessionId = crypto.randomUUID();
      await base44.asServiceRole.entities.AuditLog.create({
        target_type: 'customer_portal_session',
        target_id: sessionId,
        action: mode === 'preview' ? 'customer_portal_preview_started' : 'customer_portal_act_started',
        action_type: mode === 'preview' ? 'customer_portal_preview_started' : 'customer_portal_act_started',
        description: `${user.full_name || user.email} started ${mode === 'preview' ? 'Preview Customer Portal' : 'Act as Customer'} mode for ${customer_name} on project ${project_id}${reason ? '. Reason: ' + reason : ''}`,
        actor_user_id: user.id,
        actor_name: user.full_name || user.email,
        acting_as_user_id: customer_user_id,
        acting_as_name: customer_name,
        actor_role: user.role,
        project_id: project_id,
        reason: reason || null,
        severity: 'sensitive'
      });

      return Response.json({ session_id: sessionId, message: 'Customer portal session started' });
    }

    if (action === 'log_customer_portal_exit') {
      const { mode, project_id, customer_user_id } = body;
      await base44.asServiceRole.entities.AuditLog.create({
        target_type: 'customer_portal_session',
        target_id: `exit-${project_id}-${customer_user_id}`,
        action: mode === 'preview' ? 'customer_portal_preview_ended' : 'customer_portal_act_ended',
        action_type: mode === 'preview' ? 'customer_portal_preview_ended' : 'customer_portal_act_ended',
        description: `${user.full_name || user.email} exited ${mode === 'preview' ? 'Preview Customer Portal' : 'Act as Customer'} mode`,
        actor_user_id: user.id,
        actor_name: user.full_name || user.email,
        actor_role: user.role,
        project_id: project_id || null,
        severity: 'sensitive'
      });
      return Response.json({ message: 'Customer portal session ended' });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});