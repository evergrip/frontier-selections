import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import * as XLSX from 'npm:xlsx@0.18.5';

const VALID_CATEGORIES = ["Vanity", "Cabinet", "Countertop", "Tile", "Flooring", "Faucet", "Sink", "Toilet", "Shower System", "Tub", "Mirror", "Lighting", "Paint", "Trim", "Door", "Door Hardware", "Exterior Siding", "Roofing", "Decking", "Railing", "Appliance", "Fireplace", "Other"];
const VALID_ITEM_STATUSES = ["Draft", "Active", "Inactive", "Discontinued", "Temporarily Unavailable", "Backordered", "Special Order Only", "Substitution Recommended"];
const VALID_OPTION_STATUSES = ["Active", "Inactive", "Discontinued", "Temporarily Unavailable", "Backordered", "Special Order Only", "Substitution Recommended"];

// Suggestions for common category names not in the valid list
const CATEGORY_SUGGESTIONS = {
  "Shingles": "Roofing",
  "Steel Roofing": "Roofing",
  "Standing Seam Roofing": "Roofing",
  "Vinyl Siding": "Exterior Siding",
  "Shake Siding": "Exterior Siding",
  "Faux Stone Siding": "Exterior Siding",
  "Cabinets": "Cabinet",
  "Exterior Door": "Door",
  "Interior Door": "Door"
};

function str(v) { return String(v ?? "").trim(); }
function num(v) { const n = Number(v); return isNaN(n) ? 0 : n; }

function boolWithDefault(v, defaultValue) {
  if (v === "" || v == null) return defaultValue;
  if (typeof v === "boolean") return v;
  const s = String(v).trim().toLowerCase();
  if (["true", "1", "yes", "y"].includes(s)) return true;
  if (["false", "0", "no", "n"].includes(s)) return false;
  return defaultValue;
}

// Returns true if the cell had an explicit (non-blank) value
function isProvided(v) {
  return v !== "" && v != null;
}

function arr(v) {
  if (Array.isArray(v)) return v;
  const s = str(v);
  if (!s) return [];
  return s.split(/[;,]/).map(x => x.trim()).filter(Boolean);
}

// Normalize sheet name for matching (case-insensitive, strip spaces/underscores)
function normSheet(s) { return str(s).toLowerCase().replace(/[\s_\-]/g, ""); }

function findSheet(workbook, ...candidates) {
  const norms = candidates.map(normSheet);
  for (const name of workbook.SheetNames) {
    if (norms.includes(normSheet(name))) return name;
  }
  return null;
}

function readSheetRows(workbook, sheetName) {
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json(sheet, { defval: "" });
}

// Get a field value from a row, trying multiple possible column names
function getField(row, ...keys) {
  const normKeys = keys.map(k => k.toLowerCase().trim());
  for (const [col, val] of Object.entries(row)) {
    if (normKeys.includes(col.toLowerCase().trim())) return val;
  }
  return "";
}

function resolveCategory(raw) {
  if (!raw) return { category: "Other", suggestion: null, wasInvalid: false };
  if (VALID_CATEGORIES.includes(raw)) return { category: raw, suggestion: null, wasInvalid: false };
  if (CATEGORY_SUGGESTIONS[raw]) return { category: CATEGORY_SUGGESTIONS[raw], suggestion: CATEGORY_SUGGESTIONS[raw], wasInvalid: true };
  return { category: "Other", suggestion: null, wasInvalid: true };
}

