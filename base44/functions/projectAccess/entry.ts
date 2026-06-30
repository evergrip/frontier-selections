import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    // Reject deactivated users
    if (user.active === false) {
      return Response.json({ has_access: false, reason: "Account deactivated" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { project_id } = body;
    if (!project_id) return Response.json({ error: "project_id required" }, { status: 400 });

    const project = await base44.asServiceRole.entities.Project.get(project_id).catch(() => null);
    if (!project) return Response.json({ has_access: false, reason: "Project not found" }, { status: 404 });

    const isStaff = user.role === "admin" || user.role === "staff";
    let hasAccess = false;

    if (isStaff) {
      // Admins always have access
      if (user.role === "admin") {
        hasAccess = true;
      } else {
        // Staff: check if they have view_all_projects or are assigned to this project
        const perms = user.permissions || [];
        if (perms.includes("view_all_projects")) {
          hasAccess = true;
        } else {
          // Check assigned_staff for user ID or email
          const assigned = project.assigned_staff || [];
          hasAccess = assigned.includes(user.id) || assigned.includes(user.email);
        }
      }
    } else {
      // Customer: check assigned_customers by user ID or email
      const custs = project.assigned_customers || [];
      hasAccess = custs.includes(user.id) || custs.includes(user.email);
    }

    if (!hasAccess) {
      // Log suspicious denied access attempt
      await base44.asServiceRole.entities.AuditLog.create({
        target_type: "project", target_id: project_id, action: "access_denied",
        action_type: "access_denied",
        description: `${user.email} denied access to project ${project.name}`,
        actor_user_id: user.id, actor_name: user.full_name || user.email,
        actor_role: user.role, project_id, severity: "high"
      }).catch(() => {});
      return Response.json({ has_access: false, reason: "Forbidden" }, { status: 403 });
    }

    // Return project data only after access is confirmed
    return Response.json({
      has_access: true,
      project: {
        id: project.id, name: project.name, address: project.address,
        project_type: project.project_type, status: project.status,
        start_date: project.start_date, target_completion_date: project.target_completion_date,
        selections_due_date: project.selections_due_date,
        pricing_visibility: project.pricing_visibility,
        allowance_visibility: project.allowance_visibility,
        total_allowance: project.total_allowance,
        customer_notes: project.customer_notes,
        assigned_customers: project.assigned_customers,
        assigned_staff: project.assigned_staff
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});