import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import * as XLSX from 'npm:xlsx@0.18.5';

const EXPECTED_COLUMNS = [
  "Title", "Description", "Parent Group", "Parent Group Description", "Subgroup",
  "Subgroup Description", "Cost Code", "Quantity", "Unit", "Unit Cost", "Cost Type",
  "Total Cost", "Internal Notes", "Markup", "Markup Type", "Line Item Type", "Tax"
];

const EXPECTED_COLUMN_COUNT = 17;
const EXPECTED_ROW_COUNT = 7;

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

const PLACEHOLDER_COST_CODES = ["buildertrend flat rate", "flat rate", "n/a", "na", "none", ""];

function norm(val) { return String(val || "").toLowerCase().trim(); }
function numStr(val) { return String(Number(val || 0)); }

// Inlined duplicate detection (same logic as buildertrendImport)
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
      matches.push({ id: m.id, name: m.name, match_type: def.type });
    }
  }
  return matches;
}

function buildSampleRows() {
  const r = {};
  for (const c of EXPECTED_COLUMNS) r[c] = "";
  const make = (o) => ({ ...r, ...o });

  return [
    make({
      "Title": "Kitchen Faucet - Moen",
      "Description": "Single-handle pulldown faucet, chrome",
      "Parent Group": "Plumbing", "Parent Group Description": "Plumbing fixtures",
      "Subgroup": "Faucets", "Subgroup Description": "Kitchen and bath faucets",
      "Cost Code": "Buildertrend Flat Rate",
      "Quantity": 1, "Unit": "EA", "Unit Cost": 450, "Cost Type": "Material",
      "Total Cost": 450, "Internal Notes": "Verify rough-in",
      "Markup": 20, "Markup Type": "%", "Line Item Type": "Estimate", "Tax": "Taxable"
    }),
    make({
      "Title": "Bathroom Vanity 60in",
      "Description": "60-inch double vanity, espresso finish",
      "Parent Group": "Cabinets", "Parent Group Description": "Cabinet and vanity",
      "Subgroup": "Vanities", "Subgroup Description": "Bathroom vanities",
      "Cost Code": "BT-001",
      "Quantity": "", "Unit": "EA", "Unit Cost": 1200, "Cost Type": "Material",
      "Total Cost": 1200, "Internal Notes": "",
      "Markup": 15, "Markup Type": "C/P", "Line Item Type": "Allowance", "Tax": "Taxable"
    }),
    make({
      "Title": "Porcelain Tile 12x24",
      "Description": "Matte porcelain floor tile",
      "Parent Group": "Flooring", "Parent Group Description": "Flooring materials",
      "Subgroup": "", "Subgroup Description": "",
      "Cost Code": "FL-TILE",
      "Quantity": 45, "Unit": "SQFT", "Unit Cost": 8.50, "Cost Type": "Material",
      "Total Cost": 382.50, "Internal Notes": "Order 10% waste",
      "Markup": 10, "Markup Type": "$/Unit", "Line Item Type": "Estimate", "Tax": "Non-Taxable"
    }),
    make({
      "Title": "Recessed Lighting Kit",
      "Description": "4-inch LED recessed kit, dimmable",
      "Parent Group": "", "Parent Group Description": "",
      "Subgroup": "", "Subgroup Description": "",
      "Cost Code": "Buildertrend Flat Rate",
      "Quantity": 6, "Unit": "", "Unit Cost": "", "Cost Type": "Material",
      "Total Cost": "", "Internal Notes": "Confirm dimmer compatibility",
      "Markup": 25, "Markup Type": "$", "Line Item Type": "Estimate", "Tax": "Taxable"
    }),
    make({
      "Title": "Interior Door - Painted",
      "Description": "Painted interior door, 6-panel",
      "Parent Group": "Doors & Trim", "Parent Group Description": "Doors and trim",
      "Subgroup": "Interior Doors", "Subgroup Description": "Interior passage doors",
      "Cost Code": "DR-002",
      "Quantity": 4, "Unit": "EA", "Unit Cost": 325, "Cost Type": "Material",
      "Total Cost": 1300, "Internal Notes": "",
      "Markup": 20, "Markup Type": "%", "Line Item Type": "Allowance", "Tax": "Taxable"
    }),
    make({
      "Title": "Paint - Ceiling White",
      "Description": "Flat ceiling white, premium",
      "Parent Group": "Paint", "Parent Group Description": "Paint and finishes",
      "Subgroup": "Ceiling", "Subgroup Description": "Ceiling paint",
      "Cost Code": "",
      "Quantity": 10, "Unit": "GAL", "Unit Cost": 45, "Cost Type": "Material",
      "Total Cost": 450, "Internal Notes": "",
      "Markup": 30, "Markup Type": "C/P", "Line Item Type": "Estimate", "Tax": "Non-Taxable"
    }),
    make({
      "Title": "Hardwood Flooring - Oak",
      "Description": "Solid oak hardwood, 3.25in",
      "Parent Group": "Flooring", "Parent Group Description": "Flooring materials",
      "Subgroup": "Hardwood", "Subgroup Description": "Hardwood flooring",
      "Cost Code": "Buildertrend Flat Rate",
      "Quantity": "", "Unit": "SQFT", "Unit Cost": 12, "Cost Type": "Material",
      "Total Cost": "", "Internal Notes": "Allowance per SQFT",
      "Markup": 15, "Markup Type": "$/Unit", "Line Item Type": "Allowance", "Tax": "Taxable"
    })
  ];
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });

    // 1. Build the sample XLSX in memory
    const sampleRows = buildSampleRows();
    const ws = XLSX.utils.json_to_sheet(sampleRows, { header: EXPECTED_COLUMNS });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sample");

    const xlsxArray = XLSX.write(wb, { type: "array", bookType: "xlsx" });

    // 2. Parse it (same logic as buildertrendImport preview)
    const workbook = XLSX.read(xlsxArray, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    // Normalize column headers
    const rawHeaders = Object.keys(rawRows[0] || {});
    const headerMap = {};
    const unmatchedHeaders = [];
    for (const header of rawHeaders) {
      const normalized = header.toLowerCase().trim();
      const mapped = COLUMN_ALIASES[normalized] || (EXPECTED_COLUMNS.includes(header) ? header : null);
      if (mapped) headerMap[header] = mapped;
      else unmatchedHeaders.push(header);
    }
    const mappedColumns = new Set(Object.values(headerMap));
    const missingColumns = EXPECTED_COLUMNS.filter(c => !mappedColumns.has(c));
    const hasSkuColumn = mappedColumns.has("SKU");
    const hasSupplierColumn = mappedColumns.has("Supplier");

    // Build normalized rows (preserving blanks)
    const normalizedRows = rawRows.map((rawRow, idx) => {
      const row = {};
      for (const [rawHeader, mappedCol] of Object.entries(headerMap)) {
        row[mappedCol] = rawRow[rawHeader];
      }
      return { _rowIndex: idx + 2, ...row };
    }).filter(r => String(r.Title || "").trim() || String(r["Unit Cost"] || "").trim());

    // 3. Fetch existing catalogue items for duplicate detection
    const existingItems = await base44.asServiceRole.entities.CatalogueItem.list("-updated_date", 2000);
    const dupIndex = buildDuplicateIndex(existingItems);

    // Detect duplicates
    const rowsWithMatches = normalizedRows.map(row => {
      const matches = detectDuplicates(row, dupIndex, hasSkuColumn, hasSupplierColumn);
      const rowWarnings = [];
      if (!String(row.Title || "").trim()) rowWarnings.push("Missing Title");
      if (!String(row["Unit"] || "").trim()) rowWarnings.push("Missing Unit");
      if (String(row["Unit Cost"] || "").trim() === "") rowWarnings.push("Missing Unit Cost");
      if (!String(row["Line Item Type"] || "").trim()) rowWarnings.push("Missing Line Item Type");
      if (!String(row["Tax"] || "").trim()) rowWarnings.push("Missing Tax Status");
      if (!String(row["Parent Group"] || "").trim()) rowWarnings.push("Missing Parent Group");
      if (!String(row["Subgroup"] || "").trim()) rowWarnings.push("Missing Subgroup");
      if (!String(row["Cost Code"] || "").trim()) rowWarnings.push("Missing Cost Code");
      if (PLACEHOLDER_COST_CODES.includes(norm(row["Cost Code"]))) rowWarnings.push("Cost Code is placeholder");
      return { ...row, _duplicate_matches: matches, _is_duplicate: matches.length > 0, _warnings: rowWarnings };
    });

    // 4. Validate against expectations
    const checks = [];
    let passed = 0;
    let failed = 0;
    function check(name, condition, detail) {
      if (condition) { passed++; checks.push({ name, status: "pass" }); }
      else { failed++; checks.push({ name, status: "fail", detail: detail || "condition was false" }); }
    }

    check("Sheet name is 'Sample'", sheetName === "Sample", `Got: ${sheetName}`);
    check("Parsed all 7 data rows", normalizedRows.length === EXPECTED_ROW_COUNT, `Got: ${normalizedRows.length}`);
    check("Mapped all 17 columns", mappedColumns.size === EXPECTED_COLUMN_COUNT, `Got: ${mappedColumns.size}: ${JSON.stringify([...mappedColumns])}`);
    check("No missing required columns", missingColumns.length === 0, `Missing: ${JSON.stringify(missingColumns)}`);
    check("No unmatched headers", unmatchedHeaders.length === 0, `Unmatched: ${JSON.stringify(unmatchedHeaders)}`);
    check("No SKU column (sample has none)", hasSkuColumn === false, `Got: ${hasSkuColumn}`);
    check("No Supplier column (sample has none)", hasSupplierColumn === false, `Got: ${hasSupplierColumn}`);

    const rows = rowsWithMatches;
    const row4 = rows.find(r => r.Title === "Recessed Lighting Kit");
    check("Row with blank unit cost preserved (not crashed)", !!row4, "Row not found");
    if (row4) {
      check("Blank unit cost row flagged 'Missing Unit Cost'", row4._warnings.includes("Missing Unit Cost"), `Warnings: ${JSON.stringify(row4._warnings)}`);
      check("Blank unit row flagged 'Missing Unit'", row4._warnings.includes("Missing Unit"), `Warnings: ${JSON.stringify(row4._warnings)}`);
      check("Blank parent group row flagged 'Missing Parent Group'", row4._warnings.includes("Missing Parent Group"), `Warnings: ${JSON.stringify(row4._warnings)}`);
      check("Placeholder cost code flagged", row4._warnings.includes("Cost Code is placeholder"), `Warnings: ${JSON.stringify(row4._warnings)}`);
    }

    const row2 = rows.find(r => r.Title === "Bathroom Vanity 60in");
    check("Blank quantity preserved as empty string", !!row2 && row2.Quantity === "", `Quantity: '${row2?.Quantity}'`);

    const row6 = rows.find(r => r.Title === "Paint - Ceiling White");
    check("Blank cost code preserved as empty string", !!row6 && row6["Cost Code"] === "", `Cost Code: '${row6?.["Cost Code"]}'`);

    const row3 = rows.find(r => r.Title === "Porcelain Tile 12x24");
    check("Blank subgroup preserved as empty string", !!row3 && row3.Subgroup === "", `Subgroup: '${row3?.Subgroup}'`);

    const flatRateRows = rows.filter(r => String(r["Cost Code"] || "").trim() === "Buildertrend Flat Rate");
    check("3 rows have 'Buildertrend Flat Rate' cost code", flatRateRows.length === 3, `Got: ${flatRateRows.length}`);
    check("No false duplicates from 'Buildertrend Flat Rate' cost code", flatRateRows.every(r => !r._is_duplicate), `Flags: ${JSON.stringify(flatRateRows.map(r => ({ t: r.Title, dup: r._is_duplicate })))}`);

    const markupTypes = [...new Set(rows.map(r => r["Markup Type"]).filter(Boolean))];
    check("Markup types include %, C/P, $/Unit, $",
      ["%", "C/P", "$/Unit", "$"].every(t => markupTypes.includes(t)), `Got: ${JSON.stringify(markupTypes)}`);

    const lineItemTypes = [...new Set(rows.map(r => r["Line Item Type"]).filter(Boolean))];
    check("Line item types include Estimate and Allowance",
      ["Estimate", "Allowance"].every(t => lineItemTypes.includes(t)), `Got: ${JSON.stringify(lineItemTypes)}`);

    const taxValues = [...new Set(rows.map(r => r.Tax).filter(Boolean))];
    check("Tax statuses include Taxable and Non-Taxable",
      ["Taxable", "Non-Taxable"].every(t => taxValues.includes(t)), `Got: ${JSON.stringify(taxValues)}`);

    check("Cost Code not treated as SKU (no SKU field on rows)", rows.every(r => r.SKU === undefined), `Rows with SKU: ${rows.filter(r => r.SKU !== undefined).length}`);

    return Response.json({
      ok: true,
      summary: { passed, failed, total: passed + failed, allPassed: failed === 0 },
      checks,
      preview: {
        sheetName,
        totalRows: normalizedRows.length,
        duplicateCount: rows.filter(r => r._is_duplicate).length,
        columnsMapped: mappedColumns.size,
        hasSkuColumn,
        hasSupplierColumn
      }
    });
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});