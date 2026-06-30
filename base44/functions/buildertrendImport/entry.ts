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
  "tax": "Tax", "taxable": "Tax"
};

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
      // Fetch the file
      const fileResponse = await fetch(file_url);
      if (!fileResponse.ok) return Response.json({ error: "Failed to fetch file" }, { status: 400 });
      const arrayBuffer = await fileResponse.arrayBuffer();
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

      // Check for required columns
      const mappedColumns = new Set(Object.values(headerMap));
      const missingColumns = REQUIRED_COLUMNS.filter(c => !mappedColumns.has(c));

      // Build normalized rows
      const normalizedRows = rawRows.map((rawRow, idx) => {
        const row = {};
        for (const [rawHeader, mappedCol] of Object.entries(headerMap)) {
          row[mappedCol] = rawRow[rawHeader];
        }
        return { _rowIndex: idx + 2, ...row };
      }).filter(r => r.Title || r["Unit Cost"] || r["Cost Code"]);

      // Fetch existing catalogue items for duplicate detection
      const existingItems = await base44.asServiceRole.entities.CatalogueItem.list("-updated_date", 2000);
      const existingByName = {};
      const existingBySku = {};
      const existingBySupplierName = {};

      for (const item of existingItems) {
        if (item.name) {
          const key = item.name.toLowerCase().trim();
          if (!existingByName[key]) existingByName[key] = [];
          existingByName[key].push(item);
        }
        if (item.sku) {
          const key = item.sku.toLowerCase().trim();
          existingBySku[key] = item;
        }
        if (item.supplier && item.name) {
          const key = `${item.supplier.toLowerCase().trim()}__${item.name.toLowerCase().trim()}`;
          existingBySupplierName[key] = item;
        }
      }

      // Detect duplicates for each row
      const rowsWithMatches = normalizedRows.map(row => {
        const title = String(row.Title || "").trim();
        const supplier = String(row.Supplier || "").trim();
        const sku = String(row.SKU || row["Cost Code"] || "").trim();
        const unitCost = Number(row["Unit Cost"] || 0);

        const matches = [];
        if (title && existingByName[title.toLowerCase()]) {
          matches.push(...existingByName[title.toLowerCase()].map(m => ({
            id: m.id, name: m.name, supplier: m.supplier, sku: m.sku,
            base_price: m.base_price, match_type: "name"
          })));
        }
        if (sku && existingBySku[sku.toLowerCase()]) {
          const m = existingBySku[sku.toLowerCase()];
          if (!matches.find(x => x.id === m.id)) {
            matches.push({ id: m.id, name: m.name, supplier: m.supplier, sku: m.sku, base_price: m.base_price, match_type: "sku" });
          }
        }
        if (supplier && title && existingBySupplierName[`${supplier.toLowerCase()}__${title.toLowerCase()}`]) {
          const m = existingBySupplierName[`${supplier.toLowerCase()}__${title.toLowerCase()}`];
          if (!matches.find(x => x.id === m.id)) {
            matches.push({ id: m.id, name: m.name, supplier: m.supplier, sku: m.sku, base_price: m.base_price, match_type: "supplier+name" });
          }
        }

        // Validation warnings
        const rowWarnings = [];
        if (!title) rowWarnings.push("Missing Title");
        if (!row["Unit"] && !row["Unit Cost"]) rowWarnings.push("Missing Unit");
        if (!unitCost && unitCost !== 0) rowWarnings.push("Missing Unit Cost");
        if (!row["Line Item Type"]) rowWarnings.push("Missing Line Item Type");
        if (!row["Tax"]) rowWarnings.push("Missing Tax Status");
        if (!row["Parent Group"]) rowWarnings.push("Missing Parent Group");

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
        columns: { mapped: Object.values(headerMap), missing: missingColumns, unmatched: unmatchedHeaders },
        rows: rowsWithMatches,
        duplicateCount: rowsWithMatches.filter(r => r._is_duplicate).length
      });
    }

    // ===== CONFIRM: Create records based on confirmed rows =====
    if (action === "confirm") {
      if (!confirmed_rows || !Array.isArray(confirmed_rows)) {
        return Response.json({ error: "confirmed_rows array is required" }, { status: 400 });
      }

      const actor = user.full_name || user.email || "user";
      const created = [];
      const skipped = [];
      const errors = [];

      for (const row of confirmed_rows) {
        if (row._action === "skip" || row._action === "update") {
          skipped.push(row);
          continue;
        }

        try {
          if (import_mode === "new_items" || !import_mode) {
            // Check for duplicate one more time
            const title = String(row.Title || "").trim();
            if (title) {
              const existing = await base44.asServiceRole.entities.CatalogueItem.filter({ name: title }, null, 10);
              const sku = String(row.SKU || row["Cost Code"] || "").trim();
              const exactMatch = existing.find(e =>
                (e.sku && sku && e.sku.toLowerCase() === sku.toLowerCase()) ||
                (e.supplier && row.Supplier && e.supplier.toLowerCase() === String(row.Supplier).toLowerCase())
              );
              if (exactMatch) {
                skipped.push({ ...row, _skip_reason: "Duplicate detected on confirm" });
                continue;
              }
            }

            const newItem = await base44.asServiceRole.entities.CatalogueItem.create({
              name: title,
              description: String(row.Description || ""),
              customer_description: String(row.Description || ""),
              category: "Other",
              supplier: String(row.Supplier || ""),
              sku: String(row.SKU || row["Cost Code"] || ""),
              base_price: Number(row["Unit Cost"] || 0),
              default_quantity: Number(row.Quantity || 1),
              unit_of_measure: String(row.Unit || "ea"),
              cost_code: String(row["Cost Code"] || "Buildertrend Flat Rate"),
              cost_type: String(row["Cost Type"] || ""),
              parent_group: String(row["Parent Group"] || ""),
              parent_group_description: String(row["Parent Group Description"] || ""),
              subgroup: String(row["Subgroup"] || ""),
              subgroup_description: String(row["Subgroup Description"] || ""),
              markup: Number(row.Markup || 0),
              markup_type: String(row["Markup Type"] || ""),
              line_item_type: String(row["Line Item Type"] || ""),
              tax_status: String(row.Tax || "Taxable"),
              taxable: String(row.Tax || "Taxable") === "Taxable",
              internal_notes: String(row["Internal Notes"] || ""),
              is_active: true,
              status: "Active"
            });
            created.push({ id: newItem.id, name: newItem.name, type: "catalogue_item" });

          } else if (import_mode === "suggested_options" && project_id) {
            // Create as project suggested options
            const title = String(row.Title || "").trim();
            if (!title) { errors.push({ row, error: "Missing title" }); continue; }

            // Find or create a catalogue item
            let catItem = null;
            const existing = await base44.asServiceRole.entities.CatalogueItem.filter({ name: title }, null, 5);
            if (existing.length > 0) catItem = existing[0];

            if (!catItem) {
              catItem = await base44.asServiceRole.entities.CatalogueItem.create({
                name: title,
                description: String(row.Description || ""),
                category: "Other",
                supplier: String(row.Supplier || ""),
                base_price: Number(row["Unit Cost"] || 0),
                unit_of_measure: String(row.Unit || "ea"),
                cost_code: String(row["Cost Code"] || "Buildertrend Flat Rate"),
                parent_group: String(row["Parent Group"] || ""),
                subgroup: String(row["Subgroup"] || ""),
                line_item_type: String(row["Line Item Type"] || ""),
                tax_status: String(row.Tax || "Taxable"),
                is_active: true,
                status: "Active"
              });
            }

            // Check for duplicate assignment
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
            // Create as allowance placeholder catalogue items
            const title = String(row.Title || "").trim();
            const newItem = await base44.asServiceRole.entities.CatalogueItem.create({
              name: title || "Allowance Placeholder",
              description: String(row.Description || ""),
              category: "Other",
              base_price: Number(row["Unit Cost"] || 0),
              default_quantity: Number(row.Quantity || 1),
              unit_of_measure: String(row.Unit || "allowance"),
              cost_code: String(row["Cost Code"] || "Buildertrend Flat Rate"),
              parent_group: String(row["Parent Group"] || ""),
              subgroup: String(row["Subgroup"] || ""),
              line_item_type: "Allowance",
              tax_status: String(row.Tax || "Taxable"),
              is_active: true,
              status: "Active"
            });
            created.push({ id: newItem.id, name: newItem.name, type: "allowance_placeholder" });

          } else if (import_mode === "estimate_lines" && project_id) {
            // Create as procurement/estimate line items
            const title = String(row.Title || "").trim();
            await base44.asServiceRole.entities.ProcurementItem.create({
              project_id,
              area_id: area_id || null,
              item_name: title || "Imported Estimate Line",
              category: String(row["Parent Group"] || ""),
              supplier: String(row.Supplier || ""),
              quantity: Number(row.Quantity || 1),
              unit_of_measure: String(row.Unit || "ea"),
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