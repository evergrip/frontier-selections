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
    const actor = user.full_name || user.email || "user";
    const now = new Date().toISOString();

    // ==================== ACCESS VERIFICATION ====================
    async function verifyProjectAccess(projectId) {
      const project = await base44.asServiceRole.entities.Project.get(projectId).catch(() => null);
      if (!project) return { ok: false, error: "Project not found", status: 404 };
      if (isStaff) {
        // Staff with view_all_projects permission or admin can access any project
        // Staff with view_assigned_projects_only can only access assigned projects
        const perms = user.permissions || [];
        const hasViewAll = user.role === "admin" || perms.includes("view_all_projects");
        if (!hasViewAll) {
          const assigned = project.assigned_staff || [];
          const userAssigned = assigned.includes(user.id) || assigned.includes(user.email);
          if (!userAssigned) {
            return { ok: false, error: "Forbidden - project not assigned", status: 403 };
          }
        }
        return { ok: true, project, isStaff: true };
      }
      // Customer access: check assigned_customers by user ID or email
      const custs = project.assigned_customers || [];
      const hasCustAccess = custs.includes(user.id) || custs.includes(user.email);
      if (!hasCustAccess) {
        // Log suspicious access attempt
        await base44.asServiceRole.entities.AuditLog.create({
          target_type: "project", target_id: projectId, action: "portal_access_denied",
          action_type: "portal_access_denied",
          description: `${user.email} denied customer portal access to project ${project.name}`,
          actor_user_id: user.id, actor_name: actor, actor_role: user.role,
          project_id: projectId, severity: "high"
        }).catch(() => {});
        return { ok: false, error: "Forbidden", status: 403 };
      }
      return { ok: true, project, isStaff: false };
    }

    // Strip sensitive fields from project for customer response
    function sanitizeProjectForCustomer(project) {
      return {
        id: project.id, name: project.name, address: project.address,
        project_type: project.project_type, status: project.status,
        start_date: project.start_date, target_completion_date: project.target_completion_date,
        selections_due_date: project.selections_due_date,
        pricing_visibility: project.pricing_visibility,
        allowance_visibility: project.allowance_visibility,
        total_allowance: project.total_allowance,
        customer_notes: project.customer_notes
      };
    }

    // ==================== LIST MY PROJECTS ====================
    if (action === "list_my_projects") {
      if (isStaff) {
        // Staff see all projects (or assigned only based on permissions)
        const perms = user.permissions || [];
        const hasViewAll = user.role === "admin" || perms.includes("view_all_projects");
        let projects;
        if (hasViewAll) {
          projects = await base44.asServiceRole.entities.Project.list("-updated_date", 200);
        } else {
          // Get all and filter by assigned_staff
          projects = await base44.asServiceRole.entities.Project.list("-updated_date", 200);
          projects = projects.filter(p =>
            (p.assigned_staff || []).includes(user.id) || (p.assigned_staff || []).includes(user.email)
          );
        }
        return Response.json({ projects });
      }
      // Customer: find projects where assigned_customers includes user.id or email
      const allProjects = await base44.asServiceRole.entities.Project.list("-updated_date", 200);
      const myProjects = allProjects.filter(p =>
        (p.assigned_customers || []).includes(user.id) || (p.assigned_customers || []).includes(user.email)
      );
      return Response.json({ projects: myProjects.map(sanitizeProjectForCustomer) });
    }

    // ==================== GET PROJECT DASHBOARD ====================
    if (action === "get_project_dashboard") {
      const { project_id } = body;
      if (!project_id) return Response.json({ error: "project_id required" }, { status: 400 });
      const access = await verifyProjectAccess(project_id);
      if (!access.ok) return Response.json({ error: access.error }, { status: access.status });

      const [areas, requirements] = await Promise.all([
        base44.asServiceRole.entities.ProjectArea.filter({ project_id }, null, 500),
        base44.asServiceRole.entities.SelectionRequirement.filter({ project_id }, null, 500)
      ]);

      const project = access.isStaff ? access.project : sanitizeProjectForCustomer(access.project);
      return Response.json({ project, areas, requirements });
    }

    // ==================== GET PROJECT AREA ====================
    if (action === "get_project_area") {
      const { project_id, area_id } = body;
      if (!project_id || !area_id) return Response.json({ error: "project_id and area_id required" }, { status: 400 });
      const access = await verifyProjectAccess(project_id);
      if (!access.ok) return Response.json({ error: access.error }, { status: access.status });

      const area = await base44.asServiceRole.entities.ProjectArea.get(area_id).catch(() => null);
      if (!area || area.project_id !== project_id) {
        return Response.json({ error: "Area not found in this project" }, { status: 404 });
      }

      const [requirements, selections] = await Promise.all([
        base44.asServiceRole.entities.SelectionRequirement.filter({ area_id }, null, 500),
        base44.asServiceRole.entities.CustomerSelection.filter({ area_id }, null, 500)
      ]);
      const currentSelections = selections.filter(s => s.is_current);

      // Fetch catalogue items for current selections
      let catalogueItems = [];
      const itemIds = [...new Set(currentSelections.map(s => s.catalogue_item_id).filter(Boolean))];
      if (itemIds.length > 0) {
        const [rawItems, groups, values, rules] = await Promise.all([
          base44.asServiceRole.entities.CatalogueItem.list(null, 200),
          base44.asServiceRole.entities.CatalogueOptionGroup.filter({ is_active: true }, null, 500),
          base44.asServiceRole.entities.CatalogueOptionValue.filter({ is_active: true }, null, 500),
          base44.asServiceRole.entities.CatalogueOptionRule.filter({ is_active: true }, null, 500)
        ]);
        const filteredItems = rawItems.filter(i => itemIds.includes(i.id) && i.status !== "Discontinued");
        catalogueItems = filteredItems.map(item => assembleItem(item, groups, values, rules));
      }

      return Response.json({ area, requirements, selections: currentSelections, catalogueItems });
    }

    // ==================== GET SELECTION DETAIL ====================
    if (action === "get_selection_detail") {
      const { project_id, area_id, requirement_id } = body;
      if (!project_id || !requirement_id) return Response.json({ error: "project_id and requirement_id required" }, { status: 400 });
      const access = await verifyProjectAccess(project_id);
      if (!access.ok) return Response.json({ error: access.error }, { status: access.status });

      const requirement = await base44.asServiceRole.entities.SelectionRequirement.get(requirement_id).catch(() => null);
      if (!requirement || requirement.project_id !== project_id) {
        return Response.json({ error: "Requirement not found in this project" }, { status: 404 });
      }

      const [project, selections, changeRequests, suggested] = await Promise.all([
        Promise.resolve(access.project),
        base44.asServiceRole.entities.CustomerSelection.filter({ requirement_id }, null, 200),
        base44.asServiceRole.entities.ChangeRequest.filter({ requirement_id }, null, 200),
        base44.asServiceRole.entities.ProjectAvailableCatalogueItem.filter({ requirement_id }, null, 200)
      ]);

      let area = null;
      if (area_id) {
        area = await base44.asServiceRole.entities.ProjectArea.get(area_id).catch(() => null);
        if (area && area.project_id !== project_id) area = null;
      }

      // Determine visible catalogue items based on access mode
      const accessMode = requirement.customer_catalogue_access_mode || "suggested_only";
      const itemFilter = requirement.category ? { category: requirement.category } : {};
      const [rawItems, groups, values, rules] = await Promise.all([
        base44.asServiceRole.entities.CatalogueItem.filter(itemFilter, "name", 200),
        base44.asServiceRole.entities.CatalogueOptionGroup.filter({ is_active: true }, null, 500),
        base44.asServiceRole.entities.CatalogueOptionValue.filter({ is_active: true }, null, 500),
        base44.asServiceRole.entities.CatalogueOptionRule.filter({ is_active: true }, null, 500)
      ]);

      const suggestedSorted = suggested.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
      let visibleItems = rawItems.filter(i => i.status !== "Discontinued" && i.status !== "Draft");

      if (accessMode === "suggested_only" || accessMode === "suggested_plus_request") {
        const suggestedItemIds = suggestedSorted.filter(s => s.is_available !== false).map(s => s.catalogue_item_id);
        visibleItems = visibleItems.filter(i => suggestedItemIds.includes(i.id));
      } else if (accessMode === "staff_only") {
        visibleItems = [];
      }

      const catalogueItems = visibleItems.map(item => assembleItem(item, groups, values, rules));

      // For customers, strip internal notes from requirements and areas
      const safeRequirement = access.isStaff ? requirement : {
        ...requirement,
        staff_notes: undefined
      };
      const safeArea = area ? (access.isStaff ? area : { ...area, internal_notes: undefined }) : null;

      return Response.json({
        project: access.isStaff ? project : sanitizeProjectForCustomer(project),
        area: safeArea,
        requirement: safeRequirement,
        selections,
        changeRequests,
        suggestedOptions: suggestedSorted,
        catalogueItems
      });
    }

    // ==================== GET MOOD BOARD ====================
    if (action === "get_mood_board") {
      const { project_id } = body;
      if (!project_id) return Response.json({ error: "project_id required" }, { status: 400 });
      const access = await verifyProjectAccess(project_id);
      if (!access.ok) return Response.json({ error: access.error }, { status: access.status });

      const [items, areas, comments] = await Promise.all([
        base44.asServiceRole.entities.MoodBoardItem.filter({ project_id }, "-created_date", 200),
        base44.asServiceRole.entities.ProjectArea.filter({ project_id }, null, 200),
        base44.asServiceRole.entities.Comment.filter({ project_id, target_type: "mood_board" }, null, 500)
      ]);

      // For customers, strip internal notes from mood board items
      const safeItems = access.isStaff ? items : items.map(i => ({ ...i, internal_notes: undefined }));
      // For customers, filter out internal comments
      const safeComments = access.isStaff ? comments : comments.filter(c => !c.is_internal);

      const commentCounts = {};
      (access.isStaff ? comments : safeComments).forEach(c => {
        commentCounts[c.target_id] = (commentCounts[c.target_id] || 0) + 1;
      });

      return Response.json({ items: safeItems, areas, commentCounts });
    }

    // ==================== CREATE MOOD BOARD ITEM ====================
    if (action === "create_mood_board_item") {
      const { project_id, area_id, selection_category, image_url, link, notes, tags, priority, selection_type, style } = body;
      if (!project_id) return Response.json({ error: "project_id required" }, { status: 400 });
      const access = await verifyProjectAccess(project_id);
      if (!access.ok) return Response.json({ error: access.error }, { status: access.status });

      // Verify area belongs to project if provided
      if (area_id) {
        const area = await base44.asServiceRole.entities.ProjectArea.get(area_id).catch(() => null);
        if (!area || area.project_id !== project_id) {
          return Response.json({ error: "Area not found in this project" }, { status: 404 });
        }
      }

      const item = await base44.asServiceRole.entities.MoodBoardItem.create({
        project_id, area_id: area_id || null, selection_category: selection_category || "",
        image_url: image_url || "", link: link || "", notes: notes || "",
        tags: tags || [], priority: priority || "Medium",
        selection_type: selection_type || "", style: style || ""
      });

      await base44.asServiceRole.entities.AuditLog.create({
        target_type: "mood_board_item", target_id: item.id, action: "mood_board_item_created",
        action_type: "mood_board_item_created",
        description: `${actor} created mood board item in project ${access.project.name}`,
        actor_user_id: user.id, actor_name: actor, actor_role: user.role,
        project_id, severity: "medium"
      }).catch(() => {});

      return Response.json({ item });
    }

    // ==================== DELETE MOOD BOARD ITEM ====================
    if (action === "delete_mood_board_item") {
      const { project_id, item_id } = body;
      if (!project_id || !item_id) return Response.json({ error: "project_id and item_id required" }, { status: 400 });
      const access = await verifyProjectAccess(project_id);
      if (!access.ok) return Response.json({ error: access.error }, { status: access.status });

      const item = await base44.asServiceRole.entities.MoodBoardItem.get(item_id).catch(() => null);
      if (!item || item.project_id !== project_id) {
        return Response.json({ error: "Item not found in this project" }, { status: 404 });
      }

      await base44.asServiceRole.entities.MoodBoardItem.delete(item_id);

      await base44.asServiceRole.entities.AuditLog.create({
        target_type: "mood_board_item", target_id: item_id, action: "mood_board_item_deleted",
        action_type: "mood_board_item_deleted",
        description: `${actor} deleted mood board item in project ${access.project.name}`,
        actor_user_id: user.id, actor_name: actor, actor_role: user.role,
        project_id, severity: "medium"
      }).catch(() => {});

      return Response.json({ ok: true });
    }

    // ==================== UPDATE MOOD BOARD ITEM (favourite toggle) ====================
    if (action === "update_mood_board_item") {
      const { project_id, item_id, updates } = body;
      if (!project_id || !item_id) return Response.json({ error: "project_id and item_id required" }, { status: 400 });
      const access = await verifyProjectAccess(project_id);
      if (!access.ok) return Response.json({ error: access.error }, { status: access.status });

      const item = await base44.asServiceRole.entities.MoodBoardItem.get(item_id).catch(() => null);
      if (!item || item.project_id !== project_id) {
        return Response.json({ error: "Item not found in this project" }, { status: 404 });
      }

      // Customers may only update safe fields; staff-only fields require staff role
      const customerFields = ["is_favourite", "tags", "notes", "link", "priority"];
      const staffFields = ["is_favourite", "is_reviewed", "linked_requirement_id", "internal_notes", "tags", "notes", "link", "priority"];
      const allowedFields = access.isStaff ? staffFields : customerFields;
      const safeUpdates = {};
      for (const key of allowedFields) {
        if (updates[key] !== undefined) safeUpdates[key] = updates[key];
      }

      const updated = await base44.asServiceRole.entities.MoodBoardItem.update(item_id, safeUpdates);
      return Response.json({ item: updated });
    }

    // ==================== CREATE COMMENT ====================
    if (action === "create_comment") {
      const { project_id, target_type, target_id, content, is_internal, attachments } = body;
      if (!project_id || !target_type || !target_id || !content) {
        return Response.json({ error: "project_id, target_type, target_id, and content are required" }, { status: 400 });
      }
      const access = await verifyProjectAccess(project_id);
      if (!access.ok) return Response.json({ error: access.error }, { status: access.status });

      // Duplicate check: prevent double-post of identical content from same user within 30 seconds
      const recentComments = await base44.asServiceRole.entities.Comment.filter(
        { project_id, target_type, target_id, created_by_id: user.id }, "-created_date", 5
      );
      const thirtySecondsAgo = new Date(Date.now() - 30000).toISOString();
      const duplicate = recentComments.find(c =>
        c.content === content && c.created_date && c.created_date >= thirtySecondsAgo
      );
      if (duplicate) {
        return Response.json({ comment: duplicate, duplicate: true });
      }

      // Customers can never create internal notes
      const finalIsInternal = access.isStaff ? !!is_internal : false;
      const authorRole = access.isStaff ? "staff" : "customer";

      const comment = await base44.asServiceRole.entities.Comment.create({
        project_id, target_type, target_id, content,
        is_internal: finalIsInternal,
        author_name: actor, author_role: authorRole,
        attachments: attachments || []
      });

      // Notify staff when customer comments, or notify customers when staff posts publicly
      if (!access.isStaff) {
        try {
          await base44.functions.invoke("sendNotifications", {
            target_all_staff: true, project_id, type: "new_comment",
            title: "New customer comment", message: `${actor}: ${content.slice(0, 120)}`,
            link: "", skip_email: true
          });
        } catch {}
      } else if (!finalIsInternal) {
        // Notify assigned customers of public staff comment
        try {
          const custs = access.project.assigned_customers || [];
          if (custs.length > 0) {
            await base44.asServiceRole.entities.Notification.bulkCreate(
              custs.map(id => ({
                user_id: id, project_id, type: "new_comment",
                title: "New message from staff", message: `${actor}: ${content.slice(0, 120)}`, is_read: false
              }))
            );
          }
        } catch {}
      }

      return Response.json({ comment });
    }

    // ==================== GET COMMENTS ====================
    if (action === "get_comments") {
      const { project_id, target_type, target_id } = body;
      if (!project_id || !target_type || !target_id) {
        return Response.json({ error: "project_id, target_type, and target_id are required" }, { status: 400 });
      }
      const access = await verifyProjectAccess(project_id);
      if (!access.ok) return Response.json({ error: access.error }, { status: access.status });

      const comments = await base44.asServiceRole.entities.Comment.filter(
        { project_id, target_type, target_id }, null, 500
      );
      // For customers, filter out internal notes
      const safeComments = access.isStaff ? comments : comments.filter(c => !c.is_internal);

      return Response.json({ comments: safeComments.sort((a, b) => (a.created_date || "").localeCompare(b.created_date || "")) });
    }

    // ==================== LIST MY NOTIFICATIONS ====================
    if (action === "list_my_notifications") {
      const notifications = await base44.asServiceRole.entities.Notification.filter(
        { user_id: user.id }, "-created_date", 50
      );
      return Response.json({ notifications });
    }

    // ==================== MARK NOTIFICATION READ ====================
    if (action === "mark_notification_read") {
      const { notification_id } = body;
      if (!notification_id) return Response.json({ error: "notification_id required" }, { status: 400 });
      const notif = await base44.asServiceRole.entities.Notification.get(notification_id).catch(() => null);
      if (!notif) return Response.json({ error: "Notification not found" }, { status: 404 });
      if (notif.user_id !== user.id) return Response.json({ error: "Forbidden" }, { status: 403 });
      await base44.asServiceRole.entities.Notification.update(notification_id, { is_read: true });
      return Response.json({ ok: true });
    }

    // ==================== GET PROJECT TIMELINE ====================
    if (action === "get_project_timeline") {
      const { project_id } = body;
      if (!project_id) return Response.json({ error: "project_id required" }, { status: 400 });
      const access = await verifyProjectAccess(project_id);
      if (!access.ok) return Response.json({ error: access.error }, { status: access.status });

      const [comments, crs] = await Promise.all([
        base44.asServiceRole.entities.Comment.filter({ project_id }, null, 500),
        base44.asServiceRole.entities.ChangeRequest.filter({ project_id }, null, 500)
      ]);

      // For customers, filter out internal comments
      const safeComments = access.isStaff ? comments : comments.filter(c => !c.is_internal);
      // Ledger entries are staff-only
      let ledger = [];
      if (access.isStaff) {
        ledger = await base44.asServiceRole.entities.AllowanceLedger.filter({ project_id }, null, 500);
      }

      return Response.json({ comments: safeComments, changeRequests: crs, ledger });
    }

    // ==================== GET SUBSTITUTIONS ====================
    if (action === "get_substitutions") {
      const { project_id, selection_id } = body;
      if (!project_id || !selection_id) return Response.json({ error: "project_id and selection_id required" }, { status: 400 });
      const access = await verifyProjectAccess(project_id);
      if (!access.ok) return Response.json({ error: access.error }, { status: access.status });

      // Verify selection belongs to project
      const sel = await base44.asServiceRole.entities.CustomerSelection.get(selection_id).catch(() => null);
      if (!sel || sel.project_id !== project_id) {
        return Response.json({ error: "Selection not found in this project" }, { status: 404 });
      }

      const recs = await base44.asServiceRole.entities.SubstitutionRecommendation.filter(
        { selection_id }, "-created_date", 100
      );
      return Response.json({ recommendations: recs });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

// Helper: assemble catalogue item with option groups, values, and rules
function assembleItem(item, groups, values, rules) {
  const itemGroups = (groups || [])
    .filter(g => g.catalogue_item_id === item.id)
    .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
    .map(g => ({
      id: g.id, name: g.name, is_required: g.is_required !== false,
      options: (values || [])
        .filter(v => v.option_group_id === g.id)
        .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
    }));
  const itemRules = (rules || [])
    .filter(r => r.catalogue_item_id === item.id)
    .map(r => ({
      ...r,
      condition_option_id: r.condition_option_value_id,
      target_option_id: r.target_option_value_id
    }));
  return { ...item, option_groups: itemGroups, option_rules: itemRules };
}