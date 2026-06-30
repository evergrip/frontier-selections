import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Upload, CheckCircle, XCircle } from "lucide-react";
import { BT_IMPORT_TARGETS } from "@/lib/constants";

export default function BuildertrendImportDialog({ open, onOpenChange, projectId, onDone }) {
  const [step, setStep] = useState("upload");
  const [fileUrl, setFileUrl] = useState(null);
  const [importMode, setImportMode] = useState("new_items");
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
      const res = await base44.functions.invoke("buildertrendImport", {
        action: "preview", file_url: fileUrl, import_mode: importMode, project_id: projectId
      });
      setPreview(res.data);
      setStep("preview");
    } catch (e) {
      setError(e.response?.data?.error || "Failed to parse file");
    } finally {
      setParsing(false);
    }
  }

  function setRowAction(rowIndex, action) {
    setPreview(prev => ({
      ...prev,
      rows: prev.rows.map((r, i) => i === rowIndex ? { ...r, _action: action, _update_target_id: action === "update" ? (r._duplicate_matches[0]?.id || "") : "" } : r)
    }));
  }

  function setRowUpdateTarget(rowIndex, targetId) {
    setPreview(prev => ({
      ...prev,
      rows: prev.rows.map((r, i) => i === rowIndex ? { ...r, _update_target_id: targetId } : r)
    }));
  }

  async function handleConfirm() {
    if (confirming) return;
    setConfirming(true);
    setError("");
    try {
      const rowsToImport = preview.rows.filter(r => r._action === "create" || (r._action === "update" && r._update_target_id));
      const res = await base44.functions.invoke("buildertrendImport", {
        action: "confirm", import_mode: importMode, project_id: projectId,
        confirmed_rows: rowsToImport
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

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setTimeout(reset, 200); }}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Import Buildertrend Estimate</DialogTitle></DialogHeader>

        {step === "upload" && (
          <div className="space-y-4">
            {error && <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg">{error}</div>}
            <div>
              <Label>Import Mode</Label>
              <Select value={importMode} onValueChange={setImportMode}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{BT_IMPORT_TARGETS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Upload .xlsx File</Label>
              <div className="mt-2 border-2 border-dashed border-gray-200 rounded-lg p-8 text-center">
                {fileUrl ? (
                  <div className="text-green-600"><CheckCircle size={32} className="mx-auto mb-2" /><p className="text-sm">File uploaded. Click "Parse & Preview" to continue.</p></div>
                ) : (
                  <label className="cursor-pointer">
                    <input type="file" accept=".xlsx,.xls" onChange={handleUpload} className="hidden" />
                    <div className="text-gray-400"><Upload size={32} className="mx-auto mb-2" />{uploading ? "Uploading..." : "Click to upload .xlsx file"}</div>
                  </label>
                )}
              </div>
            </div>
            <Button onClick={handlePreview} disabled={!fileUrl || parsing} className="w-full">
              {parsing ? "Parsing..." : "Parse & Preview"}
            </Button>
          </div>
        )}

        {step === "preview" && preview && (
          <div className="space-y-4">
            {error && <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg">{error}</div>}
            {preview.columns.missing.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800">Missing columns: {preview.columns.missing.join(", ")}. These will be blank in imported items.</div>
              </div>
            )}
            <div className="flex gap-4 text-sm">
              <span>{preview.totalRows} rows parsed</span>
              <span className="text-amber-600">{preview.duplicateCount} duplicates detected</span>
            </div>
            <div className="border border-gray-200 rounded-lg overflow-x-auto max-h-[50vh] overflow-y-auto">
              <table className="w-full text-xs whitespace-nowrap">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th className="text-left p-2 font-medium text-gray-600">Title</th>
                    <th className="text-left p-2 font-medium text-gray-600">Description</th>
                    <th className="text-left p-2 font-medium text-gray-600">Parent Group</th>
                    <th className="text-left p-2 font-medium text-gray-600">Subgroup</th>
                    <th className="text-left p-2 font-medium text-gray-600">Cost Code</th>
                    <th className="text-right p-2 font-medium text-gray-600">Qty</th>
                    <th className="text-left p-2 font-medium text-gray-600">Unit</th>
                    <th className="text-right p-2 font-medium text-gray-600">Unit Cost</th>
                    <th className="text-right p-2 font-medium text-gray-600">Total</th>
                    <th className="text-right p-2 font-medium text-gray-600">Markup</th>
                    <th className="text-left p-2 font-medium text-gray-600">M. Type</th>
                    <th className="text-left p-2 font-medium text-gray-600">Line Type</th>
                    <th className="text-left p-2 font-medium text-gray-600">Tax</th>
                    <th className="text-left p-2 font-medium text-gray-600">Warnings</th>
                    <th className="text-left p-2 font-medium text-gray-600">Duplicates</th>
                    <th className="text-left p-2 font-medium text-gray-600 min-w-[140px]">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((r, i) => {
                    const qty = Number(r.Quantity || 0);
                    const unitCost = Number(r["Unit Cost"] || 0);
                    const total = qty * unitCost;
                    return (
                      <tr key={i} className="border-t border-gray-100 align-top">
                        <td className="p-2 font-medium">{r.Title || <span className="text-red-500 italic">missing</span>}</td>
                        <td className="p-2 text-gray-500 max-w-[120px] truncate" title={r.Description}>{r.Description || "—"}</td>
                        <td className="p-2 text-gray-500">{r["Parent Group"] || <span className="text-red-400">—</span>}</td>
                        <td className="p-2 text-gray-500">{r["Subgroup"] || <span className="text-red-400">—</span>}</td>
                        <td className="p-2 text-gray-500">{r["Cost Code"] || <span className="text-red-400">—</span>}</td>
                        <td className="p-2 text-right">{r.Quantity !== "" && r.Quantity != null ? qty : <span className="text-red-400">—</span>}</td>
                        <td className="p-2 text-gray-500">{r.Unit || <span className="text-red-400">—</span>}</td>
                        <td className="p-2 text-right">{r["Unit Cost"] !== "" ? `$${unitCost.toLocaleString()}` : <span className="text-red-400">—</span>}</td>
                        <td className="p-2 text-right font-medium">${total.toLocaleString()}</td>
                        <td className="p-2 text-right">{r.Markup || "—"}</td>
                        <td className="p-2 text-gray-500">{r["Markup Type"] || "—"}</td>
                        <td className="p-2 text-gray-500">{r["Line Item Type"] || <span className="text-red-400">—</span>}</td>
                        <td className="p-2 text-gray-500">{r.Tax || <span className="text-red-400">—</span>}</td>
                        <td className="p-2">
                          {r._warnings && r._warnings.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {r._warnings.map((w, wi) => (
                                <span key={wi} className="inline-block bg-amber-100 text-amber-700 rounded px-1 py-0.5 text-[10px] leading-tight">{w}</span>
                              ))}
                            </div>
                          ) : <span className="text-green-500">✓</span>}
                        </td>
                        <td className="p-2">
                          {r._is_duplicate ? (
                            <div className="space-0.5">
                              {r._duplicate_matches.slice(0, 3).map((m, mi) => (
                                <div key={mi} className="text-amber-600 text-[10px] leading-tight" title={`${m.match_type}: ${m.name}`}>{m.name}</div>
                              ))}
                              {r._duplicate_matches.length > 3 && <div className="text-gray-400 text-[10px]">+{r._duplicate_matches.length - 3} more</div>}
                            </div>
                          ) : <span className="text-green-600">New</span>}
                        </td>
                        <td className="p-2">
                          <Select value={r._action} onValueChange={v => setRowAction(i, v)}>
                            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="create">Create new</SelectItem>
                              <SelectItem value="skip">Skip</SelectItem>
                              {r._is_duplicate && <SelectItem value="update">Update existing</SelectItem>}
                            </SelectContent>
                          </Select>
                          {r._action === "update" && r._is_duplicate && (
                            <Select value={r._update_target_id || ""} onValueChange={v => setRowUpdateTarget(i, v)}>
                              <SelectTrigger className="h-7 text-xs mt-1"><SelectValue placeholder="Pick item..." /></SelectTrigger>
                              <SelectContent>
                                {r._duplicate_matches.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex justify-between items-center">
              <Button variant="outline" onClick={() => setStep("upload")}>Back</Button>
              <div className="text-right">
                <p className="text-xs text-gray-500 mb-1">
                  {preview.rows.filter(r => r._action === "create").length} create · {preview.rows.filter(r => r._action === "update").length} update · {preview.rows.filter(r => r._action === "skip").length} skip
                </p>
                <Button onClick={handleConfirm} disabled={confirming || preview.rows.filter(r => r._action === "create" || (r._action === "update" && r._update_target_id)).length === 0}>
                  {confirming ? "Importing..." : `Import ${preview.rows.filter(r => r._action === "create" || (r._action === "update" && r._update_target_id)).length} Items`}
                </Button>
              </div>
            </div>
          </div>
        )}

        {step === "result" && result && (
          <div className="space-y-4 text-center py-4">
            <CheckCircle size={48} className="mx-auto text-green-500" />
            <div className="space-y-1">
              <p className="text-lg font-semibold">Import Complete</p>
              <p className="text-sm text-gray-500">{result.created_count} created, {result.skipped_count} skipped, {result.error_count} errors</p>
            </div>
            {result.errors.length > 0 && (
              <div className="bg-red-50 rounded-lg p-3 text-left text-xs text-red-700 max-h-32 overflow-y-auto">
                {result.errors.map((e, i) => <div key={i}>{e.row?.Title}: {e.error}</div>)}
              </div>
            )}
            <Button onClick={() => { onOpenChange(false); if (onDone) onDone(); setTimeout(reset, 200); }}>Done</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}