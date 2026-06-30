import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { Plus, Search, Package, Edit2, Copy, Eye, Download, Upload, LayoutDashboard, CheckSquare, Square, Trash2, Grid, List, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CATEGORIES, BT_LINE_ITEM_TYPES, BT_TAX_STATUSES } from "@/lib/constants";
import MissingDataBadges from "@/components/catalogue/MissingDataBadges";
import QuickAddItemDialog from "@/components/catalogue/QuickAddItemDialog";
import BulkEditDialog from "@/components/catalogue/BulkEditDialog";
import BuildertrendImportDialog from "@/components/catalogue/BuildertrendImportDialog";

export default function Catalogue() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [lineItemFilter, setLineItemFilter] = useState("all");
  const [taxFilter, setTaxFilter] = useState("all");
  const [activeFilter, setActiveFilter] = useState("all");
  const [missingBtFilter, setMissingBtFilter] = useState(false);
  const [missingPriceFilter, setMissingPriceFilter] = useState(false);
  const [missingImageFilter, setMissingImageFilter] = useState(false);
  const [selected, setSelected] = useState([]);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [duplicating, setDuplicating] = useState(null);
  const [viewMode, setViewMode] = useState("table");
  const [bulkAction, setBulkAction] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const data = await base44.entities.CatalogueItem.list("-updated_date", 500);
    setItems(data);
    setLoading(false);
  }

  const suppliers = useMemo(() => [...new Set(items.map(i => i.supplier).filter(Boolean))].sort(), [items]);

  const filtered = items.filter(item => {
    const matchSearch = !search || item.name?.toLowerCase().includes(search.toLowerCase()) || item.supplier?.toLowerCase().includes(search.toLowerCase()) || item.sku?.toLowerCase().includes(search.toLowerCase());
    const matchCat = categoryFilter === "all" || item.category === categoryFilter;
    const matchSupplier = supplierFilter === "all" || item.supplier === supplierFilter;
    const matchLineItem = lineItemFilter === "all" || item.line_item_type === lineItemFilter;
    const matchTax = taxFilter === "all" || item.tax_status === taxFilter;
    const matchActive = activeFilter === "all" || (activeFilter === "active" && item.is_active !== false && item.status === "Active") || (activeFilter === "inactive" && (item.is_active === false || ["Inactive", "Discontinued"].includes(item.status)));
    const matchMissingBt = !missingBtFilter || !item.cost_code || !item.line_item_type || !item.tax_status || !item.parent_group || !item.subgroup;
    const matchMissingPrice = !missingPriceFilter || !item.base_price || item.base_price === 0;
    const matchMissingImage = !missingImageFilter || !item.default_image;
    return matchSearch && matchCat && matchSupplier && matchLineItem && matchTax && matchActive && matchMissingBt && matchMissingPrice && matchMissingImage;
  });

  function toggleSelect(id) {
    setSelected(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  }
  function toggleSelectAll() {
    setSelected(prev => prev.length === filtered.length ? [] : filtered.map(i => i.id));
  }

  async function handleBulkAction(action) {
    if (bulkAction || selected.length === 0) return;
    if (action === "delete") {
      if (!window.confirm(`Delete ${selected.length} item(s)? This will also remove their option groups, values, and project assignments. This cannot be undone.`)) return;
    }
    setBulkAction(action);
    try {
      if (action === "delete") {
        await base44.functions.invoke("catalogueManagement", { action: "bulk_delete", item_ids: selected });
      } else if (action === "mark_reviewed") {
        await base44.functions.invoke("catalogueManagement", { action: "mark_reviewed", item_ids: selected });
      } else {
        await base44.functions.invoke("catalogueManagement", { action: "bulk_status", item_ids: selected, status: action });
      }
      await load();
      setSelected([]);
    } catch (e) {
      alert(e.response?.data?.error || "Bulk action failed");
    } finally {
      setBulkAction(null);
    }
  }

  function exportCSV() {
    const headers = ["Name", "Category", "Supplier", "Brand", "SKU", "Base Price", "Quantity", "Unit", "Status", "Active", "Cost Code", "Cost Type", "Parent Group", "Subgroup", "Markup", "Markup Type", "Line Item Type", "Tax Status", "Tags"];
    const rows = filtered.map(item => [
      item.name || "", item.category || "", item.supplier || "", item.brand || "", item.sku || "",
      item.base_price || 0, item.default_quantity || 1, item.unit_of_measure || "",
      item.status || "", item.is_active !== false ? "Yes" : "No",
      item.cost_code || "", item.cost_type || "", item.parent_group || "", item.subgroup || "",
      item.markup || 0, item.markup_type || "", item.line_item_type || "", item.tax_status || "",
      (item.tags || []).join("; ")
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `catalogue-export-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleDuplicate(item) {
    if (duplicating) return;
    const newName = prompt("Name for the duplicated item:", `${item.name} (Copy)`);
    if (!newName || !newName.trim()) return;
    setDuplicating(item.id);
    try {
      await base44.functions.invoke("catalogueManagement", {
        action: "duplicate_item", source_item_id: item.id, name: newName.trim()
      });
      await load();
    } catch (e) {
      alert(e.response?.data?.error || "Failed to duplicate item");
    } finally {
      setDuplicating(null);
    }
  }

  return (
    <div className="p-6 lg:p-8 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Catalogue</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/catalogue-dashboard"><Button variant="outline" className="gap-2"><LayoutDashboard size={16} /> Dashboard</Button></Link>
          <Button variant="outline" onClick={() => setShowImport(true)} className="gap-2"><Upload size={16} /> Import</Button>
          <Button variant="outline" onClick={exportCSV} className="gap-2" disabled={filtered.length === 0}><Download size={16} /> Export CSV</Button>
          <Button onClick={() => setShowQuickAdd(true)} className="gap-2"><Plus size={16} /> Quick Add</Button>
          <Link to="/catalogue/new"><Button variant="outline" className="gap-2"><Edit2 size={16} /> Full Editor</Button></Link>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input placeholder="Search by name, supplier, SKU..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All Categories</SelectItem>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={supplierFilter} onValueChange={setSupplierFilter}>
            <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Supplier" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All Suppliers</SelectItem>{suppliers.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={lineItemFilter} onValueChange={setLineItemFilter}>
            <SelectTrigger className="w-full sm:w-36"><SelectValue placeholder="Line Item" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All Types</SelectItem>{BT_LINE_ITEM_TYPES.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={taxFilter} onValueChange={setTaxFilter}>
            <SelectTrigger className="w-full sm:w-36"><SelectValue placeholder="Tax" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All Tax</SelectItem>{BT_TAX_STATUSES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={activeFilter} onValueChange={setActiveFilter}>
            <SelectTrigger className="w-full sm:w-32"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All Status</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={missingBtFilter} onChange={e => setMissingBtFilter(e.target.checked)} className="rounded" /> Missing BT Fields
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={missingPriceFilter} onChange={e => setMissingPriceFilter(e.target.checked)} className="rounded" /> Missing Price
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={missingImageFilter} onChange={e => setMissingImageFilter(e.target.checked)} className="rounded" /> Missing Image
          </label>
        </div>
      </div>

      {/* View toggle */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{filtered.length} of {items.length} items</p>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          <button onClick={() => setViewMode("table")} className={`p-1.5 rounded ${viewMode === "table" ? "bg-white shadow-sm" : "text-gray-400"}`}><List size={16} /></button>
          <button onClick={() => setViewMode("grid")} className={`p-1.5 rounded ${viewMode === "grid" ? "bg-white shadow-sm" : "text-gray-400"}`}><Grid size={16} /></button>
        </div>
      </div>

      {/* Bulk actions bar */}
      {selected.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm text-blue-700 font-medium">{selected.length} item(s) selected</span>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowBulkEdit(true)} disabled={!!bulkAction}>Bulk Edit</Button>
            <Button size="sm" variant="outline" onClick={() => handleBulkAction("activate")} disabled={!!bulkAction}>Activate</Button>
            <Button size="sm" variant="outline" onClick={() => handleBulkAction("deactivate")} disabled={!!bulkAction}>Deactivate</Button>
            <Button size="sm" variant="outline" onClick={() => handleBulkAction("mark_reviewed")} disabled={!!bulkAction} className="gap-1"><CheckCircle size={14} /> Mark Reviewed</Button>
            <Button size="sm" variant="destructive" onClick={() => handleBulkAction("delete")} disabled={!!bulkAction} className="gap-1"><Trash2 size={14} /> Delete</Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected([])}>Clear</Button>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-gray-200 border-t-gray-800 rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <Package size={48} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-400 text-sm">No catalogue items found</p>
          <Button onClick={() => setShowQuickAdd(true)} variant="outline" className="mt-4 gap-2"><Plus size={16} /> Add your first item</Button>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(item => (
            <div key={item.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
              <Link to={`/catalogue/${item.id}`} className="block relative h-40 bg-gray-100">
                {item.default_image ? (
                  <img src={item.default_image} alt={item.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center"><Package size={32} className="text-gray-300" /></div>
                )}
                <div className="absolute top-2 left-2">
                  <button onClick={(e) => { e.preventDefault(); toggleSelect(item.id); }} className="bg-white/90 rounded p-1 shadow-sm">
                    {selected.includes(item.id) ? <CheckSquare size={14} className="text-blue-600" /> : <Square size={14} className="text-gray-400" />}
                  </button>
                </div>
                <div className="absolute top-2 right-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${item.is_active !== false && item.status === "Active" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                    {item.is_active === false || ["Inactive", "Discontinued"].includes(item.status) ? "Inactive" : "Active"}
                  </span>
                </div>
              </Link>
              <div className="p-3 space-y-1">
                <Link to={`/catalogue/${item.id}`} className="font-medium text-gray-900 text-sm hover:text-blue-600 line-clamp-1">{item.name}</Link>
                <p className="text-xs text-gray-400">{item.category}{item.sku ? ` • ${item.sku}` : ""}</p>
                <div className="flex items-center justify-between pt-1">
                  <span className="font-semibold text-gray-900">${(item.base_price || 0).toLocaleString()}</span>
                  <span className="text-xs text-gray-400">{item.supplier || "—"}</span>
                </div>
                <MissingDataBadges item={item} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="p-3 w-8">
                  <button onClick={toggleSelectAll}>{selected.length === filtered.length && filtered.length > 0 ? <CheckSquare size={16} className="text-blue-600" /> : <Square size={16} className="text-gray-400" />}</button>
                </th>
                <th className="text-left p-3 font-medium text-gray-600">Item</th>
                <th className="text-left p-3 font-medium text-gray-600 hidden md:table-cell">Supplier</th>
                <th className="text-right p-3 font-medium text-gray-600">Price</th>
                <th className="text-left p-3 font-medium text-gray-600 hidden lg:table-cell">Unit</th>
                <th className="text-left p-3 font-medium text-gray-600 hidden lg:table-cell">Parent Group</th>
                <th className="text-left p-3 font-medium text-gray-600 hidden lg:table-cell">Subgroup</th>
                <th className="text-left p-3 font-medium text-gray-600 hidden xl:table-cell">Line Item</th>
                <th className="text-left p-3 font-medium text-gray-600 hidden xl:table-cell">Tax</th>
                <th className="text-center p-3 font-medium text-gray-600">Status</th>
                <th className="text-right p-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(item => (
                <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="p-3">
                    <button onClick={() => toggleSelect(item.id)}>
                      {selected.includes(item.id) ? <CheckSquare size={16} className="text-blue-600" /> : <Square size={16} className="text-gray-300" />}
                    </button>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
                        {item.default_image ? <img src={item.default_image} alt="" className="w-full h-full object-cover rounded-lg" /> : <Package size={14} className="text-gray-300" />}
                      </div>
                      <div>
                        <Link to={`/catalogue/${item.id}`} className="font-medium text-gray-900 hover:text-blue-600">{item.name}</Link>
                        <p className="text-xs text-gray-400">{item.category}{item.sku ? ` • ${item.sku}` : ""}</p>
                        <MissingDataBadges item={item} />
                      </div>
                    </div>
                  </td>
                  <td className="p-3 text-gray-600 hidden md:table-cell">{item.supplier || "—"}</td>
                  <td className="p-3 text-right font-medium">${(item.base_price || 0).toLocaleString()}</td>
                  <td className="p-3 text-gray-600 hidden lg:table-cell">{item.unit_of_measure || "—"}</td>
                  <td className="p-3 text-gray-600 hidden lg:table-cell">{item.parent_group || "—"}</td>
                  <td className="p-3 text-gray-600 hidden lg:table-cell">{item.subgroup || "—"}</td>
                  <td className="p-3 text-gray-600 hidden xl:table-cell">{item.line_item_type || "—"}</td>
                  <td className="p-3 hidden xl:table-cell">
                    {item.tax_status ? <span className={`text-xs px-2 py-0.5 rounded ${item.tax_status === "Taxable" ? "bg-green-50 text-green-700" : "bg-gray-50 text-gray-600"}`}>{item.tax_status}</span> : "—"}
                  </td>
                  <td className="p-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded ${item.is_active !== false && item.status === "Active" ? "bg-emerald-50 text-emerald-700" : "bg-gray-50 text-gray-500"}`}>
                      {item.is_active === false || ["Inactive", "Discontinued"].includes(item.status) ? "Inactive" : "Active"}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link to={`/catalogue/${item.id}`}><Button variant="ghost" size="icon" className="h-8 w-8"><Eye size={14} /></Button></Link>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDuplicate(item)} disabled={duplicating === item.id}>
                        <Copy size={14} />
                      </Button>
                      <Link to={`/catalogue/${item.id}`}><Button variant="ghost" size="icon" className="h-8 w-8"><Edit2 size={14} /></Button></Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <QuickAddItemDialog open={showQuickAdd} onOpenChange={setShowQuickAdd} onCreated={() => load()} />
      <BulkEditDialog open={showBulkEdit} onOpenChange={setShowBulkEdit} selectedIds={selected} onDone={() => { load(); setSelected([]); }} />
      <BuildertrendImportDialog open={showImport} onOpenChange={setShowImport} onDone={() => load()} />
    </div>
  );
}