import React, { useState } from "react";
import { ChevronDown, ChevronRight, FileSpreadsheet } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BT_UNITS, BT_COST_TYPES, BT_MARKUP_TYPES, BT_LINE_ITEM_TYPES, BT_TAX_STATUSES } from "@/lib/constants";

export default function BuildertrendSection({ form, update }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="bg-blue-50/50 rounded-xl border border-blue-100 p-5 space-y-4">
      <button type="button" onClick={() => setExpanded(!expanded)} className="flex items-center gap-2 w-full">
        {expanded ? <ChevronDown size={16} className="text-blue-500" /> : <ChevronRight size={16} className="text-blue-500" />}
        <FileSpreadsheet size={16} className="text-blue-500" />
        <span className="font-semibold text-sm text-gray-900">Buildertrend Export Mapping</span>
        <span className="text-xs text-gray-400 ml-auto">Maps fields for Buildertrend import</span>
      </button>

      {expanded && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><Label>Cost Code</Label><Input value={form.cost_code || ""} onChange={e => update("cost_code", e.target.value)} placeholder="Buildertrend Flat Rate" /></div>
          <div><Label>Cost Type</Label>
            <Select value={form.cost_type || ""} onValueChange={v => update("cost_type", v)}>
              <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
              <SelectContent>{BT_COST_TYPES.map(c => <SelectItem key={c || "blank"} value={c || ""}>{c || "—"}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Parent Group</Label><Input value={form.parent_group || ""} onChange={e => update("parent_group", e.target.value)} placeholder="e.g. Bathroom" /></div>
          <div><Label>Parent Group Description</Label><Input value={form.parent_group_description || ""} onChange={e => update("parent_group_description", e.target.value)} /></div>
          <div><Label>Subgroup</Label><Input value={form.subgroup || ""} onChange={e => update("subgroup", e.target.value)} placeholder="e.g. Vanities" /></div>
          <div><Label>Subgroup Description</Label><Input value={form.subgroup_description || ""} onChange={e => update("subgroup_description", e.target.value)} /></div>
          <div><Label>Default Quantity</Label><Input type="number" value={form.default_quantity || 1} onChange={e => update("default_quantity", Number(e.target.value))} /></div>
          <div><Label>Default Unit</Label>
            <Select value={form.unit_of_measure || ""} onValueChange={v => update("unit_of_measure", v)}>
              <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
              <SelectContent>{BT_UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Markup</Label><Input type="number" value={form.markup || 0} onChange={e => update("markup", Number(e.target.value))} /></div>
          <div><Label>Markup Type</Label>
            <Select value={form.markup_type || ""} onValueChange={v => update("markup_type", v)}>
              <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
              <SelectContent>{BT_MARKUP_TYPES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Line Item Type</Label>
            <Select value={form.line_item_type || ""} onValueChange={v => update("line_item_type", v)}>
              <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
              <SelectContent>{BT_LINE_ITEM_TYPES.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Tax Status</Label>
            <Select value={form.tax_status || "Taxable"} onValueChange={v => update("tax_status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{BT_TAX_STATUSES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
      )}
    </div>
  );
}