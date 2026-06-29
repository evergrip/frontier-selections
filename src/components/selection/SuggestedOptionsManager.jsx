import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Search, X, Star, Trash2, ArrowUp, ArrowDown, Eye, Package, AlertTriangle, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { CATEGORIES, ITEM_STATUSES, hasPermission } from "@/lib/constants";

export default function SuggestedOptionsManager({ requirement, projectId, areaId, user, onUpdated }) {
  const [suggested, setSuggested] = useState([]);
  const [catalogueItems, setCatalogueItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterBrand, setFilterBrand] = useState("");
  const [filterSupplier, setFilterSupplier] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [editingItem, setEditingItem] = useState(null);
  const [showPreview, setShowPreview] = useState(false);

  const canManage = hasPermission(user, "manage_suggested_options");
  const canOverridePrice = hasPermission(user, "override_suggested_option_pricing");

  useEffect(() => { load(); }, [requirement?.id]);

  async function load() {
    if (!requirement) return;
    setLoading(true);
    try {
      const items = await base44.entities.ProjectAvailableCatalogueItem.filter({ requirement_id: requirement.id });
      const sorted = items.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
      setSuggested(sorted);
      if (sorted.length > 0) {
        const catIds = sorted.map(s => s.catalogue_item_id);
        const allItems = await base44.entities.CatalogueItem.list(null, 500);
        setCatalogueItems(allItems.filter(i => catIds.includes(i.id)));
      } else {
        setCatalogueItems([]);
      }
    } catch (e) {}
    setLoading(false);
  }

  const itemMap = useMemo(() => {
    const m = {};
    catalogueItems.forEach(i => { m[i.id] = i; });
    return m;
  }, [catalogueItems]);

  async function addSuggested(catalogueItemId) {
    try {
      await base44.entities.ProjectAvailableCatalogueItem.create({
        project_id: projectId,
        area_id: areaId,
        requirement_id: requirement.id,
        catalogue_item_id: catalogueItemId,
        display_order: suggested.length,
        is_recommended: false,
        is_available: true,
        created_by: user?.id
      });
      await base44.entities.AuditLog.create({
        target_type: "suggested_option",
        target_id: catalogueItemId,
        action: "suggested_option_added",
        description: "Suggested option added to requirement",
        actor_user_id: user?.id,
        actor_name: user?.full_name || user?.email,
        project_id: projectId,
        field: "requirement_id",
        new_value: requirement.id,
        severity: "medium"
      });
      setShowSearch(false);
      load();
      if (onUpdated) onUpdated();
    } catch (e) { alert("Failed to add suggested option"); }
  }

  async function removeSuggested(suggestedId, catalogueItemId) {
    if (!confirm("Remove this suggested option?")) return;
    try {
      await base44.entities.ProjectAvailableCatalogueItem.delete(suggestedId);
      await base44.entities.AuditLog.create({
        target_type: "suggested_option",
        target_id: catalogueItemId,
        action: "suggested_option_removed",
        description: "Suggested option removed from requirement",
        actor_user_id: user?.id,
        actor_name: user?.full_name || user?.email,
        project_id: projectId,
        field: "requirement_id",
        old_value: requirement.id,
        severity: "medium"
      });
      load();
      if (onUpdated) onUpdated();
    } catch (e) { alert("Failed to remove"); }
  }

  async function moveSuggested(item, direction) {
    const sorted = [...suggested].sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
    const idx = sorted.findIndex(s => s.id === item.id);
    if (idx < 0) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const swapItem = sorted[swapIdx];
    try {
      await base44.entities.ProjectAvailableCatalogueItem.bulkUpdate([
        { id: item.id, display_order: swapItem.display_order },
        { id: swapItem.id, display_order: item.display_order }
      ]);
      await base44.entities.AuditLog.create({
        target_type: "suggested_option",
        target_id: item.catalogue_item_id,
        action: "suggested_option_reordered",
        description: `Suggested option moved ${direction}`,
        actor_user_id: user?.id,
        actor_name: user?.full_name || user?.email,
        project_id: projectId,
        old_value: String(item.display_order),
        new_value: String(swapItem.display_order),
        severity: "low"
      });
      load();
    } catch (e) { alert("Failed to reorder"); }
  }

  async function toggleRecommended(item) {
    try {
      if (!item.is_recommended) {
        const others = suggested.filter(s => s.id !== item.id && s.is_recommended);
        if (others.length > 0) {
          await base44.entities.ProjectAvailableCatalogueItem.bulkUpdate(
            others.map(s => ({ id: s.id, is_recommended: false }))
          );
        }
      }
      await base44.entities.ProjectAvailableCatalogueItem.update(item.id, { is_recommended: !item.is_recommended });
      await base44.entities.AuditLog.create({
        target_type: "suggested_option",
        target_id: item.catalogue_item_id,
        action: "recommended_option_changed",
        description: item.is_recommended ? "Recommended flag removed" : "Marked as recommended",
        actor_user_id: user?.id,
        actor_name: user?.full_name || user?.email,
        project_id: projectId,
        old_value: String(item.is_recommended),
        new_value: String(!item.is_recommended),
        severity: "medium"
      });
      load();
    } catch (e) { alert("Failed to toggle recommended"); }
  }

  async function toggleAvailable(item) {
    try {
      await base44.entities.ProjectAvailableCatalogueItem.update(item.id, { is_available: !item.is_available });
      await base44.entities.AuditLog.create({
        target_type: "suggested_option",
        target_id: item.catalogue_item_id,
        action: "suggested_option_availability_changed",
        description: item.is_available ? "Marked as unavailable" : "Marked as available",
        actor_user_id: user?.id,
        actor_name: user?.full_name || user?.email,
        project_id: projectId,
        old_value: String(item.is_available),
        new_value: String(!item.is_available),
        severity: "medium"
      });
      load();
    } catch (e) { alert("Failed to toggle availability"); }
  }

  async function saveEdit(item, updates) {
    try {
      await base44.entities.ProjectAvailableCatalogueItem.update(item.id, updates);
      const auditActions = [];
      if (updates.staff_note !== undefined && updates.staff_note !== item.staff_note) {
        auditActions.push({ action: "staff_note_changed", field: "staff_note", old_value: item.staff_note || "", new_value: updates.staff_note || "" });
      }
      if (updates.customer_note !== undefined && updates.customer_note !== item.customer_note) {
        auditActions.push({ action: "customer_facing_note_changed", field: "customer_note", old_value: item.customer_note || "", new_value: updates.customer_note || "" });
      }
      if (updates.price_override !== undefined && updates.price_override !== item.price_override) {
        auditActions.push({ action: "price_override_changed", field: "price_override", old_value: String(item.price_override || ""), new_value: String(updates.price_override || "") });
      }
      if (updates.allowance_impact_override !== undefined && updates.allowance_impact_override !== item.allowance_impact_override) {
        auditActions.push({ action: "allowance_impact_override_changed", field: "allowance_impact_override", old_value: String(item.allowance_impact_override || ""), new_value: String(updates.allowance_impact_override || "") });
      }
      for (const a of auditActions) {
        await base44.entities.AuditLog.create({
          target_type: "suggested_option",
          target_id: item.catalogue_item_id,
          action: a.action,
          description: "Suggested option updated",
          actor_user_id: user?.id,
          actor_name: user?.full_name || user?.email,
          project_id: projectId,
          field: a.field,
          old_value: a.old_value,
          new_value: a.new_value,
          severity: "medium"
        });
      }
      setEditingItem(null);
      load();
    } catch (e) { alert("Failed to save"); }
  }

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="animate-spin text-gray-400" /></div>;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-gray-900 text-sm">Suggested / Approved Options for Customer</h2>
          <p className="text-xs text-gray-500 mt-0.5">Control which catalogue items the customer sees for this requirement</p>
        </div>
        <div className="flex gap-2">
          {hasPermission(user, "preview_customer_view") && (
            <Button size="sm" variant="outline" onClick={() => setShowPreview(true)} className="gap-2"><Eye size={14} /> Preview Customer View</Button>
          )}
          {canManage && (
            <Button size="sm" onClick={() => setShowSearch(true)} className="gap-2"><Plus size={14} /> Add Suggested Option</Button>
          )}
        </div>
      </div>

      <SuggestedOptionsWarnings suggested={suggested} itemMap={itemMap} requirement={requirement} />

      {suggested.length === 0 ? (
        <div className="text-center py-10 bg-gray-50 rounded-lg border border-dashed border-gray-200">
          <Package size={28} className="mx-auto text-gray-300 mb-2" />
          <p className="text-sm text-gray-400">No suggested options added yet</p>
          {canManage && <p className="text-xs text-gray-400 mt-1">Click "Add Suggested Option" to search the catalogue</p>}
        </div>
      ) : (
        <div className="space-y-2">
          {[...suggested].sort((a, b) => (a.display_order || 0) - (b.display_order || 0)).map((item, idx, arr) => {
            const cat = itemMap[item.catalogue_item_id];
            if (!cat) return null;
            const isInactive = ["Discontinued", "Inactive", "Temporarily Unavailable", "Backordered"].includes(cat.status);
            return (
              <div key={item.id} className={`border rounded-lg p-3 ${item.is_available ? "border-gray-200" : "border-red-200 bg-red-50"}`}>
                <div className="flex items-start gap-3">
                  <div className="flex flex-col gap-1">
                    <button onClick={() => moveSuggested(item, "up")} disabled={idx === 0} className="text-gray-400 hover:text-gray-700 disabled:opacity-30"><ArrowUp size={14} /></button>
                    <button onClick={() => moveSuggested(item, "down")} disabled={idx === arr.length - 1} className="text-gray-400 hover:text-gray-700 disabled:opacity-30"><ArrowDown size={14} /></button>
                  </div>
                  {cat.default_image ? (
                    <img src={cat.default_image} alt={cat.name} className="w-16 h-16 object-cover rounded-lg border" />
                  ) : (
                    <div className="w-16 h-16 bg-gray-100 rounded-lg border flex items-center justify-center"><Package size={20} className="text-gray-300" /></div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-gray-900 text-sm truncate">{cat.name}</h3>
                      {item.is_recommended && <span className="inline-flex items-center gap-1 text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium"><Star size={10} /> Recommended</span>}
                      {isInactive && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-medium">{cat.status}</span>}
                      {!item.is_available && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-medium">Unavailable</span>}
                    </div>
                    <p className="text-xs text-gray-500">{cat.brand || ""} {cat.supplier ? `• ${cat.supplier}` : ""}</p>
                    {item.customer_note && <p className="text-xs text-blue-600 mt-1">📝 {item.customer_note}</p>}
                    {item.staff_note && <p className="text-xs text-gray-400 mt-0.5">Staff: {item.staff_note}</p>}
                    {item.price_override != null && <p className="text-xs text-gray-500 mt-0.5">Price override: ${item.price_override.toLocaleString()}</p>}
                  </div>
                  <div className="flex flex-col gap-1">
                    {canManage && (
                      <>
                        <button onClick={() => toggleRecommended(item)} title="Toggle recommended" className={`p-1.5 rounded hover:bg-gray-100 ${item.is_recommended ? "text-amber-500" : "text-gray-400"}`}><Star size={14} /></button>
                        <button onClick={() => setEditingItem(item)} title="Edit notes" className="p-1.5 rounded hover:bg-gray-100 text-gray-500"><Plus size={14} /></button>
                        <button onClick={() => toggleAvailable(item)} title="Toggle available" className={`p-1.5 rounded hover:bg-gray-100 ${item.is_available ? "text-green-500" : "text-red-500"}`}><Package size={14} /></button>
                        <button onClick={() => removeSuggested(item.id, item.catalogue_item_id)} title="Remove" className="p-1.5 rounded hover:bg-gray-100 text-red-500"><Trash2 size={14} /></button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showSearch && (
        <CatalogueSearchDialog
          requirement={requirement}
          existingIds={suggested.map(s => s.catalogue_item_id)}
          onAdd={addSuggested}
          onClose={() => setShowSearch(false)}
        />
      )}

      {editingItem && (
        <EditSuggestedDialog
          item={editingItem}
          catalogueItem={itemMap[editingItem.catalogue_item_id]}
          canOverridePrice={canOverridePrice}
          onClose={() => setEditingItem(null)}
          onSave={saveEdit}
        />
      )}

      {showPreview && (
        <CustomerPreviewDialog
          requirement={requirement}
          suggested={suggested}
          itemMap={itemMap}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  );
}

function SuggestedOptionsWarnings({ suggested, itemMap, requirement }) {
  const warnings = [];
  const mode = requirement?.customer_catalogue_access_mode || "suggested_only";

  if (suggested.length === 0 && mode === "suggested_only") {
    warnings.push("This requirement has no suggested options. The customer cannot choose until staff adds options.");
  }
  if (suggested.length === 0 && (mode === "full_category" || mode === "full_plus_request")) {
    warnings.push("Customer will see the full category catalogue.");
  }
  if (mode === "staff_only") {
    warnings.push("Customer cannot choose — staff selection only mode is active.");
  }

  suggested.forEach(s => {
    const cat = itemMap[s.catalogue_item_id];
    if (!cat) return;
    if (["Discontinued", "Inactive", "Temporarily Unavailable", "Backordered"].includes(cat.status)) {
      warnings.push(`"${cat.name}" is ${cat.status} — it will not appear to the customer.`);
    }
    if (!cat.default_image) {
      warnings.push(`"${cat.name}" has a missing image.`);
    }
    if (!cat.base_price && cat.base_price !== 0 && s.price_override == null) {
      warnings.push(`"${cat.name}" has a missing price.`);
    }
  });

  if (warnings.length === 0) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1">
      {warnings.map((w, i) => (
        <p key={i} className="text-sm text-amber-800 flex items-start gap-2"><AlertTriangle size={14} className="mt-0.5 shrink-0" /> {w}</p>
      ))}
    </div>
  );
}

function CatalogueSearchDialog({ requirement, existingIds, onAdd, onClose }) {
  const [allItems, setAllItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState(requirement?.category || "");
  const [filterBrand, setFilterBrand] = useState("");
  const [filterSupplier, setFilterSupplier] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  useEffect(() => {
    base44.entities.CatalogueItem.list("name", 500).then(items => {
      setAllItems(items.filter(i => i.status !== "Discontinued" && i.status !== "Draft"));
      setLoading(false);
    });
  }, []);

  const brands = useMemo(() => [...new Set(allItems.map(i => i.brand).filter(Boolean))], [allItems]);
  const suppliers = useMemo(() => [...new Set(allItems.map(i => i.supplier).filter(Boolean))], [allItems]);

  const filtered = useMemo(() => {
    return allItems.filter(item => {
      if (existingIds.includes(item.id)) return false;
      if (filterCategory && item.category !== filterCategory) return false;
      if (filterBrand && item.brand !== filterBrand) return false;
      if (filterSupplier && item.supplier !== filterSupplier) return false;
      if (filterStatus && item.status !== filterStatus) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return item.name.toLowerCase().includes(q) ||
          (item.description || "").toLowerCase().includes(q) ||
          (item.brand || "").toLowerCase().includes(q) ||
          (item.supplier || "").toLowerCase().includes(q) ||
          (item.tags || []).some(t => t.toLowerCase().includes(q));
      }
      return true;
    });
  }, [allItems, existingIds, searchQuery, filterCategory, filterBrand, filterSupplier, filterStatus]);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Search Catalogue — Add Suggested Option</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by name, description, brand, supplier, tags..."
              className="w-full h-10 pl-9 pr-9 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
            {searchQuery && <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"><X size={16} /></button>}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent><SelectItem value={null}>All Categories</SelectItem>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={filterBrand} onValueChange={setFilterBrand}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Brand" /></SelectTrigger>
              <SelectContent><SelectItem value={null}>All Brands</SelectItem>{brands.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={filterSupplier} onValueChange={setFilterSupplier}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Supplier" /></SelectTrigger>
              <SelectContent><SelectItem value={null}>All Suppliers</SelectItem>{suppliers.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent><SelectItem value={null}>All Statuses</SelectItem>{ITEM_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="animate-spin text-gray-400" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10 text-sm text-gray-400">No items match your filters</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[40vh] overflow-y-auto">
              {filtered.map(item => (
                <div key={item.id} className="flex items-center gap-3 border border-gray-200 rounded-lg p-2 hover:border-gray-300">
                  {item.default_image ? (
                    <img src={item.default_image} alt={item.name} className="w-12 h-12 object-cover rounded-lg border" />
                  ) : (
                    <div className="w-12 h-12 bg-gray-100 rounded-lg border flex items-center justify-center"><Package size={16} className="text-gray-300" /></div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-900 truncate">{item.name}</p>
                    <p className="text-xs text-gray-500 truncate">{item.brand || ""} {item.supplier ? `• ${item.supplier}` : ""}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => onAdd(item.id)} className="gap-1 shrink-0"><Plus size={12} /> Add</Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditSuggestedDialog({ item, catalogueItem, canOverridePrice, onClose, onSave }) {
  const [staffNote, setStaffNote] = useState(item.staff_note || "");
  const [customerNote, setCustomerNote] = useState(item.customer_note || "");
  const [priceOverride, setPriceOverride] = useState(item.price_override != null ? String(item.price_override) : "");
  const [allowanceOverride, setAllowanceOverride] = useState(item.allowance_impact_override != null ? String(item.allowance_impact_override) : "");

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Edit Suggested Option</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="bg-gray-50 rounded-lg p-3 text-sm">
            <p className="font-medium text-gray-900">{catalogueItem?.name}</p>
            <p className="text-xs text-gray-500">{catalogueItem?.brand} {catalogueItem?.supplier ? `• ${catalogueItem.supplier}` : ""}</p>
            <p className="text-xs text-gray-500 mt-1">Base price: ${(catalogueItem?.base_price || 0).toLocaleString()}</p>
          </div>
          <div><Label>Staff Note (internal only)</Label><Textarea value={staffNote} onChange={e => setStaffNote(e.target.value)} rows={2} placeholder="Internal note for staff..." /></div>
          <div><Label>Customer-Facing Note</Label><Textarea value={customerNote} onChange={e => setCustomerNote(e.target.value)} rows={2} placeholder="Shown to customer on the option card..." /></div>
          {canOverridePrice && (
            <>
              <div><Label>Price Override ($)</Label><Input type="number" value={priceOverride} onChange={e => setPriceOverride(e.target.value)} placeholder={`Default: $${(catalogueItem?.base_price || 0).toLocaleString()}`} /></div>
              <div><Label>Allowance Impact Override ($)</Label><Input type="number" value={allowanceOverride} onChange={e => setAllowanceOverride(e.target.value)} placeholder="Positive = overage, negative = credit" /></div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => {
            const updates = { staff_note: staffNote, customer_note: customerNote };
            if (canOverridePrice) {
              updates.price_override = priceOverride ? Number(priceOverride) : null;
              updates.allowance_impact_override = allowanceOverride ? Number(allowanceOverride) : null;
            }
            onSave(item, updates);
          }}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CustomerPreviewDialog({ requirement, suggested, itemMap, onClose }) {
  const sorted = [...suggested].sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
  const visible = sorted.filter(s => {
    const cat = itemMap[s.catalogue_item_id];
    if (!cat) return false;
    if (["Discontinued", "Inactive"].includes(cat.status)) return false;
    if (!s.is_available) return false;
    return true;
  });
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Customer Preview — {requirement?.name}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-800">
            Access mode: <span className="font-medium">{requirement?.customer_catalogue_access_mode?.replace(/_/g, " ") || "suggested only"}</span>
          </div>
          {visible.length === 0 ? (
            <div className="text-center py-10 bg-gray-50 rounded-lg border border-dashed border-gray-200">
              <p className="text-sm text-gray-500">Frontier has not added options for this selection yet. Please check back or contact your project coordinator.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {visible.map(s => {
                const cat = itemMap[s.catalogue_item_id];
                return (
                  <div key={s.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="aspect-square bg-gray-100 relative">
                      {cat?.default_image ? (
                        <img src={cat.default_image} alt={cat.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center"><Package size={28} className="text-gray-300" /></div>
                      )}
                      {s.is_recommended && (
                        <span className="absolute top-2 right-2 inline-flex items-center gap-1 text-[10px] bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-medium"><Star size={10} /> Recommended</span>
                      )}
                    </div>
                    <div className="p-3">
                      <h3 className="font-semibold text-sm text-gray-900">{cat?.name}</h3>
                      <p className="text-xs text-gray-400">{cat?.brand}</p>
                      {s.customer_note && <p className="text-xs text-blue-600 mt-1">📝 {s.customer_note}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}