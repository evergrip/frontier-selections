import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Star, Check, Plus } from "lucide-react";

export default function AssignCatalogueDialog({ open, onOpenChange, projectId, areaId, requirementId, onDone }) {
  const [items, setItems] = useState([]);
  const [existing, setExisting] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [selected, setSelected] = useState([]);
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    Promise.all([
      base44.entities.CatalogueItem.list("-updated_date", 500),
      base44.entities.ProjectAvailableCatalogueItem.filter({ project_id: projectId }, null, 500)
    ]).then(([allItems, existingAssign]) => {
      setItems(allItems.filter(i => i.is_active !== false && i.status === "Active"));
      setExisting(existingAssign);
      setLoading(false);
    });
  }, [open, projectId]);

  const existingKeys = new Set(existing.map(e => {
    return `${e.catalogue_item_id}__${e.requirement_id || ""}__${e.area_id || ""}`;
  }));

  const filtered = items.filter(item => {
    const matchSearch = !search || item.name?.toLowerCase().includes(search.toLowerCase()) || item.supplier?.toLowerCase().includes(search.toLowerCase());
    const matchCat = categoryFilter === "all" || item.category === categoryFilter;
    return matchSearch && matchCat;
  });

  const categories = [...new Set(items.map(i => i.category).filter(Boolean))].sort();

  function isAlreadyAssigned(item) {
    const key = `${item.id}__${requirementId || ""}__${areaId || ""}`;
    return existingKeys.has(key);
  }

  function toggleSelect(itemId) {
    setSelected(prev => prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId]);
  }

  async function handleAssign() {
    if (assigning || selected.length === 0) return;
    setAssigning(true);
    try {
      if (selected.length === 1) {
        const res = await base44.functions.invoke("catalogueManagement", {
          action: "assign_to_project",
          project_id: projectId, catalogue_item_id: selected[0],
          area_id: areaId, requirement_id: requirementId
        });
      } else {
        await base44.functions.invoke("catalogueManagement", {
          action: "bulk_assign",
          project_id: projectId, catalogue_item_ids: selected,
          area_id: areaId, requirement_id: requirementId
        });
      }
      if (onDone) onDone();
      onOpenChange(false);
      setSelected([]);
    } catch (e) {
      alert(e.response?.data?.error || "Failed to assign items");
    } finally {
      setAssigning(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Assign Catalogue Items to Project</DialogTitle>
        </DialogHeader>
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input placeholder="Search catalogue..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <select className="border border-input rounded-md px-3 text-sm" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
            <option value="all">All Categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        {loading ? (
          <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-gray-200 border-t-gray-800 rounded-full animate-spin" /></div>
        ) : (
          <div className="space-y-1 max-h-96 overflow-y-auto border border-gray-200 rounded-lg">
            {filtered.map(item => {
              const alreadyAssigned = isAlreadyAssigned(item);
              const isSelected = selected.includes(item.id);
              return (
                <div key={item.id} className={`flex items-center gap-3 p-3 border-b border-gray-50 ${alreadyAssigned ? "bg-gray-50" : "hover:bg-gray-50"}`}>
                  <Checkbox checked={isSelected || alreadyAssigned} disabled={alreadyAssigned} onCheckedChange={() => !alreadyAssigned && toggleSelect(item.id)} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                    <p className="text-xs text-gray-500">{item.category} • {item.supplier || "—"} • ${(item.base_price || 0).toLocaleString()}</p>
                  </div>
                  {alreadyAssigned && <span className="text-xs text-gray-400 flex items-center gap-1"><Check size={12} /> Already added</span>}
                </div>
              );
            })}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleAssign} disabled={assigning || selected.length === 0} className="gap-2">
            <Plus size={16} /> {assigning ? "Assigning..." : `Assign ${selected.length} Item${selected.length !== 1 ? "s" : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}