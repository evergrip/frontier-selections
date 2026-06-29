import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { FileText, Download, Share2, RefreshCw, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import PackagePreview from "@/components/finalpackage/PackagePreview";

const DONE = ["Approved", "Locked", "Ready to Order", "Ordered", "Received", "Installed"];

export default function FinalPackage() {
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState("");
  const [project, setProject] = useState(null);
  const [requirements, setRequirements] = useState([]);
  const [items, setItems] = useState([]);
  const [version, setVersion] = useState("customer");
  const [includePrice, setIncludePrice] = useState(false);
  const [includeAllowance, setIncludeAllowance] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { base44.entities.Project.list("-updated_date", 100).then(setProjects); }, []);

  async function loadData(pid) {
    if (!pid) return;
    setLoading(true);
    const [p, reqs] = await Promise.all([
      base44.entities.Project.get(pid),
      base44.entities.SelectionRequirement.filter({ project_id: pid }, null, 500)
    ]);
    setProject(p); setRequirements(reqs);
    const res = await base44.functions.invoke("generateReport", { report_type: "final_customer", project_id: pid, format: "json" });
    setItems(res.data.packageItems || []);
    setLoading(false);
  }

  useEffect(() => { loadData(projectId); }, [projectId]);

  const incomplete = requirements.filter(r => r.is_required && !DONE.includes(r.status));

  function downloadFile(file, filename, mime) {
    const bytes = atob(file); const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    const blob = new Blob([arr], { type: mime }); const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
  }

  async function exportPdf(ver) {
    setBusy(true);
    try {
      const res = await base44.functions.invoke("generateReport", {
        report_type: ver === "internal" ? "final_internal" : "final_customer",
        project_id: projectId, include_price: includePrice, include_allowance: includeAllowance, format: "pdf"
      });
      downloadFile(res.data.file, res.data.filename, res.data.mime);
    } catch (e) { alert("Export failed"); }
    setBusy(false);
  }

  async function shareCustomer() {
    setBusy(true);
    try {
      const res = await base44.functions.invoke("shareFinalPackage", { project_id: projectId });
      if (res.data.sent > 0) alert(`Shared with ${res.data.sent} customer(s)`);
      else alert(res.data.error || "No customers to share with");
    } catch (e) { alert("Failed to share"); }
    setBusy(false);
  }

  if (loading) return <div className="flex items-center justify-center h-96"><div className="w-8 h-8 border-4 border-gray-200 border-t-gray-800 rounded-full animate-spin" /></div>;

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><FileText size={22} /> Final Selections Package</h1>
          <p className="text-sm text-gray-500 mt-1">Generate the final approved selections package for a project</p>
        </div>
        <Select value={projectId} onValueChange={setProjectId}>
          <SelectTrigger className="w-64"><SelectValue placeholder="Select project" /></SelectTrigger>
          <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {!projectId ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-gray-200"><p className="text-gray-400">Select a project to generate the final package</p></div>
      ) : (
        <>
          {incomplete.length > 0 && (
            <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-amber-800 font-medium text-sm"><AlertTriangle size={16} /> {incomplete.length} required selection(s) are not yet approved</div>
              <p className="text-xs text-amber-700">Generating a final package before all required selections are approved may produce an incomplete document.</p>
              <ul className="text-xs text-amber-700 list-disc list-inside">{incomplete.map(r => <li key={r.id}>{r.name} — {r.status}</li>)}</ul>
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap items-center gap-4">
            <div>
              <Label>Version</Label>
              <Select value={version} onValueChange={setVersion}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="customer">Customer</SelectItem><SelectItem value="internal">Internal</SelectItem></SelectContent>
              </Select>
            </div>
            {version === "customer" && (
              <div className="flex items-end gap-4">
                <label className="flex items-center gap-2 text-sm text-gray-600 h-9"><input type="checkbox" checked={includePrice} onChange={e => setIncludePrice(e.target.checked)} className="rounded" /> Include price</label>
                <label className="flex items-center gap-2 text-sm text-gray-600 h-9"><input type="checkbox" checked={includeAllowance} onChange={e => setIncludeAllowance(e.target.checked)} className="rounded" /> Include allowance</label>
              </div>
            )}
            <div className="flex items-center gap-2 ml-auto">
              <Button variant="outline" onClick={() => exportPdf("customer")} disabled={busy} className="gap-2"><Download size={14} /> Customer PDF</Button>
              <Button variant="outline" onClick={() => exportPdf("internal")} disabled={busy} className="gap-2"><Download size={14} /> Internal PDF</Button>
              <Button variant="outline" onClick={shareCustomer} disabled={busy} className="gap-2"><Share2 size={14} /> Share with Customer</Button>
              <Button variant="outline" onClick={() => loadData(projectId)} disabled={busy} className="gap-2"><RefreshCw size={14} /> Regenerate</Button>
            </div>
          </div>

          <PackagePreview project={project} items={items} internal={version === "internal"} showPrice={version === "internal" || includePrice} showAllowance={version === "internal" || includeAllowance} />
        </>
      )}
    </div>
  );
}