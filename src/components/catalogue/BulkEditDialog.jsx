import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CATEGORIES, BT_LINE_ITEM_TYPES, BT_TAX_STATUSES, BT_MARKUP_TYPES } from "@/lib/constants";

export default function BulkEditDialog({ open, onOpenChange, selectedIds, onDone }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [updates, setUpdates] = useState({});

  function update(field, value) { setUpdates(prev => ({ ...prev, [field]: value })); }

  async function handleSave() {
    if (saving || Object.keys(updates).length === 0) return;
    setSaving(true);
    setError("");
    try {
      const cleanUpdates = {};
      for (const [k, v] of Object.entries(updates)) {
        if (v !== "" && v !== null && v !== undefined) cleanUpdates[k] = v;
      }
      await base44.functions.invoke("catalogueManagement", {
        action: "bulk_edit", item_ids: selectedIds, updates: cleanUpdates
      });
      if (onDone) onDone();
      onOpenChange(false);
      setUpdates({});
    } catch (e) {
      setError(e.response?.data?.error || "Failed to bulk edit items");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Bulk Edit {selectedIds.length} Items</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {error && <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg">{error}</div>}
          <p className="text-sm text-gray-500">Only fields you fill in will be updated. Leave blank to skip.</p>
          <div><Label>Supplier</Label><Input value={updates.supplier || ""} onChange={e => update("supplier", e.target.value)} /></div>
          <div><Label>Category</Label>
            <Select value={updates.category || ""} onValueChange={v => update("category", v)}>
              <SelectTrigger><SelectValue placeholder="Keep existing" /></SelectTrigger>
              <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Parent Group</Label><Input value={updates.parent_group || ""} onChange={e => update("parent_group", e.target.value)} /></div>
            <div><Label>Subgroup</Label><Input value={updates.subgroup || ""} onChange={e => update("subgroup", e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Cost Code</Label><Input value={updates.cost_code || ""} onChange={e => update("cost_code", e.target.value)} /></div>
            <div><Label>Cost Type</Label>
              <Select value={updates.cost_type || ""} onValueChange={v => update("cost_type", v)}>
                <SelectTrigger><SelectValue placeholder="Keep existing" /></SelectTrigger>
                <SelectContent>{["Labor", "Material", "Equipment", "Subcontractor", "Other"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Markup</Label><Input type="number" value={updates.markup || ""} onChange={e => update("markup", Number(e.target.value))} /></div>
            <div><Label>Markup Type</Label>
              <Select value={updates.markup_type || ""} onValueChange={v => update("markup_type", v)}>
                <SelectTrigger><SelectValue placeholder="Keep existing" /></SelectTrigger>
                <SelectContent>{BT_MARKUP_TYPES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Line Item Type</Label>
              <Select value={updates.line_item_type || ""} onValueChange={v => update("line_item_type", v)}>
                <SelectTrigger><SelectValue placeholder="Keep existing" /></SelectTrigger>
                <SelectContent>{BT_LINE_ITEM_TYPES.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Tax Status</Label>
              <Select value={updates.tax_status || ""} onValueChange={v => update("tax_status", v)}>
                <SelectTrigger><SelectValue placeholder="Keep existing" /></SelectTrigger>
                <SelectContent>{BT_TAX_STATUSES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>Tags (comma-separated)</Label><Input value={(updates.tags || []).join(", ")} onChange={e => update("tags", e.target.value.split(",").map(s => s.trim()).filter(Boolean))} /></div>
          <div>
            <Label>Active Status</Label>
            <Select value={updates.is_active === undefined ? "" : String(updates.is_active)} onValueChange={v => update("is_active", v === "true")}>
              <SelectTrigger><SelectValue placeholder="Keep existing" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="true">Active</SelectItem>
                <SelectItem value="false">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || Object.keys(updates).length === 0}>{saving ? "Updating..." : `Update ${selectedIds.length} Items`}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}