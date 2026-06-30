import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, ChevronRight } from "lucide-react";
import { CATEGORIES, BT_UNITS, BT_LINE_ITEM_TYPES, BT_TAX_STATUSES } from "@/lib/constants";

export default function QuickAddItemDialog({ open, onOpenChange, onCreated }) {
  const [saving, setSaving] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "", category: "Other", supplier: "", base_price: 0,
    default_quantity: 1, unit_of_measure: "ea", line_item_type: "",
    tax_status: "Taxable", parent_group: "", subgroup: "",
    cost_code: "Buildertrend Flat Rate", cost_type: "", markup: 0, markup_type: "",
    brand: "", sku: "", model_number: "", description: ""
  });

  function update(field, value) { setForm(prev => ({ ...prev, [field]: value })); }

  async function handleSave() {
    if (saving) return;
    if (!form.name.trim()) { setError("Title is required"); return; }
    setSaving(true);
    setError("");
    try {
      const res = await base44.functions.invoke("catalogueManagement", { action: "quick_add", ...form });
      if (onCreated) onCreated(res.data.item);
      onOpenChange(false);
      setForm({ name: "", category: "Other", supplier: "", base_price: 0, default_quantity: 1, unit_of_measure: "ea", line_item_type: "", tax_status: "Taxable", parent_group: "", subgroup: "", cost_code: "Buildertrend Flat Rate", cost_type: "", markup: 0, markup_type: "", brand: "", sku: "", model_number: "", description: "" });
    } catch (e) {
      const data = e.response?.data || {};
      setError(data.error || "Failed to create item");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Quick Add Catalogue Item</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {error && <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg">{error}</div>}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>Title *</Label><Input value={form.name} onChange={e => update("name", e.target.value)} placeholder="e.g. 36-inch Shaker Vanity" /></div>
            <div><Label>Category</Label>
              <Select value={form.category} onValueChange={v => update("category", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Supplier</Label><Input value={form.supplier} onChange={e => update("supplier", e.target.value)} /></div>
            <div><Label>Unit Cost</Label><Input type="number" value={form.base_price} onChange={e => update("base_price", Number(e.target.value))} /></div>
            <div><Label>Quantity</Label><Input type="number" value={form.default_quantity} onChange={e => update("default_quantity", Number(e.target.value))} /></div>
            <div><Label>Unit</Label>
              <Select value={form.unit_of_measure} onValueChange={v => update("unit_of_measure", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{BT_UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Line Item Type</Label>
              <Select value={form.line_item_type} onValueChange={v => update("line_item_type", v)}>
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>{BT_LINE_ITEM_TYPES.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Tax</Label>
              <Select value={form.tax_status} onValueChange={v => update("tax_status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{BT_TAX_STATUSES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Parent Group</Label><Input value={form.parent_group} onChange={e => update("parent_group", e.target.value)} placeholder="e.g. Bathroom" /></div>
            <div><Label>Subgroup</Label><Input value={form.subgroup} onChange={e => update("subgroup", e.target.value)} placeholder="e.g. Vanities" /></div>
          </div>

          <button type="button" onClick={() => setShowAdvanced(!showAdvanced)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
            {showAdvanced ? <ChevronDown size={14} /> : <ChevronRight size={14} />} Advanced Buildertrend Fields
          </button>
          {showAdvanced && (
            <div className="grid grid-cols-2 gap-3 p-3 bg-gray-50 rounded-lg">
              <div><Label>Cost Code</Label><Input value={form.cost_code} onChange={e => update("cost_code", e.target.value)} /></div>
              <div><Label>Cost Type</Label>
                <Select value={form.cost_type} onValueChange={v => update("cost_type", v)}>
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>{["Labor", "Material", "Equipment", "Subcontractor", "Other", ""].map(c => <SelectItem key={c || "blank"} value={c || ""}>{c || "—"}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Markup</Label><Input type="number" value={form.markup} onChange={e => update("markup", Number(e.target.value))} /></div>
              <div><Label>Markup Type</Label>
                <Select value={form.markup_type} onValueChange={v => update("markup_type", v)}>
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>{["%", "$", "$/Unit", "C/P", ""].map(m => <SelectItem key={m || "blank"} value={m || ""}>{m || "—"}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Brand</Label><Input value={form.brand} onChange={e => update("brand", e.target.value)} /></div>
              <div><Label>SKU</Label><Input value={form.sku} onChange={e => update("sku", e.target.value)} /></div>
              <div><Label>Model Number</Label><Input value={form.model_number} onChange={e => update("model_number", e.target.value)} /></div>
              <div className="col-span-2"><Label>Description</Label><Input value={form.description} onChange={e => update("description", e.target.value)} /></div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !form.name.trim()}>{saving ? "Creating..." : "Create Item"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}