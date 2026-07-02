import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Upload, CheckCircle, XCircle, Info, FileSpreadsheet } from "lucide-react";

const IMPORT_MODES = [
  { value: "create_and_update", label: "Create and update" },
  { value: "create_only", label: "Create only (skip existing)" },
  { value: "update_existing", label: "Update existing only" },
  { value: "dry_run", label: "Dry run only (no writes)" }
];

export default function FrontierCatalogueImportDialog({ open, onOpenChange, onDone }) {
  const [step, setStep] = useState("upload");
  const [fileUrl, setFileUrl] = useState(null);
  const [importMode, setImportMode] = useState("create_and_update");
  const [uploading, setUploading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  async function handleUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFileUrl(file_url);
    } catch (e) {
      setError("Failed to upload file");
    } finally {
      setUploading(false);
    }
  }

  async function handlePreview() {
    if (parsing || !fileUrl) return;
    setParsing(true);
    setError("");
    try {
      const res = await base44.functions.invoke("frontierCatalogueImport", {
        action: "preview", file_url: fileUrl, import_mode: importMode
      });
      setPreview(res.data);
      setStep("preview");
    } catch (e) {
      setError(e.response?.data?.error || "Failed to parse workbook");
    } finally {
      setParsing(false);
    }
  }

  async function handleConfirm() {
    if (confirming) return;
    setConfirming(true);
    setError("");
    try {
      const res = await base44.functions.invoke("frontierCatalogueImport", {
        action: "confirm", file_url: fileUrl, import_mode: importMode,
        preview_data: preview.preview
      });
      setResult(res.data);
      setStep("result");
    } catch (e) {
      setError(e.response?.data?.error || "Import failed");
    } finally {
      setConfirming(false);
    }
  }

  function reset() {
    setStep("upload"); setFileUrl(null); setPreview(null); setResult(null); setError("");
  }

  const p = preview?.preview;
  const hasIssues = p && (
    p.duplicateImportKeys.length > 0 || p.duplicateOptionGroupKeys.length > 0 || p.duplicateOptionValueKeys.length > 0 ||
    p.missingCatalogueItemRefs.length > 0 || p.missingOptionGroupRefs.length > 0 ||
    p.invalidCategories.length > 0 || p.invalidStatuses.length > 0
  );
  const hasMissingKeys = p && (p.missingItemKeys.length > 0 || p.missingGroupKeys.length > 0 || p.missingValueKeys.length > 0);

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setTimeout(reset, 200); }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet size={18} />
            Import Frontier Catalogue Workbook
          </DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800">
                <strong>This is not a Buildertrend estimate import.</strong> This imports the Frontier selections catalogue structure (CatalogueItems, OptionGroups, OptionValues, RequirementTemplates) from a normalized workbook.
              </p>
            </div>

            {error && <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg">{error}</div>}

            <div>
              <Label>Import Mode</Label>
              <Select value={importMode} onValueChange={setImportMode}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{IMPORT_MODES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <div>
              <Label>Upload .xlsx Workbook</Label>
              <div className="mt-2 border-2 border-dashed border-gray-200 rounded-lg p-8 text-center">
                {fileUrl ? (
                  <div className="text-green-600"><CheckCircle size={32} className="mx-auto mb-2" /><p className="text-sm">File uploaded. Click "Parse & Preview" to continue.</p></div>
                ) : (
                  <label className="cursor-pointer">
                    <input type="file" accept=".xlsx,.xls" onChange={handleUpload} className="hidden" />
                    <div className="text-gray-400"><Upload size={32} className="mx-auto mb-2" />{uploading ? "Uploading..." : "Click to upload .xlsx workbook"}</div>
                  </label>
                )}
              </div>
            </div>

            <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-700 flex items-start gap-2">
              <Info size={14} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-medium mb-1">Expected sheets:</p>
                <ul className="space-y-0.5 list-disc list-inside">
                  <li><strong>CatalogueItems</strong> — imported using import_key as matching key</li>
                  <li><strong>OptionGroups</strong> — linked to items via catalogue_item_key</li>
                  <li><strong>OptionValues</strong> — linked to groups via option_group_key</li>
                  <li><strong>RequirementTemplates</strong> — previewed but not imported yet</li>
                  <li><strong>RawOCR</strong> — ignored (audit/review only)</li>
                  <li><strong>README</strong> — ignored</li>
                </ul>
              </div>
            </div>

            <Button onClick={handlePreview} disabled={!fileUrl || parsing} className="w-full">
              {parsing ? "Parsing..." : "Parse & Preview"}
            </Button>
          </div>
        )}

        {step === "preview" && preview && p && (
          <div className="space-y-4">
            {error && <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg">{error}</div>}

            {/* Sheets found */}
            <div className="flex flex-wrap gap-2 text-xs">
              {Object.entries(preview.sheetsFound).map(([sheet, found]) => (
                <span key={sheet} className={`px-2 py-1 rounded-full ${found ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"}`}>
                  {found ? <CheckCircle size={10} className="inline mr-1" /> : <XCircle size={10} className="inline mr-1" />}
                  {sheet}
                </span>
              ))}
            </div>

            {/* Counts */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-gray-900">{p.counts.catalogueItems}</p>
                <p className="text-xs text-gray-500">Catalogue Items</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-gray-900">{p.counts.optionGroups}</p>
                <p className="text-xs text-gray-500">Option Groups</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-gray-900">{p.counts.optionValues}</p>
                <p className="text-xs text-gray-500">Option Values</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-gray-900">{p.counts.requirementTemplates}</p>
                <p className="text-xs text-gray-500">Req. Templates</p>
              </div>
            </div>

            {/* Match summary */}
            <div className="flex gap-4 text-sm">
              <span className="text-green-600">{p.newItems} new items</span>
              <span className="text-blue-600">{p.existingMatches} existing matches</span>
            </div>

            {/* Issues */}
            {hasIssues ? (
              <div className="space-y-2">
                {p.duplicateImportKeys.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-sm font-medium text-red-700 mb-1">Duplicate import keys ({p.duplicateImportKeys.length})</p>
                    <div className="text-xs text-red-600 space-y-0.5 max-h-24 overflow-y-auto">
                      {p.duplicateImportKeys.map((d, i) => <div key={i}>Row {d.row}: "{d.import_key}" (first seen at row {d.first_row})</div>)}
                    </div>
                  </div>
                )}
                {p.duplicateOptionGroupKeys.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-sm font-medium text-red-700 mb-1">Duplicate option_group_keys ({p.duplicateOptionGroupKeys.length})</p>
                    <div className="text-xs text-red-600 space-y-0.5 max-h-24 overflow-y-auto">
                      {p.duplicateOptionGroupKeys.map((d, i) => <div key={i}>Row {d.row}: "{d.key}" (first seen at row {d.first_row})</div>)}
                    </div>
                  </div>
                )}
                {p.duplicateOptionValueKeys.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-sm font-medium text-red-700 mb-1">Duplicate option_value_keys ({p.duplicateOptionValueKeys.length})</p>
                    <div className="text-xs text-red-600 space-y-0.5 max-h-24 overflow-y-auto">
                      {p.duplicateOptionValueKeys.map((d, i) => <div key={i}>Row {d.row}: "{d.key}" (first seen at row {d.first_row})</div>)}
                    </div>
                  </div>
                )}
                {p.missingCatalogueItemRefs.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <p className="text-sm font-medium text-amber-700 mb-1">Missing catalogue_item_key references ({p.missingCatalogueItemRefs.length})</p>
                    <div className="text-xs text-amber-600 space-y-0.5 max-h-24 overflow-y-auto">
                      {p.missingCatalogueItemRefs.map((m, i) => <div key={i}>Row {m.row}: group "{m.group}" references "{m.key}"</div>)}
                    </div>
                  </div>
                )}
                {p.missingOptionGroupRefs.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <p className="text-sm font-medium text-amber-700 mb-1">Missing option_group_key references ({p.missingOptionGroupRefs.length})</p>
                    <div className="text-xs text-amber-600 space-y-0.5 max-h-24 overflow-y-auto">
                      {p.missingOptionGroupRefs.map((m, i) => <div key={i}>Row {m.row}: value "{m.value}" references "{m.key}"</div>)}
                    </div>
                  </div>
                )}
                {p.invalidCategories.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <p className="text-sm font-medium text-amber-700 mb-1">Invalid categories ({p.invalidCategories.length})</p>
                    <div className="text-xs text-amber-600 space-y-0.5 max-h-24 overflow-y-auto">
                      {p.invalidCategories.map((c, i) => (
                        <div key={i}>Row {c.row}: "{c.value}" on "{c.name}" — {c.suggestion ? `will map to "${c.willMapTo}"` : 'will default to "Other"'}</div>
                      ))}
                    </div>
                  </div>
                )}
                {p.invalidStatuses.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <p className="text-sm font-medium text-amber-700 mb-1">Invalid statuses ({p.invalidStatuses.length})</p>
                    <div className="text-xs text-amber-600 space-y-0.5 max-h-24 overflow-y-auto">
                      {p.invalidStatuses.map((s, i) => <div key={i}>Row {s.row}: "{s.value}" on "{s.name}" — will default to "Active"</div>)}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
                <CheckCircle size={16} className="text-green-600" />
                <p className="text-sm text-green-700">No issues detected. Ready to import.</p>
              </div>
            )}

            {hasMissingKeys && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-700">
                  <p className="font-medium mb-1">Rows without stable keys detected:</p>
                  {p.missingItemKeys.length > 0 && (
                    <div className="mb-1">
                      <p className="font-medium">{p.missingItemKeys.length} CatalogueItem rows missing import_key:</p>
                      <div className="max-h-20 overflow-y-auto space-y-0.5">
                        {p.missingItemKeys.map((m, i) => <div key={i}>Row {m.row}{m.name ? `: "${m.name}"` : ""}</div>)}
                      </div>
                    </div>
                  )}
                  {p.missingGroupKeys.length > 0 && (
                    <div className="mb-1">
                      <p className="font-medium">{p.missingGroupKeys.length} OptionGroup rows missing option_group_key:</p>
                      <div className="max-h-20 overflow-y-auto space-y-0.5">
                        {p.missingGroupKeys.map((m, i) => <div key={i}>Row {m.row}{m.name ? `: "${m.name}"` : ""}</div>)}
                      </div>
                    </div>
                  )}
                  {p.missingValueKeys.length > 0 && (
                    <div className="mb-1">
                      <p className="font-medium">{p.missingValueKeys.length} OptionValue rows missing option_value_key:</p>
                      <div className="max-h-20 overflow-y-auto space-y-0.5">
                        {p.missingValueKeys.map((m, i) => <div key={i}>Row {m.row}{m.name ? `: "${m.name}"` : ""}</div>)}
                      </div>
                    </div>
                  )}
                  <p className="mt-1 italic">Rows without stable keys may duplicate on future imports.</p>
                </div>
              </div>
            )}

            {p.counts.requirementTemplates > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
                <Info size={14} className="text-blue-600 shrink-0 mt-0.5" />
                <p className="text-xs text-blue-700">RequirementTemplates detected but not imported yet. Catalogue items and options will still import.</p>
              </div>
            )}

            <div className="flex justify-between items-center">
              <Button variant="outline" onClick={() => setStep("upload")}>Back</Button>
              <div className="text-right">
                <p className="text-xs text-gray-500 mb-1">
                  Mode: {IMPORT_MODES.find(m => m.value === importMode)?.label}
                </p>
                <Button onClick={handleConfirm} disabled={confirming}>
                  {confirming ? "Importing..." : importMode === "dry_run"
                    ? `Run Dry Run for ${p.counts.catalogueItems} items, ${p.counts.optionGroups} groups, ${p.counts.optionValues} values`
                    : `Import ${p.counts.catalogueItems} items, ${p.counts.optionGroups} groups, ${p.counts.optionValues} values`}
                </Button>
              </div>
            </div>
          </div>
        )}

        {step === "result" && result && (
          <div className="space-y-4 text-center py-4">
            <CheckCircle size={48} className="mx-auto text-green-500" />
            <div className="space-y-1">
              <p className="text-lg font-semibold">{result.isDryRun ? "Dry Run Complete" : "Import Complete"}</p>
              <div className="text-sm text-gray-500 space-y-0.5">
                <p>Items: {result.results.itemsCreated} created, {result.results.itemsUpdated} updated, {result.results.itemsSkipped} skipped</p>
                <p>Groups: {result.results.groupsCreated} created, {result.results.groupsUpdated} updated, {result.results.groupsSkipped} skipped</p>
                <p>Values: {result.results.valuesCreated} created, {result.results.valuesUpdated} updated, {result.results.valuesSkipped} skipped</p>
              </div>
            </div>
            {result.results.errors.length > 0 && (
              <div className="bg-red-50 rounded-lg p-3 text-left text-xs text-red-700 max-h-32 overflow-y-auto">
                {result.results.errors.map((e, i) => <div key={i}>Row {e.row} ({e.type}): {e.error}</div>)}
              </div>
            )}
            <Button onClick={() => { onOpenChange(false); if (onDone) onDone(); setTimeout(reset, 200); }}>Done</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}