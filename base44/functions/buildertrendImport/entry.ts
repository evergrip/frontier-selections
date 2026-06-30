import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import * as XLSX from 'npm:xlsx@0.18.5';

const REQUIRED_COLUMNS = [
  "Title", "Description", "Parent Group", "Parent Group Description", "Subgroup",
  "Subgroup Description", "Cost Code", "Quantity", "Unit", "Unit Cost", "Cost Type",
  "Total Cost", "Internal Notes", "Markup", "Markup Type", "Line Item Type", "Tax"
];

const COLUMN_ALIASES = {
  "title": "Title", "name": "Title", "item": "Title",
  "desc": "Description", "description": "Description",
  "parent group": "Parent Group", "parentgroup": "Parent Group",
  "parent group description": "Parent Group Description",
  "subgroup": "Subgroup", "sub group": "Subgroup",
  "subgroup description": "Subgroup Description", "sub group description": "Subgroup Description",
  "cost code": "Cost Code", "costcode": "Cost Code", "code": "Cost Code",
  "qty": "Quantity", "quantity": "Quantity",
  "unit": "Unit", "uom": "Unit",
  "unit cost": "Unit Cost", "price": "Unit Cost", "cost": "Unit Cost",
  "cost type": "Cost Type", "costtype": "Cost Type",
  "total cost": "Total Cost", "total": "Total Cost",
  "internal notes": "Internal Notes", "notes": "Internal Notes",
  "markup": "Markup",
  "markup type": "Markup Type", "markuptype": "Markup Type",
  "line item type": "Line Item Type", "lineitemtype": "Line Item Type", "type": "Line Item Type",
  "tax": "Tax", "taxable": "Tax",
  "sku": "SKU", "model": "SKU", "model number": "SKU",
  "supplier": "Supplier", "vendor": "Supplier", "brand": "Supplier"
};

// Cost Code values that are placeholders, not real identifiers — never used for duplicate matching alone.
const PLACEHOLDER_COST_CODES = ["buildertrend flat rate", "flat rate", "n/a", "na", "none", ""];

function norm(val) {
  return String(val || "").toLowerCase().trim();
}

function numStr(val) {
  return String(Number(val || 0));
}

// ---- Duplicate detection index ----
// Composite keys only. Cost Code is NEVER used alone.
function buildDuplicateIndex(items) {
  const index = {};
  function add(key, item) {
    if (!key) return;
    if (!index[key]) index[key] = [];
    index[key].push(item);
  }
  for (const item of items) {
    const name = norm(item.name);
    if (!name) continue;
    const pg = norm(item.parent_group);
    const sg = norm(item.subgroup);
    const uc = numStr(item.base_price);
    const cc = norm(item.cost_code);

    add(`title::${name}`, item);
    add(`title_pg_sg::${name}::${pg}::${sg}`, item);
    add(`title_uc::${name}::${uc}`, item);
    add(`title_cc::${name}::${cc}`, item);
    add(`title_pg_sg_uc::${name}::${pg}::${sg}::${uc}`, item);

    if (item.sku) add(`sku::${norm(item.sku)}`, item);
    if (item.supplier) add(`supplier_title::${norm(item.supplier)}::${name}`, item);
  }
  return index;
}

