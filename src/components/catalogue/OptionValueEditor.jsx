import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Trash2, Upload, ChevronDown, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { OPTION_STATUSES } from "@/lib/constants";

export default function OptionValueEditor({ option, onUpdate, onRemove }) {
  const [expanded, setExpanded] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function handleImage(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      onUpdate("image", file_url);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="bg-gray-50 rounded-lg p-3 space-y-3">
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setExpanded(!expanded)} className="text-gray-400 hover:text-gray-600 shrink-0">
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        <Input value={option.name} onChange={e => onUpdate("name", e.target.value)} placeholder="Option name" className="flex-1 bg-white" />
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-400">$</span>
          <Input type="number" value={option.price_modifier || 0} onChange={e => onUpdate("price_modifier", Number(e.target.value))} className="w-24 bg-white" />
        </div>
        <Button variant="ghost" size="icon" onClick={onRemove} className="text-gray-400 hover:text-red-500 shrink-0"><Trash2 size={14} /></Button>
      </div>
      {expanded && (
        <div className="space-y-3 pl-6">
          <div className="flex items-center gap-4">
            {option.image ? (
              <img src={option.image} alt="" className="w-16 h-16 object-cover rounded-lg border" />
            ) : (
              <div className="w-16 h-16 bg-white rounded-lg flex items-center justify-center text-gray-300 border"><Upload size={18} /></div>
            )}
            <label className="cursor-pointer">
              <input type="file" accept="image/*" onChange={handleImage} className="hidden" />
              <Button variant="outline" size="sm" asChild><span>{uploading ? "Uploading..." : "Upload Image"}</span></Button>
            </label>
          </div>
          <div>
            <Label className="text-xs">Customer-Facing Note</Label>
            <Textarea value={option.customer_note || ""} onChange={e => onUpdate("customer_note", e.target.value)} rows={2} className="bg-white mt-1" placeholder="Shown to the customer under this option" />
          </div>
          <div>
            <Label className="text-xs">Staff-Only Note</Label>
            <Textarea value={option.internal_note || ""} onChange={e => onUpdate("internal_note", e.target.value)} rows={2} className="bg-white mt-1" placeholder="Visible to staff only" />
          </div>
          <div>
            <Label className="text-xs">Warning Messages (comma-separated)</Label>
            <Input value={(option.warnings || []).join(", ")} onChange={e => onUpdate("warnings", e.target.value.split(",").map(s => s.trim()).filter(Boolean))} className="bg-white mt-1" placeholder="e.g. Requires extra lead time, Special order" />
          </div>
          <div>
            <Label className="text-xs">Availability Status</Label>
            <Select value={option.status || "Active"} onValueChange={v => onUpdate("status", v)}>
              <SelectTrigger className="bg-white mt-1 text-xs h-8"><SelectValue /></SelectTrigger>
              <SelectContent>{OPTION_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-2 text-xs">
            <Switch checked={!!option.requires_approval} onCheckedChange={v => onUpdate("requires_approval", v)} /> Requires Staff Approval
          </label>
        </div>
      )}
    </div>
  );
}