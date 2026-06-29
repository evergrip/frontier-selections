import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { FileText, Download, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CATEGORIES, SELECTION_STATUSES, PROCUREMENT_STATUSES } from "@/lib/constants";

const REPORT_TYPES = [
  { value: "summary", label: "Project Selection Summary" },
  { value: "approved_by_room", label: "Approved Selections by Room" },
  { value: "pending", label: "Pending Selections Report" },
  { value: "overdue", label: "Overdue Selections Report" },
  { value: "over_allowance", label: "Selections Over Allowance Report" },
  { value: "change_requests", label: "Change Request Report" },
  { value: "procurement", label: "Procurement Report" },
  { value: "supplier_orders", label: "Supplier Order List" },
  { value: "final_customer", label: "Final Selections Package (Customer)" },
  { value: "final_internal", label: "Final Selections Package (Internal)" },
];

const PACKAGE_TYPES = ["final_customer", "final_internal"];

export default function Reports() {
  const [reportType, setReportType] = useState("summary");
  const [projects, setProjects] = useState([]);
  const [areas, setAreas] = useState([]);
  const [projectId, setProjectId] = useState("");
  const [areaId, setAreaId] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [supplier, setSupplier] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [overAllowanceOnly, setOverAllowanceOnly] = useState(false);
  const [procurementStatus, setProcurementStatus] = useState("");
  const [includePrice, setIncludePrice] = useState(false);
  const [includeAllowance, setIncludeAllowance] = useState(false);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => { base44.entities.Project.list("-updated_date", 100).then(setProjects); }, []);

  useEffect(() => {
    if (projectId) base44.entities.ProjectArea.filter({ project_id: projectId }, null, 200).then(setAreas);
    else { setAreas([]); setAreaId(""); }
  }, [projectId]);

  function buildParams(format) {
    return {
      report_type: reportType, project_id: projectId || null, area_id: areaId || null,
      category: category || null, status: status || null, supplier: supplier || null,
      date_from: dateFrom || null, date_to: dateTo || null, over_allowance_only: overAllowanceOnly,
      procurement_status: procurementStatus || null, include_price: includePrice,
      include_allowance: includeAllowance, format
    };
  }

  async function runPreview() {
    setLoading(true);
    try {
      const res = await base44.functions.invoke("generateReport", buildParams("json"));
      setReport(res.data);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function handleExport(format) {
    setExporting(true);
    try {
      const res = await base44.functions.invoke("generateReport", buildParams(format));
      const { file, filename, mime } = res.data;
      const bytes = atob(file);
      const arr = new Uint8Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
      const blob = new Blob([arr], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { console.error(e); }
    setExporting(false);
  }

  const isPackage = PACKAGE_TYPES.includes(reportType);
  const isCustomerPackage = reportType === "final_customer";

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><FileText size={22} /> Reports & Exports</h1>
        <p className="text-sm text-gray-500 mt-1">View and export project selection information</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <Label>Report Type</Label>
            <Select value={reportType} onValueChange={setReportType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{REPORT_TYPES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Project</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger><SelectValue placeholder="All projects" /></SelectTrigger>
              <SelectContent><SelectItem value={null}>All Projects</SelectItem>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Area / Room</Label>
            <Select value={areaId} onValueChange={setAreaId} disabled={!projectId}>
              <SelectTrigger><SelectValue placeholder="All areas" /></SelectTrigger>
              <SelectContent><SelectItem value={null}>All Areas</SelectItem>{areas.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue placeholder="All categories" /></SelectTrigger>
              <SelectContent><SelectItem value={null}>All Categories</SelectItem>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue placeholder="All statuses" /></SelectTrigger>
              <SelectContent><SelectItem value={null}>All Statuses</SelectItem>{SELECTION_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Supplier</Label>
            <Input value={supplier} onChange={e => setSupplier(e.target.value)} placeholder="Supplier name" />
          </div>
          <div>
            <Label>Due From</Label>
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </div>
          <div>
            <Label>Due To</Label>
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>
          <div>
            <Label>Procurement Status</Label>
            <Select value={procurementStatus} onValueChange={setProcurementStatus}>
              <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
              <SelectContent><SelectItem value={null}>Any</SelectItem>{PROCUREMENT_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm text-gray-600 h-9">
              <input type="checkbox" checked={overAllowanceOnly} onChange={e => setOverAllowanceOnly(e.target.checked)} className="rounded" />
              Over allowance only
            </label>
          </div>
        </div>

        {isCustomerPackage && (
          <div className="flex flex-wrap gap-4 pt-2 border-t border-gray-50">
            <label className="flex items-center gap-2 text-sm text-gray-600"><input type="checkbox" checked={includePrice} onChange={e => setIncludePrice(e.target.checked)} className="rounded" /> Include price</label>
          </div>
        )}
        {isCustomerPackage && (
          <label className="flex items-center gap-2 text-sm text-gray-600"><input type="checkbox" checked={includeAllowance} onChange={e => setIncludeAllowance(e.target.checked)} className="rounded" /> Include allowance impact</label>
        )}

        <div className="flex items-center gap-2 pt-2">
          <Button onClick={runPreview} disabled={loading} className="gap-2"><Filter size={14} /> {loading ? "Loading..." : "Run Report"}</Button>
          <Button variant="outline" onClick={() => handleExport("pdf")} disabled={exporting || !report} className="gap-2"><Download size={14} /> Export PDF</Button>
          {!isPackage && (
            <Button variant="outline" onClick={() => handleExport("csv")} disabled={exporting || !report} className="gap-2"><Download size={14} /> Export CSV</Button>
          )}
        </div>
      </div>

      {report && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">{report.title}</h2>
            <p className="text-xs text-gray-500 mt-0.5">{report.rows.length} rows</p>
          </div>
          {isPackage && report.packageItems ? (
            <PackagePreview items={report.packageItems} internal={reportType === "final_internal"} includePrice={includePrice} includeAllowance={includeAllowance} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>{report.columns.map((c, i) => <th key={i} className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">{c}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {report.rows.length === 0 ? (
                    <tr><td colSpan={report.columns.length} className="px-4 py-10 text-center text-gray-400">No data</td></tr>
                  ) : report.rows.map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50">{row.map((cell, j) => <td key={j} className="px-4 py-2.5 text-gray-700">{cell}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PackagePreview({ items, internal, includePrice, includeAllowance }) {
  if (items.length === 0) return <div className="px-5 py-10 text-center text-gray-400">No approved selections</div>;
  let lastArea = "";
  return (
    <div className="p-5 space-y-4">
      {items.map((it, i) => {
        const showArea = it.area !== lastArea; lastArea = it.area;
        return (
          <div key={i}>
            {showArea && <h3 className="font-semibold text-gray-900 text-sm mb-2">{it.area}</h3>}
            <div className="flex gap-4 bg-gray-50 rounded-xl p-3">
              {it.image && <img src={it.image} alt="" className="w-24 h-24 object-cover rounded-lg border border-gray-200 shrink-0" />}
              <div className="flex-1 space-y-1 text-sm">
                <p className="font-medium text-gray-900">{it.requirement}: {it.item}</p>
                <p className="text-xs text-gray-500">Options: {it.options || "—"}</p>
                <p className="text-xs text-gray-500">Supplier: {it.supplier || "—"} • Brand: {it.brand || "—"} • SKU: {it.sku || "—"} • Qty: {it.qty}</p>
                <p className="text-xs text-gray-500">Customer Approval: {it.customerApprovalDate || "—"} • Staff Approval: {it.staffApprovalDate || "—"}</p>
                {!internal && includePrice && <p className="text-xs text-gray-500">Price: ${it.price.toLocaleString()}</p>}
                {!internal && includeAllowance && <p className="text-xs text-gray-500">Allowance Impact: ${it.allowanceImpact.toLocaleString()}</p>}
                {internal && (
                  <>
                    <p className="text-xs text-gray-500">Price: ${it.price.toLocaleString()} • Allowance Impact: ${it.allowanceImpact.toLocaleString()}</p>
                    <p className="text-xs text-gray-500">Procurement: {it.procurementStatus || "—"}</p>
                    {it.installNotes && <p className="text-xs text-gray-500">Install Notes: {it.installNotes}</p>}
                    {it.siteNotes && <p className="text-xs text-gray-500">Site Notes: {it.siteNotes}</p>}
                    {it.internalNotes && <p className="text-xs text-yellow-700">Internal: {it.internalNotes}</p>}
                  </>
                )}
                {it.notes && <p className="text-xs text-gray-600">Notes: {it.notes}</p>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}