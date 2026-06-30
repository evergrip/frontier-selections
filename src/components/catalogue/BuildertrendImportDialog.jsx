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
      rows: prev.rows.map((r, i) => i === rowIndex ? { ...r, _action: action } : r)
    }));
  }

  async function handleConfirm() {
    if (confirming) return;
    setConfirming(true);
    setError("");
    try {
      const rowsToImport = preview.rows.filter(r => r._action === "create" || r._action === "update");
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
            <div className="border border-gray-200 rounded-lg overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="text-left p-2 font-medium text-gray-600">Title</th>
                    <th className="text-left p-2 font-medium text-gray-600">Supplier</th>
                    <th className="text-right p-2 font-medium text-gray-600">Unit Cost</th>
                    <th className="text-left p-2 font-medium text-gray-600">Duplicate?</th>
                    <th className="text-left p-2 font-medium text-gray-600">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((r, i) => (
                    <tr key={i} className="border-t border-gray-100">
                      <td className="p-2">{r.Title}</td>
                      <td className="p-2 text-gray-500">{r.Supplier || "—"}</td>
                      <td className="p-2 text-right">${Number(r["Unit Cost"] || 0).toLocaleString()}</td>
                      <td className="p-2">
                        {r._is_duplicate ? (
                          <span className="text-amber-600">{r._duplicate_matches.length} match(es): {r._duplicate_matches.map(m => m.name).join(", ")}</span>
                        ) : <span className="text-green-600">New</span>}
                      </td>
                      <td className="p-2">
                        <Select value={r._action} onValueChange={v => setRowAction(i, v)}>
                          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="create">Create new</SelectItem>
                            <SelectItem value="skip">Skip</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep("upload")}>Back</Button>
              <Button onClick={handleConfirm} disabled={confirming}>{confirming ? "Importing..." : `Import ${preview.rows.filter(r => r._action === "create").length} Items`}</Button>
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