function parseCatalogueItems(rows) {
  return rows.map((row, i) => {
    const isActiveRaw = getField(row, "is_active", "active");
    return {
      _rowIndex: i + 2,
      import_key: str(getField(row, "import_key", "importkey", "key")),
      name: str(getField(row, "name", "title", "item_name")),
      category: str(getField(row, "category")),
      supplier: str(getField(row, "supplier", "vendor")),
      brand: str(getField(row, "brand")),
      collection: str(getField(row, "collection")),
      sku: str(getField(row, "sku")),
      model_number: str(getField(row, "model_number", "modelnumber", "model")),
      description: str(getField(row, "description", "desc")),
      customer_description: str(getField(row, "customer_description", "customerdescription")),
      base_price: num(getField(row, "base_price", "price", "unit_cost", "cost")),
      default_quantity: num(getField(row, "default_quantity", "quantity", "qty")) || 1,
      unit_of_measure: str(getField(row, "unit_of_measure", "unit", "uom")),
      status: str(getField(row, "status")) || "Active",
      is_active: boolWithDefault(isActiveRaw, true),
      tax_status: str(getField(row, "tax_status", "tax")) || "Taxable",
      cost_type: str(getField(row, "cost_type", "costtype")),
      parent_group: str(getField(row, "parent_group", "parentgroup")),
      subgroup: str(getField(row, "subgroup", "sub_group")),
      line_item_type: str(getField(row, "line_item_type", "lineitemtype")),
      tags: arr(getField(row, "tags", "tag")),
      source_pdf_page: num(getField(row, "source_pdf_page", "pdf_page", "page")),
      review_status: str(getField(row, "review_status", "reviewstatus")),
      review_notes: str(getField(row, "review_notes", "reviewnotes")),
      _boolProvided: { is_active: isProvided(isActiveRaw) }
    };
  }).filter(r => r.name || r.import_key);
}

function parseOptionGroups(rows) {
  return rows.map((row, i) => {
    const isRequiredRaw = getField(row, "is_required", "required");
    const customerVisibleRaw = getField(row, "customer_visible", "visible");
    const staffOnlyRaw = getField(row, "staff_only", "staffonly");
    const affectsPriceRaw = getField(row, "affects_price", "affectsprice");
    const affectsBtRaw = getField(row, "affects_buildertrend_export", "affectsbt");
    return {
      _rowIndex: i + 2,
      option_group_key: str(getField(row, "option_group_key", "optiongroupkey", "group_key")),
      catalogue_item_key: str(getField(row, "catalogue_item_key", "catalogueitemkey", "item_key")),
      name: str(getField(row, "name", "group_name")),
      description: str(getField(row, "description", "desc")),
      display_order: num(getField(row, "display_order", "order")) || 0,
      is_required: boolWithDefault(isRequiredRaw, true),
      min_selections: num(getField(row, "min_selections", "minselections")) || 0,
      max_selections: num(getField(row, "max_selections", "maxselections")) || 1,
      customer_visible: boolWithDefault(customerVisibleRaw, true),
      staff_only: boolWithDefault(staffOnlyRaw, false),
      affects_price: boolWithDefault(affectsPriceRaw, true),
      affects_buildertrend_export: boolWithDefault(affectsBtRaw, false),
      _boolProvided: {
        is_required: isProvided(isRequiredRaw),
        customer_visible: isProvided(customerVisibleRaw),
        staff_only: isProvided(staffOnlyRaw),
        affects_price: isProvided(affectsPriceRaw),
        affects_buildertrend_export: isProvided(affectsBtRaw)
      }
    };
  }).filter(r => r.name || r.option_group_key);
}

function parseOptionValues(rows) {
  return rows.map((row, i) => {
    const requiresApprovalRaw = getField(row, "requires_approval", "approval");
    return {
      _rowIndex: i + 2,
      option_value_key: str(getField(row, "option_value_key", "optionvaluekey", "value_key")),
      option_group_key: str(getField(row, "option_group_key", "optiongroupkey", "group_key")),
      catalogue_item_key: str(getField(row, "catalogue_item_key", "catalogueitemkey", "item_key")),
      name: str(getField(row, "name", "value_name", "option_name")),
      description: str(getField(row, "description", "desc")),
      price_modifier: num(getField(row, "price_modifier", "pricemodifier")),
      quantity_modifier: num(getField(row, "quantity_modifier", "quantitymodifier")),
      requires_approval: boolWithDefault(requiresApprovalRaw, false),
      display_order: num(getField(row, "display_order", "order")) || 0,
      status: str(getField(row, "status")) || "Active",
      customer_note: str(getField(row, "customer_note", "customernote")),
      internal_note: str(getField(row, "internal_note", "internalnote")),
      tier: str(getField(row, "tier")),
      _boolProvided: { requires_approval: isProvided(requiresApprovalRaw) }
    };
  }).filter(r => r.name || r.option_value_key);
}