function detectDuplicates(row, index, hasSkuColumn, hasSupplierColumn) {
  const title = norm(row.Title);
  const pg = norm(row["Parent Group"]);
  const sg = norm(row["Subgroup"]);
  const cc = norm(row["Cost Code"]);
  const uc = numStr(row["Unit Cost"]);
  const sku = hasSkuColumn ? norm(row.SKU) : "";
  const supplier = hasSupplierColumn ? norm(row.Supplier) : "";

  // Composite match definitions — Cost Code never used alone.
  const defs = [
    { type: "exact_title", key: `title::${title}` },
    { type: "title+parent+subgroup", key: `title_pg_sg::${title}::${pg}::${sg}` },
    { type: "title+unit_cost", key: `title_uc::${title}::${uc}` },
    { type: "title+cost_code", key: `title_cc::${title}::${cc}` },
    { type: "title+parent+subgroup+unit_cost", key: `title_pg_sg_uc::${title}::${pg}::${sg}::${uc}` }
  ];
  if (hasSkuColumn && sku) defs.push({ type: "sku", key: `sku::${sku}` });
  if (hasSupplierColumn && supplier && title) defs.push({ type: "supplier+title", key: `supplier_title::${supplier}::${title}` });

  const matches = [];
  const seenIds = new Set();
  for (const def of defs) {
    if (!def.key) continue;
    const found = index[def.key];
    if (!found) continue;
    for (const m of found) {
      if (seenIds.has(m.id)) continue;
      seenIds.add(m.id);
      matches.push({
        id: m.id, name: m.name, supplier: m.supplier, sku: m.sku,
        base_price: m.base_price, parent_group: m.parent_group, subgroup: m.subgroup,
        cost_code: m.cost_code, match_type: def.type
      });
    }
  }
  return matches;
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
    const { file_url, action = "preview", import_mode = "new_items", project_id, area_id, requirement_id, confirmed_rows } = body;

    if (!file_url && action === "preview") {
      return Response.json({ error: "file_url is required" }, { status: 400 });
    }

    // ===== PREVIEW: Parse XLSX and detect duplicates =====
    if (action === "preview") {
      let fileResponse;
      try {
        fileResponse = await fetch(file_url);
      } catch (fetchErr) {
        return Response.json({ error: "Failed to fetch file" }, { status: 400 });
      }
      if (!fileResponse.ok) return Response.json({ error: "Failed to fetch file" }, { status: 400 });

      let arrayBuffer;
      try {
        arrayBuffer = await fileResponse.arrayBuffer();
      } catch (bufErr) {
        return Response.json({ error: "Failed to fetch file" }, { status: 400 });
      }

      const workbook = XLSX.read(arrayBuffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) return Response.json({ error: "No worksheets found in file" }, { status: 400 });
      const sheet = workbook.Sheets[sheetName];
      const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

      if (rawRows.length === 0) {
        return Response.json({ error: "No data rows found in the first worksheet" }, { status: 400 });
      }

      // Normalize column headers
      const rawHeaders = Object.keys(rawRows[0]);
      const headerMap = {};
      const unmatchedHeaders = [];

      for (const header of rawHeaders) {
        const normalized = header.toLowerCase().trim();
        const mapped = COLUMN_ALIASES[normalized] || (REQUIRED_COLUMNS.includes(header) ? header : null);
        if (mapped) {
          headerMap[header] = mapped;
        } else {
          unmatchedHeaders.push(header);
        }
      }

      const mappedColumns = new Set(Object.values(headerMap));
      const missingColumns = REQUIRED_COLUMNS.filter(c => !mappedColumns.has(c));

      // Detect optional columns — only use SKU/Supplier if they actually exist in the file
      const hasSkuColumn = mappedColumns.has("SKU");
      const hasSupplierColumn = mappedColumns.has("Supplier");

      // Build normalized rows, preserving blank values (defval: "" already preserves them)
      const normalizedRows = rawRows.map((rawRow, idx) => {
        const row = {};
        for (const [rawHeader, mappedCol] of Object.entries(headerMap)) {
          row[mappedCol] = rawRow[rawHeader];
        }
        return { _rowIndex: idx + 2, ...row };
      }).filter(r => String(r.Title || "").trim() || String(r["Unit Cost"] || "").trim());

      // Fetch existing catalogue items for duplicate detection
      const existingItems = await base44.asServiceRole.entities.CatalogueItem.list("-updated_date", 2000);
      const dupIndex = buildDuplicateIndex(existingItems);

      // Detect duplicates for each row
      const rowsWithMatches = normalizedRows.map(row => {
        const matches = detectDuplicates(row, dupIndex, hasSkuColumn, hasSupplierColumn);

        // Validation warnings — separate Unit and Unit Cost, preserve blanks without crashing
        const rowWarnings = [];
        const title = String(row.Title || "").trim();
        if (!title) rowWarnings.push("Missing Title");
        if (!String(row["Unit"] || "").trim()) rowWarnings.push("Missing Unit");
        if (String(row["Unit Cost"] || "").trim() === "") rowWarnings.push("Missing Unit Cost");
        if (!String(row["Line Item Type"] || "").trim()) rowWarnings.push("Missing Line Item Type");
        if (!String(row["Tax"] || "").trim()) rowWarnings.push("Missing Tax Status");
        if (!String(row["Parent Group"] || "").trim()) rowWarnings.push("Missing Parent Group");
        if (!String(row["Subgroup"] || "").trim()) rowWarnings.push("Missing Subgroup");
        if (!String(row["Cost Code"] || "").trim()) rowWarnings.push("Missing Cost Code");
        if (PLACEHOLDER_COST_CODES.includes(norm(row["Cost Code"]))) rowWarnings.push("Cost Code is placeholder");

        return {
          ...row,
          _duplicate_matches: matches,
          _is_duplicate: matches.length > 0,
          _warnings: rowWarnings,
          _action: matches.length > 0 ? "skip" : "create"
        };
      });

      return Response.json({
        ok: true,
        sheetName,
        totalRows: normalizedRows.length,
        hasSkuColumn,
        hasSupplierColumn,
        columns: { mapped: [...new Set(Object.values(headerMap))], missing: missingColumns, unmatched: unmatchedHeaders },
        rows: rowsWithMatches,
        duplicateCount: rowsWithMatches.filter(r => r._is_duplicate).length
      });
    }

    // ===== CONFIRM: Create records based on confirmed rows =====
    if (action === "confirm") {
      if (!confirmed_rows || !Array.isArray(confirmed_rows)) {
        return Response.json({ error: "confirmed_rows array is required" }, { status: 400 });
      }

      // Verify project access for project-writing import modes
      if (project_id && ["suggested_options", "allowance_placeholders", "estimate_lines"].includes(import_mode)) {
        const project = await base44.asServiceRole.entities.Project.get(project_id).catch(() => null);
        if (!project) return Response.json({ error: "Project not found" }, { status: 404 });
        if (user.role !== "admin") {
          const perms = user.permissions || [];
          const hasAccess = perms.includes("view_all_projects") || perms.includes("manage_catalogue");
          if (!hasAccess) {
            const assigned = project.assigned_staff || [];
            if (!assigned.includes(user.id) && !assigned.includes(user.email)) {
              return Response.json({ error: "Forbidden - project not assigned" }, { status: 403 });
            }
          }
        }
      }

      const actor = user.full_name || user.email || "user";
      const created = [];
      const skipped = [];
      const errors = [];

      // Fetch existing items once for confirm-time re-check
      const existingItems = await base44.asServiceRole.entities.CatalogueItem.list("-updated_date", 2000);
      const dupIndex = buildDuplicateIndex(existingItems);

      for (const row of confirmed_rows) {
        if (row._action === "skip") {
          skipped.push(row);
          continue;
        }

        try {
          // Handle "update existing" action
          if (row._action === "update" && row._update_target_id) {
            const target = await base44.asServiceRole.entities.CatalogueItem.get(row._update_target_id).catch(() => null);
            if (!target) { errors.push({ row: { Title: row.Title }, error: "Target item not found for update" }); continue; }
            const taxVal = String(row.Tax || "").trim();
            await base44.asServiceRole.entities.CatalogueItem.update(row._update_target_id, {
              name: String(row.Title || "").trim() || target.name,
              description: String(row.Description || ""),
              customer_description: String(row.Description || ""),
              supplier: "Supplier" in row ? String(row.Supplier || "") : target.supplier,
              sku: "SKU" in row ? String(row.SKU || "") : target.sku,
              base_price: Number(row["Unit Cost"] || 0),
              default_quantity: row.Quantity !== "" && row.Quantity != null ? Number(row.Quantity) : target.default_quantity,
              unit_of_measure: String(row.Unit || ""),
              cost_code: String(row["Cost Code"] || ""),
              cost_type: String(row["Cost Type"] || ""),
              parent_group: String(row["Parent Group"] || ""),
              parent_group_description: String(row["Parent Group Description"] || ""),
              subgroup: String(row["Subgroup"] || ""),
              subgroup_description: String(row["Subgroup Description"] || ""),
              markup: Number(row.Markup || 0),
              markup_type: String(row["Markup Type"] || ""),
              line_item_type: String(row["Line Item Type"] || ""),
              tax_status: taxVal || "Taxable",
              taxable: taxVal ? taxVal === "Taxable" : true,
              internal_notes: String(row["Internal Notes"] || "")
            });
            created.push({ id: target.id, name: target.name, type: "updated_item" });
            continue;
          }

          const hasSku = "SKU" in row;
          const hasSupplier = "Supplier" in row;
          const title = String(row.Title || "").trim();

          // Confirm-time duplicate re-check using composite keys (not Cost Code as SKU)
          if (title) {
            const matches = detectDuplicates(row, dupIndex, hasSku, hasSupplier);
            if (matches.length > 0) {
              skipped.push({ ...row, _skip_reason: `Duplicate detected: ${matches[0].match_type}` });
              continue;
            }
          }

          if (import_mode === "new_items" || !import_mode) {
            const taxVal = String(row.Tax || "").trim();
            const newItem = await base44.asServiceRole.entities.CatalogueItem.create({
              name: title,
              description: String(row.Description || ""),
              customer_description: String(row.Description || ""),
              category: "Other",
              supplier: hasSupplier ? String(row.Supplier || "") : "",
              sku: hasSku ? String(row.SKU || "") : "",
              base_price: Number(row["Unit Cost"] || 0),
              default_quantity: row.Quantity !== "" && row.Quantity != null ? Number(row.Quantity) : 1,
              unit_of_measure: String(row.Unit || ""),
              cost_code: String(row["Cost Code"] || ""),
              cost_type: String(row["Cost Type"] || ""),
              parent_group: String(row["Parent Group"] || ""),
              parent_group_description: String(row["Parent Group Description"] || ""),
              subgroup: String(row["Subgroup"] || ""),
              subgroup_description: String(row["Subgroup Description"] || ""),
              markup: Number(row.Markup || 0),
              markup_type: String(row["Markup Type"] || ""),
              line_item_type: String(row["Line Item Type"] || ""),
              tax_status: taxVal || "Taxable",
              taxable: taxVal ? taxVal === "Taxable" : true,
              internal_notes: String(row["Internal Notes"] || ""),
              is_active: true,
              status: "Active"
            });
            created.push({ id: newItem.id, name: newItem.name, type: "catalogue_item" });

          } else if (import_mode === "suggested_options" && project_id) {
            if (!title) { errors.push({ row, error: "Missing title" }); continue; }

            let catItem = null;
            const existing = await base44.asServiceRole.entities.CatalogueItem.filter({ name: title }, null, 5);
            if (existing.length > 0) catItem = existing[0];

            if (!catItem) {
              catItem = await base44.asServiceRole.entities.CatalogueItem.create({
                name: title,
                description: String(row.Description || ""),
                category: "Other",
                supplier: hasSupplier ? String(row.Supplier || "") : "",
                sku: hasSku ? String(row.SKU || "") : "",
                base_price: Number(row["Unit Cost"] || 0),
                unit_of_measure: String(row.Unit || ""),
                cost_code: String(row["Cost Code"] || ""),
                parent_group: String(row["Parent Group"] || ""),
                subgroup: String(row["Subgroup"] || ""),
                line_item_type: String(row["Line Item Type"] || ""),
                tax_status: String(row.Tax || "Taxable"),
                is_active: true,
                status: "Active"
              });
            }

            const existingAssign = await base44.asServiceRole.entities.ProjectAvailableCatalogueItem.filter({
              project_id, catalogue_item_id: catItem.id,
              ...(requirement_id ? { requirement_id } : {})
            }, null, 5);

            if (existingAssign.length > 0) {
              skipped.push({ ...row, _skip_reason: "Already assigned to project" });
              continue;
            }

            await base44.asServiceRole.entities.ProjectAvailableCatalogueItem.create({
              project_id,
              area_id: area_id || null,
              requirement_id: requirement_id || null,
              catalogue_item_id: catItem.id,
              is_available: true,
              created_by: actor
            });
            created.push({ id: catItem.id, name: catItem.name, type: "suggested_option" });

          } else if (import_mode === "allowance_placeholders" && project_id) {
            const taxVal = String(row.Tax || "").trim();
            const newItem = await base44.asServiceRole.entities.CatalogueItem.create({
              name: title || "Allowance Placeholder",
              description: String(row.Description || ""),
              category: "Other",
              base_price: Number(row["Unit Cost"] || 0),
              default_quantity: row.Quantity !== "" && row.Quantity != null ? Number(row.Quantity) : 1,
              unit_of_measure: String(row.Unit || ""),
              cost_code: String(row["Cost Code"] || ""),
              parent_group: String(row["Parent Group"] || ""),
              subgroup: String(row["Subgroup"] || ""),
              line_item_type: "Allowance",
              tax_status: taxVal || "Taxable",
              is_active: true,
              status: "Active"
            });
            created.push({ id: newItem.id, name: newItem.name, type: "allowance_placeholder" });

          } else if (import_mode === "estimate_lines" && project_id) {
            await base44.asServiceRole.entities.ProcurementItem.create({
              project_id,
              area_id: area_id || null,
              item_name: title || "Imported Estimate Line",
              category: String(row["Parent Group"] || ""),
              supplier: hasSupplier ? String(row.Supplier || "") : "",
              quantity: row.Quantity !== "" && row.Quantity != null ? Number(row.Quantity) : 1,
              unit_of_measure: String(row.Unit || ""),
              status: "Not Ready to Order",
              procurement_notes: String(row["Internal Notes"] || "")
            });
            created.push({ name: title, type: "estimate_line" });
          }
        } catch (e) {
          errors.push({ row: { Title: row.Title }, error: e.message });
        }
      }

      return Response.json({
        ok: true,
        created_count: created.length,
        skipped_count: skipped.length,
        error_count: errors.length,
        created, skipped, errors
      });
    }

    return Response.json({ error: "Unknown action. Use 'preview' or 'confirm'." }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});