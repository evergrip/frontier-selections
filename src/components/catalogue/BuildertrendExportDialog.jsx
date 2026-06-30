import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Download, FileSpreadsheet } from "lucide-react";

const SCOPES = [
  { value: "all", label: "All current selections" },
  { value: "approved", label: "Approved selections only" },
  { value: "ready_to_order", label: "Ready to order items" },
  { value: "allowance_only", label: "Allowance items only" }
];

export default function BuildertrendExportDialog({ open, onOpenChange, projectId, projectName }) {
  const [scope, setScope] = useState("all");
  const [parentGroup, setParentGroup] = useState("");
  const [subgroup, setSubgroup] = useState("");
  const [previewing, setPreviewing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");

  async function handlePreview() {
    if (previewing) return;
    setPreviewing(true);
    setError("");
    try {
      const res = await base44.functions.invoke("buildertrendExport", {
        project_id: projectId, scope, parent_group: parentGroup || undefined,
        subgroup: subgroup || undefined, preview: true
      });
      setPreview(res.data);
    } catch (e) {
      setError(e.response?.data?.error || "Failed to generate preview");
    } finally {
      setPreviewing(false);
    }
  }

  async function handleDownload() {
    if (downloading) return;
    setDownloading(true);
    setError("");
    try {
      const response = await fetch(`/api/functions/buildertrendExport`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: projectId, scope, parent_group: parentGroup || undefined, subgroup: subgroup || undefined })
      });
      if (!response.ok) throw new Error("Export failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `buildertrend_${(projectName || "project").replace(/\s+/g, "_").toLowerCase()}_${scope}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      onOpenChange(false);
    } catch (e) {
      setError(e.message || "Failed to download export");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileSpreadsheet size={18} /> Buildertrend Export — {projectName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {error && <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg">{error}</div>}
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Scope</Label>
              <Select value={scope} onValueChange={setScope}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{SCOPES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Parent Group (optional)</Label>
              <input className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" value={parentGroup} onChange={e => setParentGroup(e.target.value)} placeholder="Filter by group" />
            </div>
            <div><Label>Subgroup (optional)</Label>
              <input className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" value={subgroup} onChange={e => setSubgroup(e.target.value)} placeholder="Filter by subgroup" />
            </div>
          </div>
          <Button onClick={handlePreview} disabled={previewing} variant="outline" className="gap-2">
            {previewing ? "Loading preview..." : "Preview Export"}
          </Button>

          {preview && (
            <div className="space-y-3">
              {preview.summary.rowsWithWarnings > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                  <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-800">
                    <p className="font-medium">{preview.summary.rowsWithWarnings} row(s) have missing data</p>
                    <p className="text-xs mt-0.5">Fix these in the catalogue editor before exporting for best results.</p>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-4 gap-3 text-center">
                <div className="bg-gray-50 rounded-lg p-3"><p className="text-2xl font-bold text-gray-900">{preview.summary.totalRows}</p><p className="text-xs text-gray-500">Rows</p></div>
                <div className="bg-gray-50 rounded-lg p-3"><p className="text-2xl font-bold text-gray-900">${preview.summary.totalCost.toLocaleString()}</p><p className="text-xs text-gray-500">Total Cost</p></div>
                <div className="bg-gray-50 rounded-lg p-3"><p className="text-2xl font-bold text-gray-900">${preview.summary.totalAllowance.toLocaleString()}</p><p className="text-xs text-gray-500">Allowances</p></div>
                <div className="bg-gray-50 rounded-lg p-3"><p className="text-2xl font-bold text-gray-900">${preview.summary.taxableTotal.toLocaleString()}</p><p className="text-xs text-gray-500">Taxable</p></div>
              </div>
              <div className="border border-gray-200 rounded-lg overflow-x-auto max-h-64 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="text-left p-2 font-medium text-gray-600">Title</th>
                      <th className="text-left p-2 font-medium text-gray-600">Parent Group</th>
                      <th className="text-left p-2 font-medium text-gray-600">Subgroup</th>
                      <th className="text-right p-2 font-medium text-gray-600">Qty</th>
                      <th className="text-right p-2 font-medium text-gray-600">Unit Cost</th>
                      <th className="text-right p-2 font-medium text-gray-600">Total</th>
                      <th className="text-left p-2 font-medium text-gray-600">Warnings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((r, i) => (
                      <tr key={i} className="border-t border-gray-100">
                        <td className="p-2">{r.title}</td>
                        <td className="p-2 text-gray-500">{r.parentGroup}</td>
                        <td className="p-2 text-gray-500">{r.subgroup}</td>
                        <td className="p-2 text-right">{r.quantity}</td>
                        <td className="p-2 text-right">${r.unitCost.toLocaleString()}</td>
                        <td className="p-2 text-right font-medium">${r.totalCost.toLocaleString()}</td>
                        <td className="p-2">{r.warnings.length > 0 && <span className="text-amber-600">{r.warnings.length} missing</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleDownload} disabled={downloading || !preview} className="gap-2">
            <Download size={16} /> {downloading ? "Generating XLSX..." : "Download XLSX"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}