function parseRequirementTemplates(rows) {
  return rows.map((row, i) => ({
    _rowIndex: i + 2,
    name: str(getField(row, "name", "requirement_name")),
    category: str(getField(row, "category")),
    area_type: str(getField(row, "area_type", "areatype")),
    is_required: boolWithDefault(getField(row, "is_required", "required"), true),
    default_allowance: num(getField(row, "default_allowance", "allowance")),
    customer_instructions: str(getField(row, "customer_instructions", "instructions"))
  })).filter(r => r.name);
}

// Detect duplicate keys within the file
function detectDuplicateKeys(records, keyField) {
  const seen = {};
  const duplicates = [];
  for (const rec of records) {
    const key = rec[keyField];
    if (!key) continue;
    if (seen[key]) {
      duplicates.push({ key, row: rec._rowIndex, first_row: seen[key] });
    } else {
      seen[key] = rec._rowIndex;
    }
  }
  return duplicates;
}

// Collect rows missing stable keys
function detectMissingKeys(records, keyField, label) {
  const missing = [];
  for (const rec of records) {
    if (!rec[keyField]) {
      missing.push({ row: rec._rowIndex, name: rec.name || "" });
    }
  }
  return missing;
}

function buildPreview(items, groups, values, reqTemplates, existingItems) {
  // Build import_key -> item ID map from existing items
  const existingByKey = {};
  for (const ei of existingItems) {
    if (ei.import_key) existingByKey[ei.import_key] = ei;
  }

  // Duplicate key detection within file
  const duplicateImportKeys = detectDuplicateKeys(items, "import_key");
  const duplicateOptionGroupKeys = detectDuplicateKeys(groups, "option_group_key");
  const duplicateOptionValueKeys = detectDuplicateKeys(values, "option_value_key");

  // Missing stable keys
  const missingItemKeys = detectMissingKeys(items, "import_key", "import_key");
  const missingGroupKeys = detectMissingKeys(groups, "option_group_key", "option_group_key");
  const missingValueKeys = detectMissingKeys(values, "option_value_key", "option_value_key");

  // Validate items
  const invalidCategories = [];
  const invalidStatuses = [];
  for (const item of items) {
    if (item.category && !VALID_CATEGORIES.includes(item.category)) {
      const resolved = resolveCategory(item.category);
      invalidCategories.push({
        row: item._rowIndex, value: item.category, name: item.name,
        suggestion: resolved.suggestion, willMapTo: resolved.category
      });
    }
    if (item.status && !VALID_ITEM_STATUSES.includes(item.status)) {
      invalidStatuses.push({ row: item._rowIndex, value: item.status, name: item.name });
    }
    item._exists = !!existingByKey[item.import_key];
  }

  // Validate option groups — check catalogue_item_key references
  const itemKeysInFile = new Set(items.filter(i => i.import_key).map(i => i.import_key));
  const missingItemRefs = [];
  for (const grp of groups) {
    if (grp.catalogue_item_key && !itemKeysInFile.has(grp.catalogue_item_key) && !existingByKey[grp.catalogue_item_key]) {
      missingItemRefs.push({ row: grp._rowIndex, key: grp.catalogue_item_key, group: grp.name });
    }
  }

  // Validate option values — check option_group_key references
  const groupKeysInFile = new Set(groups.filter(g => g.option_group_key).map(g => g.option_group_key));
  const missingGroupRefs = [];
  for (const val of values) {
    if (val.option_group_key && !groupKeysInFile.has(val.option_group_key)) {
      missingGroupRefs.push({ row: val._rowIndex, key: val.option_group_key, value: val.name });
    }
    if (val.status && !VALID_OPTION_STATUSES.includes(val.status)) {
      invalidStatuses.push({ row: val._rowIndex, value: val.status, name: val.name });
    }
  }

  return {
    counts: {
      catalogueItems: items.length,
      optionGroups: groups.length,
      optionValues: values.length,
      requirementTemplates: reqTemplates.length
    },
    duplicateImportKeys,
    duplicateOptionGroupKeys,
    duplicateOptionValueKeys,
    missingItemKeys,
    missingGroupKeys,
    missingValueKeys,
    missingCatalogueItemRefs: missingItemRefs,
    missingOptionGroupRefs: missingGroupRefs,
    invalidCategories,
    invalidStatuses,
    existingMatches: items.filter(i => i._exists).length,
    newItems: items.filter(i => !i._exists).length,
    items: items.map(i => ({ import_key: i.import_key, name: i.name, category: i.category, status: i.status, _exists: i._exists, _rowIndex: i._rowIndex })),
    groups: groups.map(g => ({ option_group_key: g.option_group_key, catalogue_item_key: g.catalogue_item_key, name: g.name, _rowIndex: g._rowIndex })),
    values: values.map(v => ({ option_value_key: v.option_value_key, option_group_key: v.option_group_key, name: v.name, tier: v.tier, _rowIndex: v._rowIndex })),
    requirementTemplates: reqTemplates
  };
}

