import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const { project_id } = await req.json();
    const project = await base44.asServiceRole.entities.Project.get(project_id);
    const isStaff = user.role === "admin" || user.role === "staff";
    if (!isStaff) {
      const custs = project.assigned_customers || [];
      if (!custs.includes(user.id) && !custs.includes(user.email)) {
        return Response.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const [areas, reqs, sels, items, procs] = await Promise.all([
      base44.asServiceRole.entities.ProjectArea.filter({ project_id }, null, 1000),
      base44.asServiceRole.entities.SelectionRequirement.filter({ project_id }, null, 1000),
      base44.asServiceRole.entities.CustomerSelection.filter({ project_id }, null, 1000),
      base44.asServiceRole.entities.CatalogueItem.list(null, 1000),
      base44.asServiceRole.entities.ProcurementItem.filter({ project_id }, null, 1000)
    ]);
    const areaMap = {}; areas.forEach(a => areaMap[a.id] = a);
    const itemMap = {}; items.forEach(i => itemMap[i.id] = i);

    function fmt(d) { return d ? new Date(d).toLocaleDateString() : ""; }

    const packageItems = reqs.map(req => {
      const sel = sels.find(s => s.requirement_id === req.id && s.is_current && s.status === "Approved");
      if (!sel) return null;
      const item = itemMap[sel.catalogue_item_id];
      const proc = procs.find(p => p.requirement_id === req.id || p.selection_id === sel.id);
      return {
        area: areaMap[req.area_id]?.name || "",
        requirement: req.name,
        item: item?.name || "",
        options: (sel.selected_options || []).map(o => o.option_name).join(", "),
        image: item?.default_image || "",
        supplier: item?.supplier || "",
        brand: item?.brand || "",
        sku: item?.sku || "",
        qty: proc?.quantity || 1,
        price: sel.calculated_price || 0,
        allowanceImpact: (sel.over_allowance || 0) - (sel.under_allowance || 0),
        customerApprovalDate: fmt(sel.submitted_date),
        staffApprovalDate: fmt(sel.reviewed_date),
        notes: sel.customer_notes || req.customer_instructions || "",
        internalNotes: sel.internal_notes || req.staff_notes || "",
        procurementStatus: proc?.status || "",
        installNotes: item?.installation_notes || "",
        siteNotes: proc?.site_notes || ""
      };
    }).filter(Boolean);

    const showPrice = isStaff ? true : project.pricing_visibility !== "hidden";
    if (!isStaff) {
      packageItems.forEach(it => {
        delete it.internalNotes;
        delete it.procurementStatus;
        delete it.installNotes;
        delete it.siteNotes;
        delete it.staffApprovalDate;
      });
    }
    return Response.json({ project, packageItems, showPrice, showAllowance: showPrice });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});