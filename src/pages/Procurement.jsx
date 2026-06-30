import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Link, useOutletContext, useSearchParams } from "react-router-dom";
import { AlertTriangle, Clock, PackageX, Search, X, CheckSquare, Square, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import StatusBadge from "@/components/ui/StatusBadge";
import { PROCUREMENT_STATUSES, CATEGORIES, AREA_TYPES } from "@/lib/constants";

const DONE_STATUSES = ["Received", "Delivered to Site", "Installed", "Cancelled", "Returned"];
const today = new Date().toISOString().slice(0, 10);

function isOverdue(p) {
  return p.expected_delivery_date && p.expected_delivery_date < today && !DONE_STATUSES.includes(p.status);
}
function missingInfo(p) {
  return !p.supplier || !p.sku || !p.quantity;
}

export default function Procurement() {
  const { selectedProject } = useOutletContext() || {};
  const [items, setItems] = useState([]);
  const [projects, setProjects] = useState({});
  const [areas, setAreas] = useState({});
  const [catItems, setCatItems] = useState({});
  const [loading, setLoading] = useState(true);
  const [fProject, setFProject] = useState(selectedProject?.id || "all");
  const [fSupplier, setFSupplier] = useState("all");
  const [fStatus, setFStatus] = useState("all");
  const [fArea, setFArea] = useState("all");
  const [fCategory, setFCategory] = useState("all");
  const [fDate, setFDate] = useState("");
  const [fOverdue, setFOverdue] = useState(false);
  const [selected, setSelected] = useState([]);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkSupplier, setBulkSupplier] = useState("");
  const [bulkDate, setBulkDate] = useState("");
  const [searchParams] = useSearchParams();
  const urlFilter = searchParams.get("filter");
  const WARNING_STATUSES = ["Backordered", "Delayed", "Substitution Required"];

  useEffect(() => {
    (async () => {
      const ps = await base44.entities.ProcurementItem.list("-created_date", 500);
      setItems(ps);
      const pIds = [...new Set(ps.map(p => p.project_id))];
      const pMap = {};
      for (const id of pIds) { try { pMap[id] = await base44.entities.Project.get(id); } catch {} }
      setProjects(pMap);
      const aIds = [...new Set(ps.map(p => p.area_id).filter(Boolean))];
      const aMap = {};
      for (const id of aIds) { try { aMap[id] = await base44.entities.ProjectArea.get(id); } catch {} }
      setAreas(aMap);
      const cIds = [...new Set(ps.map(p => p.catalogue_item_id).filter(Boolean))];
      const cMap = {};
      for (const id of cIds) { try { cMap[id] = await base44.entities.CatalogueItem.get(id); } catch {} }
      setCatItems(cMap);
      setLoading(false);
    })();
  }, []);

  const suppliers = useMemo(() => [...new Set(items.map(p => p.supplier).filter(Boolean))].sort(), [items]);

  const filtered = useMemo(() => items.filter(p => {
    if (urlFilter === "warnings" && !WARNING_STATUSES.includes(p.status)) return false;
    if (fProject !== "all" && p.project_id !== fProject) return false;
    if (fSupplier !== "all" && p.supplier !== fSupplier) return false;
    if (fStatus !== "all" && p.status !== fStatus) return false;
    if (fArea !== "all" && p.area_id !== fArea) return false;
    if (fCategory !== "all" && p.category !== fCategory) return false;
    if (fDate && p.expected_delivery_date !== fDate) return false;
    if (fOverdue && !isOverdue(p)) return false;
    return true;
  }), [items, fProject, fSupplier, fStatus, fArea, fCategory, fDate, fOverdue, urlFilter]);

  const counts = useMemo(() => ({
    "Ready to Order": items.filter(p => p.status === "Ready to Order").length,
    "Ordered": items.filter(p => p.status === "Ordered").length,
    "Backordered": items.filter(p => p.status === "Backordered").length,
    "Received": items.filter(p => p.status === "Received").length,
    "Delivered to Site": items.filter(p => p.status === "Delivered to Site").length,
    "Installed": items.filter(p => p.status === "Installed").length,
    overdue: items.filter(isOverdue).length,
    missing: items.filter(missingInfo).length,
  }), [items]);

  async function handleBulkStatus(newStatus) {
    if (bulkSaving || selected.length === 0) return;
    setBulkSaving(true);
    try {
      await base44.entities.ProcurementItem.bulkUpdate(selected.map(id => ({ id, status: newStatus, order_date: newStatus === "Ordered" ? new Date().toISOString().slice(0, 10) : undefined, actual_received_date: newStatus === "Received" ? new Date().toISOString().slice(0, 10) : undefined, delivered_to_site_date: newStatus === "Delivered to Site" ? new Date().toISOString().slice(0, 10) : undefined, installed_date: newStatus === "Installed" ? new Date().toISOString().slice(0, 10) : undefined })));
      setSelected([]);
      setBulkSupplier(""); setBulkDate("");
      await reload();
    } catch (e) { alert("Bulk update failed: " + (e.message || "")); }
    setBulkSaving(false);
  }

  async function handleBulkField(field, value) {
    if (bulkSaving || selected.length === 0 || !value) return;
    setBulkSaving(true);
    try {
      await base44.entities.ProcurementItem.bulkUpdate(selected.map(id => ({ id, [field]: value })));
      setSelected([]); setBulkSupplier(""); setBulkDate("");
      await reload();
    } catch (e) { alert("Bulk update failed: " + (e.message || "")); }
    setBulkSaving(false);
  }

  async function reload() {
    const ps = await base44.entities.ProcurementItem.list("-created_date", 500);
    setItems(ps);
  }

  if (loading) return <div className="flex items-center justify-center h-96"><div className="w-8 h-8 border-4 border-gray-200 border-t-gray-800 rounded-full animate-spin" /></div>;

  const cards = [
    { label: "Ready to Order", value: counts["Ready to Order"], tone: "bg-cyan-50 text-cyan-700" },
    { label: "Ordered", value: counts["Ordered"], tone: "bg-blue-50 text-blue-700" },
    { label: "Backordered", value: counts["Backordered"], tone: "bg-red-50 text-red-700" },
    { label: "Received", value: counts["Received"], tone: "bg-teal-50 text-teal-700" },
    { label: "Delivered to Site", value: counts["Delivered to Site"], tone: "bg-teal-50 text-teal-700" },
    { label: "Installed", value: counts["Installed"], tone: "bg-green-50 text-green-700" },
    { label: "Overdue Deliveries", value: counts.overdue, tone: "bg-orange-50 text-orange-700" },
    { label: "Missing Info", value: counts.missing, tone: "bg-amber-50 text-amber-700" },
  ];

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Procurement</h1>
          {selectedProject && (
            <p className="text-sm text-gray-500 mt-1">Viewing: <span className="font-medium">{selectedProject.name}</span></p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {selectedProject && (
            <button onClick={() => setFProject("all")} className="text-sm text-blue-600 hover:underline flex items-center gap-1">
              Clear filter <X size={14} />
            </button>
          )}
          <Link to="/supplier-orders" className="text-sm text-blue-600 hover:underline">Supplier Order Report →</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {cards.map(c => (
          <div key={c.label} className={`rounded-xl p-3 ${c.tone}`}>
            <p className="text-2xl font-bold">{c.value}</p>
            <p className="text-xs font-medium leading-tight">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Select value={fProject} onValueChange={setFProject}>
          <SelectTrigger><SelectValue placeholder="Project" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Projects</SelectItem>
            {Object.entries(projects).map(([id, p]) => <SelectItem key={id} value={id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={fSupplier} onValueChange={setFSupplier}>
          <SelectTrigger><SelectValue placeholder="Supplier" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Suppliers</SelectItem>
            {suppliers.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={fStatus} onValueChange={setFStatus}>
          <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {PROCUREMENT_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={fArea} onValueChange={setFArea}>
          <SelectTrigger><SelectValue placeholder="Area" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Areas</SelectItem>
            {Object.entries(areas).map(([id, a]) => <SelectItem key={id} value={id}>{a.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={fCategory} onValueChange={setFCategory}>
          <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="date" value={fDate} onChange={e => setFDate(e.target.value)} />
        <button onClick={() => setFOverdue(!fOverdue)} className={`flex items-center justify-center gap-2 h-9 rounded-md border text-sm ${fOverdue ? "bg-orange-100 border-orange-300 text-orange-700" : "border-input text-gray-600"}`}>
          <Clock size={14} /> Overdue Only
        </button>
        <button onClick={() => { setFProject("all"); setFSupplier("all"); setFStatus("all"); setFArea("all"); setFCategory("all"); setFDate(""); setFOverdue(false); }} className="text-sm text-gray-500 hover:text-gray-700">Clear Filters</button>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <PackageX size={48} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-400 text-sm">No procurement items yet</p>
          <p className="text-gray-400 text-xs mt-1">Approved selections will appear here once they are ready to order.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {selected.length > 0 && (
            <div className="bg-blue-50 border-b border-blue-200 p-3 flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm text-blue-700 font-medium">{selected.length} item(s) selected</span>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => handleBulkStatus("Ordered")} disabled={bulkSaving}>Mark Ordered</Button>
                <Button size="sm" variant="outline" onClick={() => handleBulkStatus("Received")} disabled={bulkSaving}>Mark Received</Button>
                <Button size="sm" variant="outline" onClick={() => handleBulkStatus("Delivered to Site")} disabled={bulkSaving}>Mark Delivered</Button>
                <Button size="sm" variant="outline" onClick={() => handleBulkStatus("Installed")} disabled={bulkSaving}>Mark Installed</Button>
                <div className="flex items-center gap-1">
                  <Input placeholder="Supplier..." value={bulkSupplier} onChange={e => setBulkSupplier(e.target.value)} className="h-8 text-xs w-32" />
                  <Button size="sm" variant="outline" onClick={() => handleBulkField("supplier", bulkSupplier)} disabled={bulkSaving || !bulkSupplier.trim()}>Set</Button>
                </div>
                <div className="flex items-center gap-1">
                  <Input type="date" value={bulkDate} onChange={e => setBulkDate(e.target.value)} className="h-8 text-xs w-36" />
                  <Button size="sm" variant="outline" onClick={() => handleBulkField("expected_delivery_date", bulkDate)} disabled={bulkSaving || !bulkDate}>Set</Button>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setSelected([])}>Clear</Button>
              </div>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 w-8">
                    <button onClick={() => setSelected(selected.length === filtered.length ? [] : filtered.map(p => p.id))}>
                      {selected.length === filtered.length && filtered.length > 0 ? <CheckSquare size={16} className="text-blue-600" /> : <Square size={16} className="text-gray-300" />}
                    </button>
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Item</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Project / Area</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Supplier</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">SKU</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Qty</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Exp. Delivery</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Warnings</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(p => {
                  const cat = p.catalogue_item_id ? catItems[p.catalogue_item_id] : null;
                  const warns = [];
                  if (p.status === "Backordered") warns.push("Backordered");
                  if (p.status === "Delayed") warns.push("Delayed");
                  if (!p.sku) warns.push("Missing SKU");
                  if (!p.supplier) warns.push("Missing supplier");
                  if (!p.quantity) warns.push("Missing quantity");
                  if (isOverdue(p)) warns.push("Delivery overdue");
                  if (cat && cat.status && cat.status !== "Active") warns.push(`Item ${cat.status}`);
                  if (p.status === "Not Ready to Order") warns.push("Not ready to order");
                  return (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <button onClick={() => setSelected(prev => prev.includes(p.id) ? prev.filter(i => i !== p.id) : [...prev, p.id])}>
                          {selected.includes(p.id) ? <CheckSquare size={16} className="text-blue-600" /> : <Square size={16} className="text-gray-300" />}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <Link to={`/procurement/${p.id}`} className="font-medium text-gray-900 hover:underline">{p.item_name}</Link>
                        {p.category && <p className="text-xs text-gray-400">{p.category}</p>}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{projects[p.project_id]?.name || "—"}<p className="text-xs text-gray-400">{areas[p.area_id]?.name || ""}</p></td>
                      <td className="px-4 py-3 text-gray-600">{p.supplier || "—"}</td>
                      <td className="px-4 py-3 text-gray-600">{p.sku || "—"}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{p.quantity || 0}{p.unit_of_measure ? ` ${p.unit_of_measure}` : ""}</td>
                      <td className="px-4 py-3 text-gray-600">{p.expected_delivery_date || "—"}</td>
                      <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                      <td className="px-4 py-3">
                        {warns.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {warns.slice(0, 2).map((w, i) => <span key={i} className="text-xs bg-red-50 text-red-600 px-1.5 py-0.5 rounded">{w}</span>)}
                            {warns.length > 2 && <span className="text-xs text-gray-400">+{warns.length - 2}</span>}
                          </div>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}