// Build update payload for booleans — only include fields that were explicitly provided
function conditionalBools(rec, fields) {
  const result = {};
  for (const [field] of fields) {
    if (rec._boolProvided?.[field]) {
      result[field] = rec[field];
    }
  }
  return result;
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function processInBatches(records, batchSize, delayMs, handler) {
  const results = [];
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    for (const record of batch) {
      results.push(await handler(record));
    }
    if (i + batchSize < records.length) {
      await sleep(delayMs);
    }
  }
  return results;
}

function isRateLimitError(e) {
  const msg = (e.message || "").toLowerCase();
  return msg.includes("rate limit") || msg.includes("429") || msg.includes("too many requests");
}

async function withRateLimitRetry(fn, results) {
  for (let attempt = 0; attempt <= 3; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (isRateLimitError(e)) {
        results.rateLimitRetries++;
        if (attempt < 3) {
          await sleep(2000);
          continue;
        }
        throw e;
      }
      throw e;
    }
  }
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
    const { action = "preview", file_url, import_mode = "create_and_update", preview_data } = body;

    // ===== PREVIEW =====
    if (action === "preview") {
      if (!file_url) return Response.json({ error: "file_url is required" }, { status: 400 });

      const fileResponse = await fetch(file_url);
      if (!fileResponse.ok) return Response.json({ error: "Failed to fetch file" }, { status: 400 });
      const arrayBuffer = await fileResponse.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: "array" });

      // Find sheets by normalized name
      const itemsSheet = findSheet(workbook, "CatalogueItems", "Catalogue Items", "Items");
      const groupsSheet = findSheet(workbook, "OptionGroups", "Option Groups", "Groups");
      const valuesSheet = findSheet(workbook, "OptionValues", "Option Values", "Values");
      const reqTemplateSheet = findSheet(workbook, "RequirementTemplates", "Requirement Templates", "Templates");
      const rawOcrSheet = findSheet(workbook, "RawOCR", "Raw OCR");
      const readmeSheet = findSheet(workbook, "README", "Read Me");

      if (!itemsSheet) {
        return Response.json({ error: "No 'CatalogueItems' sheet found in workbook. This importer expects normalized Frontier catalogue sheets, not a Buildertrend estimate." }, { status: 400 });
      }

      const items = parseCatalogueItems(readSheetRows(workbook, itemsSheet));
      const groups = parseOptionGroups(readSheetRows(workbook, groupsSheet));
      const values = parseOptionValues(readSheetRows(workbook, valuesSheet));
      const reqTemplates = parseRequirementTemplates(readSheetRows(workbook, reqTemplateSheet));

      // Fetch existing items for import_key matching
      const existingItems = await base44.asServiceRole.entities.CatalogueItem.list("-updated_date", 2000);

      const preview = buildPreview(items, groups, values, reqTemplates, existingItems);

      return Response.json({
        ok: true,
        sheetsFound: {
          catalogueItems: !!itemsSheet,
          optionGroups: !!groupsSheet,
          optionValues: !!valuesSheet,
          requirementTemplates: !!reqTemplateSheet,
          rawOCR: !!rawOcrSheet,
          readme: !!readmeSheet
        },
        import_mode,
        preview
      });
    }

    // ===== CONFIRM =====
    if (action === "confirm") {
      if (!preview_data) return Response.json({ error: "preview_data is required" }, { status: 400 });

      const isDryRun = import_mode === "dry_run";
      const doCreate = import_mode === "create_only" || import_mode === "create_and_update";
      const doUpdate = import_mode === "update_existing" || import_mode === "create_and_update";
      const import_scope = body.import_scope || "all";
      const doItems = import_scope === "all" || import_scope === "items_only";
      const doGroups = import_scope === "all" || import_scope === "groups_only";
      const doValues = import_scope === "all" || import_scope === "values_only";

      // Re-fetch file and parse to get full row data
      if (!file_url) return Response.json({ error: "file_url is required for confirm" }, { status: 400 });
      const fileResponse = await fetch(file_url);
      if (!fileResponse.ok) return Response.json({ error: "Failed to fetch file" }, { status: 400 });
      const arrayBuffer = await fileResponse.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: "array" });

      const itemsSheet = findSheet(workbook, "CatalogueItems", "Catalogue Items", "Items");
      const groupsSheet = findSheet(workbook, "OptionGroups", "Option Groups", "Groups");
      const valuesSheet = findSheet(workbook, "OptionValues", "Option Values", "Values");

      const items = parseCatalogueItems(readSheetRows(workbook, itemsSheet));
      const groups = parseOptionGroups(readSheetRows(workbook, groupsSheet));
      const values = parseOptionValues(readSheetRows(workbook, valuesSheet));

      // Fetch existing records for matching (resume-safe)
      const existingItems = await base44.asServiceRole.entities.CatalogueItem.list("-updated_date", 2000);
      const existingByKey = {};
      for (const ei of existingItems) {
        if (ei.import_key) existingByKey[ei.import_key] = ei;
      }

      const existingGroups = await base44.asServiceRole.entities.CatalogueOptionGroup.list("-created_date", 3000);
      const existingGroupByKey = {};
      for (const eg of existingGroups) {
        if (eg.option_group_key) existingGroupByKey[eg.option_group_key] = eg;
      }

      const existingValues = await base44.asServiceRole.entities.CatalogueOptionValue.list("-created_date", 5000);
      const existingValueByKey = {};
      for (const ev of existingValues) {
        if (ev.option_value_key) existingValueByKey[ev.option_value_key] = ev;
      }

      const results = {
        itemsCreated: 0, itemsUpdated: 0, itemsSkipped: 0,
        groupsCreated: 0, groupsUpdated: 0, groupsSkipped: 0,
        valuesCreated: 0, valuesUpdated: 0, valuesSkipped: 0,
        errors: [],
        rateLimitRetries: 0,
        completedPhase: null
      };

      const itemKeyToId = {};
      let rateLimitStopped = false;

      // Phase 1: Catalogue Items
      if (doItems && !rateLimitStopped) {
        try {
          await processInBatches(items, 10, 500, async (item) => {
            try {
              if (!item.name) { results.errors.push({ row: item._rowIndex, error: "Missing name", type: "item" }); return; }
              const { category } = resolveCategory(item.category);
              const status = item.status && VALID_ITEM_STATUSES.includes(item.status) ? item.status : "Active";
              const taxStatus = item.tax_status || "Taxable";
              const existing = item.import_key ? existingByKey[item.import_key] : null;

              if (existing) {
                if (doUpdate) {
                  if (!isDryRun) {
                    const updatePayload = {
                      name: item.name, category, supplier: item.supplier, brand: item.brand,
                      collection: item.collection, sku: item.sku, model_number: item.model_number,
                      description: item.description, customer_description: item.customer_description || item.description,
                      base_price: item.base_price, default_quantity: item.default_quantity,
                      unit_of_measure: item.unit_of_measure, status,
                      tax_status: taxStatus, taxable: taxStatus === "Taxable",
                      cost_type: item.cost_type, parent_group: item.parent_group,
                      subgroup: item.subgroup, line_item_type: item.line_item_type,
                      tags: item.tags, source_pdf_page: item.source_pdf_page || null,
                      review_status: item.review_status, review_notes: item.review_notes,
                      import_key: item.import_key
                    };
                    if (item._boolProvided.is_active) updatePayload.is_active = item.is_active;
                    await withRateLimitRetry(() => base44.asServiceRole.entities.CatalogueItem.update(existing.id, updatePayload), results);
                  }
                  results.itemsUpdated++;
                  itemKeyToId[item.import_key] = existing.id;
                } else {
                  results.itemsSkipped++;
                }
              } else {
                if (doCreate) {
                  if (!isDryRun) {
                    const created = await withRateLimitRetry(() => base44.asServiceRole.entities.CatalogueItem.create({
                      name: item.name, import_key: item.import_key, category, supplier: item.supplier,
                      brand: item.brand, collection: item.collection, sku: item.sku, model_number: item.model_number,
                      description: item.description, customer_description: item.customer_description || item.description,
                      base_price: item.base_price, default_quantity: item.default_quantity,
                      unit_of_measure: item.unit_of_measure, status, is_active: item.is_active,
                      tax_status: taxStatus, taxable: taxStatus === "Taxable",
                      cost_type: item.cost_type, parent_group: item.parent_group,
                      subgroup: item.subgroup, line_item_type: item.line_item_type,
                      tags: item.tags, source_pdf_page: item.source_pdf_page || null,
                      review_status: item.review_status, review_notes: item.review_notes
                    }), results);
                    itemKeyToId[item.import_key] = created.id;
                  }
                  results.itemsCreated++;
                } else {
                  results.itemsSkipped++;
                }
              }
            } catch (e) {
              if (isRateLimitError(e)) throw e;
              results.errors.push({ row: item._rowIndex, error: e.message, type: "item", name: item.name });
            }
          });
          results.completedPhase = "items";
        } catch (e) {
          if (isRateLimitError(e)) { rateLimitStopped = true; }
          else throw e;
        }
      }

      // Phase 2: Option Groups
      if (doGroups && !rateLimitStopped) {
        try {
          await processInBatches(groups, 10, 500, async (grp) => {
            try {
              if (!grp.name) { results.errors.push({ row: grp._rowIndex, error: "Missing name", type: "group" }); return; }
              let catalogueItemId = null;
              if (grp.catalogue_item_key) {
                catalogueItemId = itemKeyToId[grp.catalogue_item_key] || (existingByKey[grp.catalogue_item_key]?.id) || null;
              }
              if (!catalogueItemId) {
                results.errors.push({ row: grp._rowIndex, error: `Cannot resolve catalogue_item_key: ${grp.catalogue_item_key}`, type: "group", name: grp.name });
                return;
              }

              const existing = grp.option_group_key ? existingGroupByKey[grp.option_group_key] : null;

              if (existing) {
                if (doUpdate) {
                  if (!isDryRun) {
                    const updatePayload = {
                      catalogue_item_id: catalogueItemId, name: grp.name, description: grp.description,
                      display_order: grp.display_order,
                      min_selections: grp.min_selections, max_selections: grp.max_selections,
                      option_group_key: grp.option_group_key
                    };
                    Object.assign(updatePayload, conditionalBools(grp, [
                      ["is_required"], ["customer_visible"], ["staff_only"], ["affects_price"], ["affects_buildertrend_export"]
                    ]));
                    await withRateLimitRetry(() => base44.asServiceRole.entities.CatalogueOptionGroup.update(existing.id, updatePayload), results);
                  }
                  results.groupsUpdated++;
                } else {
                  results.groupsSkipped++;
                }
              } else {
                if (doCreate) {
                  if (!isDryRun) {
                    const created = await withRateLimitRetry(() => base44.asServiceRole.entities.CatalogueOptionGroup.create({
                      catalogue_item_id: catalogueItemId, option_group_key: grp.option_group_key,
                      name: grp.name, description: grp.description, display_order: grp.display_order,
                      is_required: grp.is_required, min_selections: grp.min_selections,
                      max_selections: grp.max_selections, customer_visible: grp.customer_visible,
                      staff_only: grp.staff_only, affects_price: grp.affects_price,
                      affects_buildertrend_export: grp.affects_buildertrend_export
                    }), results);
                    if (grp.option_group_key) existingGroupByKey[grp.option_group_key] = { id: created.id };
                  }
                  results.groupsCreated++;
                } else {
                  results.groupsSkipped++;
                }
              }
            } catch (e) {
              if (isRateLimitError(e)) throw e;
              results.errors.push({ row: grp._rowIndex, error: e.message, type: "group", name: grp.name });
            }
          });
          results.completedPhase = "groups";
        } catch (e) {
          if (isRateLimitError(e)) { rateLimitStopped = true; }
          else throw e;
        }
      }

      // Phase 3: Option Values
      if (doValues && !rateLimitStopped) {
        try {
          await processInBatches(values, 25, 750, async (val) => {
            try {
              if (!val.name) { results.errors.push({ row: val._rowIndex, error: "Missing name", type: "value" }); return; }
              let optionGroupId = null;
              let catalogueItemId = null;
              if (val.option_group_key) {
                optionGroupId = existingGroupByKey[val.option_group_key]?.id || null;
              }
              if (val.catalogue_item_key) {
                catalogueItemId = itemKeyToId[val.catalogue_item_key] || (existingByKey[val.catalogue_item_key]?.id) || null;
              }
              if (!optionGroupId) {
                results.errors.push({ row: val._rowIndex, error: `Cannot resolve option_group_key: ${val.option_group_key}`, type: "value", name: val.name });
                return;
              }

              const status = val.status && VALID_OPTION_STATUSES.includes(val.status) ? val.status : "Active";
              const existing = val.option_value_key ? existingValueByKey[val.option_value_key] : null;

              if (existing) {
                if (doUpdate) {
                  if (!isDryRun) {
                    const updatePayload = {
                      option_group_id: optionGroupId, catalogue_item_id: catalogueItemId || existing.catalogue_item_id,
                      name: val.name, description: val.description, price_modifier: val.price_modifier,
                      quantity_modifier: val.quantity_modifier,
                      display_order: val.display_order, status, customer_note: val.customer_note,
                      internal_note: val.internal_note, tier: val.tier, option_value_key: val.option_value_key
                    };
                    if (val._boolProvided.requires_approval) updatePayload.requires_approval = val.requires_approval;
                    await withRateLimitRetry(() => base44.asServiceRole.entities.CatalogueOptionValue.update(existing.id, updatePayload), results);
                  }
                  results.valuesUpdated++;
                } else {
                  results.valuesSkipped++;
                }
              } else {
                if (doCreate) {
                  if (!isDryRun) {
                    await withRateLimitRetry(() => base44.asServiceRole.entities.CatalogueOptionValue.create({
                      option_group_id: optionGroupId, catalogue_item_id: catalogueItemId || null,
                      option_value_key: val.option_value_key, name: val.name, description: val.description,
                      price_modifier: val.price_modifier, quantity_modifier: val.quantity_modifier,
                      requires_approval: val.requires_approval, display_order: val.display_order,
                      status, customer_note: val.customer_note, internal_note: val.internal_note, tier: val.tier
                    }), results);
                  }
                  results.valuesCreated++;
                } else {
                  results.valuesSkipped++;
                }
              }
            } catch (e) {
              if (isRateLimitError(e)) throw e;
              results.errors.push({ row: val._rowIndex, error: e.message, type: "value", name: val.name });
            }
          });
          results.completedPhase = "values";
        } catch (e) {
          if (isRateLimitError(e)) { rateLimitStopped = true; }
          else throw e;
        }
      }

      // Audit log
      if (!isDryRun && !rateLimitStopped) {
        await base44.asServiceRole.entities.AuditLog.create({
          target_type: "catalogue_import", target_id: "N/A",
          action: "frontier_catalogue_import", action_type: "frontier_catalogue_import",
          description: `${user.full_name || user.email} imported Frontier catalogue workbook (${import_scope}): ${results.itemsCreated} items created, ${results.itemsUpdated} updated, ${results.groupsCreated} groups created, ${results.valuesCreated} values created`,
          actor_user_id: user.id, actor_name: user.full_name || user.email, actor_role: user.role,
          severity: "high"
        });
      }

      return Response.json({
        ok: true, import_mode, import_scope, isDryRun, results,
        rateLimitStopped,
        message: rateLimitStopped ? "Import stopped due to rate limiting. Re-run Create and update to resume safely." : null
      });
    }

    return Response.json({ error: "Unknown action. Use 'preview' or 'confirm'." }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});