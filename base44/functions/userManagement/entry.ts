import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin access required' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const action = body.action;

    async function audit(actionType, description, extra = {}) {
      await base44.asServiceRole.entities.AuditLog.create({
        target_type: 'user_management',
        target_id: extra.target_user_id || 'N/A',
        action: actionType,
        action_type: actionType,
        description: description,
        actor_user_id: user.id,
        actor_name: user.full_name || user.email,
        actor_role: user.role,
        severity: extra.severity || 'high',
        ...extra
      });
    }

    if (action === 'listStaff') {
      const users = await base44.asServiceRole.entities.User.list('-created_date', 200);
      const staff = users.filter(u => u.role === 'admin' || u.role === 'staff');
      return Response.json({ users: staff });
    }

    if (action === 'listCustomers') {
      const users = await base44.asServiceRole.entities.User.list('-created_date', 500);
      const customers = users.filter(u => u.role === 'customer' || u.role === 'user' || (!u.role));
      return Response.json({ users: customers });
    }

    if (action === 'inviteStaff') {
      const { email, role, staff_role, permissions, name, phone } = body;
      if (!email) return Response.json({ error: 'Email is required' }, { status: 400 });
      if (role !== 'admin' && role !== 'staff') return Response.json({ error: 'Invalid role' }, { status: 400 });

      // Prevent non-admins from creating admins (already checked above, but double-check)
      if (role === 'admin' && user.role !== 'admin') {
        return Response.json({ error: 'Only admins can create admin users' }, { status: 403 });
      }

      try {
        await base44.asServiceRole.users.inviteUser(email, role);
      } catch (e) {
        return Response.json({ error: 'Failed to invite user: ' + e.message }, { status: 500 });
      }

      // Try to update the user record if it exists
      try {
        const users = await base44.asServiceRole.entities.User.list();
        const existing = users.find(u => u.email === email);
        if (existing) {
          await base44.asServiceRole.entities.User.update(existing.id, {
            role, staff_role, permissions: permissions || [], phone
          });
        }
      } catch (e) { /* user may not exist yet */ }

      await audit('staff_invited', `${user.full_name || user.email} invited ${email} as ${role}${staff_role ? ' (' + staff_role + ')' : ''}`,
        { severity: 'sensitive' });

      return Response.json({ message: 'Staff user invited successfully' });
    }

    if (action === 'updateStaff') {
      const { user_id, staff_role, permissions, role, phone, active } = body;
      if (!user_id) return Response.json({ error: 'user_id is required' }, { status: 400 });

      // Prevent self-escalation
      if (user_id === user.id && role === 'admin' && user.role !== 'admin') {
        return Response.json({ error: 'Cannot escalate your own role' }, { status: 403 });
      }

      const updateData = {};
      if (staff_role !== undefined) updateData.staff_role = staff_role;
      if (permissions !== undefined) updateData.permissions = permissions;
      if (role !== undefined) updateData.role = role;
      if (phone !== undefined) updateData.phone = phone;
      if (active !== undefined) {
        updateData.active = active;
        if (!active) {
          updateData.deactivated_date = new Date().toISOString();
          updateData.deactivated_by = user.id;
        } else {
          updateData.deactivated_date = null;
          updateData.deactivated_by = null;
        }
      }

      const updated = await base44.asServiceRole.entities.User.update(user_id, updateData);

      await audit('staff_updated', `${user.full_name || user.email} updated staff user ${updated.email || user_id}: ${JSON.stringify(updateData)}`,
        { target_user_id: user_id, severity: 'sensitive' });

      return Response.json({ message: 'Staff user updated', user: updated });
    }

    if (action === 'deactivateUser') {
      const { user_id } = body;
      if (user_id === user.id) return Response.json({ error: 'Cannot deactivate yourself' }, { status: 400 });

      const target = await base44.asServiceRole.entities.User.get(user_id);
      await base44.asServiceRole.entities.User.update(user_id, {
        active: false, deactivated_date: new Date().toISOString(), deactivated_by: user.id
      });

      await audit('user_deactivated', `${user.full_name || user.email} deactivated user ${target.email || user_id}`,
        { target_user_id: user_id, severity: 'sensitive' });

      return Response.json({ message: 'User deactivated' });
    }

    if (action === 'reactivateUser') {
      const { user_id } = body;
      const target = await base44.asServiceRole.entities.User.get(user_id);
      await base44.asServiceRole.entities.User.update(user_id, {
        active: true, deactivated_date: null, deactivated_by: null
      });

      await audit('user_reactivated', `${user.full_name || user.email} reactivated user ${target.email || user_id}`,
        { target_user_id: user_id, severity: 'high' });

      return Response.json({ message: 'User reactivated' });
    }

    if (action === 'updatePermissions') {
      const { user_id, permissions } = body;
      if (!user_id || !permissions) return Response.json({ error: 'user_id and permissions required' }, { status: 400 });

      // Prevent self-escalation
      if (user_id === user.id && user.role !== 'admin') {
        return Response.json({ error: 'Cannot modify your own permissions' }, { status: 403 });
      }

      const target = await base44.asServiceRole.entities.User.get(user_id);
      await base44.asServiceRole.entities.User.update(user_id, { permissions });

      await audit('permissions_changed', `${user.full_name || user.email} updated permissions for ${target.email || user_id}: ${JSON.stringify(permissions)}`,
        { target_user_id: user_id, severity: 'sensitive' });

      return Response.json({ message: 'Permissions updated' });
    }

    if (action === 'updateLastLogin') {
      // Update current user's last_login
      if (user.role === 'admin' || user.role === 'staff') {
        await base44.asServiceRole.entities.User.update(user.id, { last_login: new Date().toISOString() });
      }
      return Response.json({ message: 'Last login updated' });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});