import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import * as XLSX from 'npm:xlsx@0.18.5';

const EXPORT_COLUMNS = [
  "Title", "Description", "Parent Group", "Parent Group Description", "Subgroup",
  "Subgroup Description", "Cost Code", "Quantity", "Unit", "Unit Cost", "Cost Type",
  "Total Cost", "Internal Notes", "Markup", "Markup Type", "Line Item Type", "Tax"
];

/**
 * Build Buildertrend cost fields (quantity, unitCost, totalCost) for a selection.
 *
 * Buildertrend expects: Quantity × Unit Cost = Total Cost.
 *
 * CustomerSelection.calculated_price represents the FULL configured selection price
 * (base price + all option price modifiers). It is NOT a per-unit price. So when
 * calculated_price is present we export:
 *   Quantity = 1, Unit Cost = calculated_price, Total Cost = calculated_price
 *
 * Only when there is no calculated price do we fall back to true catalogue unit
 * pricing (default_quantity × base_price).
 *
 * Returns { quantity, unitCost, totalCost, warning } where `warning` is non-null
 * when the pricing basis is uncertain.
 */
function buildBuildertrendCost(selection, catalogueItem) {
  // Staff override is an explicit total price for the selection.
  if (selection.staff_price_override != null && Number(selection.staff_price_override) > 0) {
    return {
      quantity: 1,
      unitCost: Number(selection.staff_price_override),
      totalCost: Number(selection.staff_price_override),
      warning: "Staff price override used as total (qty=1, unit cost=override)"
    };
  }

  const calculatedPrice = Number(selection.calculated_price || 0);

  // calculated_price is the full configured price — export as qty=1 so total matches.
  if (calculatedPrice > 0) {
    return {
      quantity: 1,
      unitCost: calculatedPrice,
      totalCost: calculatedPrice,
      warning: null
    };
  }

  // No selection price — fall back to catalogue unit pricing.
  const quantity = Number(catalogueItem.default_quantity || 1);
  const unitCost = Number(catalogueItem.base_price || 0);
  const totalCost = quantity * unitCost;

  const warnings = [];
  warnings.push("No calculated selection price — used catalogue base price × default quantity");
  if (unitCost === 0) warnings.push("Unit cost is 0");

  return {
    quantity,
    unitCost,
    totalCost,
    warning: warnings.join("; ")
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin" && user.role !== "staff") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { project_id, scope = "all", area_id, selection_id, parent_group, subgroup } = body;

    if (!project_id && !selection_id) {
      return Response.json({ error: "project_id or selection_id is required" }, { status: 400 });
    }

    // Verify project access
    if (project_id) {
      const project = await base44.asServiceRole.entities.Project.get(project_id).catch(() => null);
      if (!project) return Response.json({ error: "Project not found" }, { status: 404 });
      if (user.role !== "admin") {
        const perms = user.permissions || [];
        const hasViewAll = perms.includes("view_all_projects");
        if (!hasViewAll) {
          const assigned = project.assigned_staff || [];
          if (!assigned.includes(user.id) && !assigned.includes(user.email)) {
            return Response.json({ error: "Forbidden - project not assigned" }, { status: 403 });
          }
        }
      }
    }

    // Fetch selections based on scope
    let selections = [];
    if (selection_id) {
      const sel = await base44.asServiceRole.entities.CustomerSelection.get(selection_id).catch(() => null);
      if (!sel) return Response.json({ error: "Selection not found" }, { status: 404 });
      selections = [sel];
    } else {
      const filter = { project_id };
      if (area_id) filter.area_id = area_id;
      const allSels = await base44.asServiceRole.entities.CustomerSelection.filter(filter, null, 2000);
      selections = allSels.filter(s => s.is_current !== false);

      if (scope === "approved") {
        selections = selections.filter(s => s.status === "Approved");
      } else if (scope === "ready_to_order") {
        const procItems = await base44.asServiceRole.entities.ProcurementItem.filter({ project_id }, null, 2000);
        const readyIds = new Set(procItems.filter(p => ["Ready to Order", "Ordered"].includes(p.status)).map(p => p.selection_id));
        selections = selections.filter(s => readyIds.has(s.id));
      } else if (scope === "allowance_only") {
        selections = selections.filter(s => (s.allowance_amount || 0) > 0);
      }
    }

    if (selections.length === 0) {
      return Response.json({ error: "No selections found for the given scope" }, { status: 404 });
    }

    // Fetch catalogue items and requirements
    const catItemIds = [...new Set(selections.map(s => s.catalogue_item_id).filter(Boolean))];
    const reqIds = [...new Set(selections.map(s => s.requirement_id).filter(Boolean))];

    const [catItems, requirements] = await Promise.all([
      Promise.all(catItemIds.map(id => base44.asServiceRole.entities.CatalogueItem.get(id).catch(() => null))),
      Promise.all(reqIds.map(id => base44.asServiceRole.entities.SelectionRequirement.get(id).catch(() => null)))
    ]);

    const catMap = {};
    catItems.forEach(c => { if (c) catMap[c.id] = c; });
    const reqMap = {};
    requirements.forEach(r => { if (r) reqMap[r.id] = r; });

    // Build export rows
    const rows = [];
    const warnings = [];
    const costWarnings = [];

    for (const sel of selections) {
      const cat = catMap[sel.catalogue_item_id];
      const req = reqMap[sel.requirement_id];
      if (!cat) {
        warnings.push({ selection_id: sel.id, message: "Catalogue item not found" });
        continue;
      }

      // Apply option overrides
      let title = cat.name;
      let description = cat.customer_description || cat.description || "";
      let costCode = cat.cost_code || "";
      let costType = cat.cost_type || "";
      let markup = cat.markup || 0;
      let markupType = cat.markup_type || "";
      let taxStatus = cat.tax_status || (cat.taxable ? "Taxable" : "Non-Taxable");

      // Apply selected option overrides
      for (const opt of (sel.selected_options || [])) {
        const optVal = await base44.asServiceRole.entities.CatalogueOptionValue.get(opt.option_id).catch(() => null);
        if (optVal) {
          if (optVal.buildertrend_title_override) title = optVal.buildertrend_title_override;
          if (optVal.buildertrend_description_override) description = optVal.buildertrend_description_override;
          if (optVal.cost_code_override) costCode = optVal.cost_code_override;
          if (optVal.cost_type_override) costType = optVal.cost_type_override;
          if (optVal.markup_override != null) markup = optVal.markup_override;
          if (optVal.markup_type_override) markupType = optVal.markup_type_override;
          if (optVal.tax_status_override) taxStatus = optVal.tax_status_override;
        }
      }

      // Build cost using the dedicated helper (Quantity × Unit Cost = Total Cost)
      const cost = buildBuildertrendCost(sel, cat);
      if (cost.warning) {
        costWarnings.push({ selection_id: sel.id, title, warning: cost.warning });
      }

      const parentGroup = cat.parent_group || "";
      const subgroupVal = cat.subgroup || "";

      // Filter by parent_group/subgroup if specified
      if (parent_group && parentGroup !== parent_group) continue;
      if (subgroup && subgroupVal !== subgroup) continue;

      // Build internal notes
      let internalNotes = cat.internal_notes || "";
      if (req && req.staff_notes) {
        internalNotes = internalNotes ? internalNotes + " | " + req.staff_notes : req.staff_notes;
      }

      // Check for missing required fields
      const rowWarnings = [];
      if (!cost.unitCost) rowWarnings.push("Missing Unit Cost");
      if (!cat.unit_of_measure) rowWarnings.push("Missing Unit");
      if (!cat.line_item_type) rowWarnings.push("Missing Line Item Type");
      if (!taxStatus) rowWarnings.push("Missing Tax Status");
      if (!parentGroup) rowWarnings.push("Missing Parent Group");
      if (!subgroupVal) rowWarnings.push("Missing Subgroup");
      if (!costCode) rowWarnings.push("Missing Cost Code");
      if (!cost.quantity) rowWarnings.push("Missing Quantity");
      if (!description) rowWarnings.push("No description");
      if (!cat.default_image) rowWarnings.push("No image");
      if (cost.warning) rowWarnings.push("Pricing basis uncertain");

      rows.push({
        title, description,
        parentGroup, parentGroupDescription: cat.parent_group_description || "",
        subgroup: subgroupVal, subgroupDescription: cat.subgroup_description || "",
        costCode, quantity: cost.quantity, unit: cat.unit_of_measure || "ea",
        unitCost: cost.unitCost, costType, totalCost: cost.totalCost,
        internalNotes, markup, markupType,
        lineItemType: cat.line_item_type || "",
        tax: taxStatus,
        warnings: rowWarnings,
        costWarning: cost.warning,
        selection_id: sel.id,
        catalogue_item_id: cat.id,
        catalogue_item_name: cat.name
      });
    }

    // If preview mode, return rows as JSON
    if (body.preview) {
      const totalCost = rows.reduce((sum, r) => sum + (r.totalCost || 0), 0);
      const totalAllowance = selections.reduce((sum, s) => sum + (s.allowance_amount || 0), 0);
      const taxableTotal = rows.filter(r => r.tax === "Taxable").reduce((sum, r) => sum + (r.totalCost || 0), 0);
      const nonTaxableTotal = rows.filter(r => r.tax === "Non-Taxable").reduce((sum, r) => sum + (r.totalCost || 0), 0);
      return Response.json({
        ok: true,
        rows,
        warnings,
        costWarnings,
        summary: {
          totalRows: rows.length,
          totalCost,
          totalAllowance,
          taxableTotal,
          nonTaxableTotal,
          rowsWithWarnings: rows.filter(r => r.warnings.length > 0).length,
          rowsWithCostWarnings: costWarnings.length
        }
      });
    }

    // Generate XLSX
    const xlsxData = rows.map(r => ({
      "Title": r.title,
      "Description": r.description,
      "Parent Group": r.parentGroup,
      "Parent Group Description": r.parentGroupDescription,
      "Subgroup": r.subgroup,
      "Subgroup Description": r.subgroupDescription,
      "Cost Code": r.costCode,
      "Quantity": r.quantity,
      "Unit": r.unit,
      "Unit Cost": r.unitCost,
      "Cost Type": r.costType,
      "Total Cost": r.totalCost,
      "Internal Notes": r.internalNotes,
      "Markup": r.markup,
      "Markup Type": r.markupType,
      "Line Item Type": r.lineItemType,
      "Tax": r.tax
    }));

    const ws = XLSX.utils.json_to_sheet(xlsxData, { header: EXPORT_COLUMNS });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Buildertrend Export");

    const xlsxBuffer = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    const xlsxBytes = new Uint8Array(xlsxBuffer);

    const projectName = project_id ? (await base44.asServiceRole.entities.Project.get(project_id).catch(() => null))?.name || "project" : "selection";
    const filename = `buildertrend_${projectName.replace(/\s+/g, "_").toLowerCase()}_${scope}.xlsx`;

    return new Response(xlsxBytes, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});