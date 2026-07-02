import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Trash2, Upload, ChevronDown, ChevronRight, X, Plus, Link as LinkIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { OPTION_STATUSES } from "@/lib/constants";

function getOptionImage(opt) {
  return opt.image || opt.image_url || "";
}

export default function OptionValueEditor({ option, onUpdate, onRemove }) {
  const [expanded, setExpanded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadTarget, setUploadTarget] = useState("image");
  const [galleryUrlInput, setGalleryUrlInput] = useState("");

  async function handleUpload(e, target) {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    setUploadTarget(target);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      if (target === "image") {
        onUpdate("image", file_url);
      } else if (target === "gallery") {
        onUpdate("gallery_images", [...(option.gallery_images || []), file_url]);
      }
    } finally {
      setUploading(false);
    }
  }

  function addGalleryUrl() {
    const url = galleryUrlInput.trim();
    if (!url) return;
    onUpdate("gallery_images", [...(option.gallery_images || []), url]);
    setGalleryUrlInput("");
  }

  function removeGalleryImage(idx) {
    onUpdate("gallery_images", (option.gallery_images || []).filter((_, i) => i !== idx));
  }

  const img = getOptionImage(option);

  return (
    <div className="bg-gray-50 rounded-lg p-3 space-y-3">
      {/* Collapsed row: thumbnail + name + price + status + expand */}
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setExpanded(!expanded)} className="text-gray-400 hover:text-gray-600 shrink-0">
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        <div className="shrink-0">
          {img ? (
            <img src={img} alt="" className="w-10 h-10 object-cover rounded-lg border" />
          ) : (
            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-gray-300 border"><Upload size={14} /></div>
          )}
        </div>
        <Input value={option.name} onChange={e => onUpdate("name", e.target.value)} placeholder="Option name" className="flex-1 bg-white" />
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-400">$</span>
          <Input type="number" value={option.price_modifier || 0} onChange={e => onUpdate("price_modifier", Number(e.target.value))} className="w-24 bg-white" />
        </div>
        <span className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 ${
          option.status === "Active" ? "bg-emerald-100 text-emerald-700" :
          option.status === "Discontinued" ? "bg-red-100 text-red-700" :
          "bg-gray-100 text-gray-600"
        }`}>{option.status || "Active"}</span>
        <Button variant="ghost" size="icon" onClick={onRemove} className="text-gray-400 hover:text-red-500 shrink-0"><Trash2 size={14} /></Button>
      </div>

      {expanded && (
        <div className="space-y-3 pl-6">
          {/* Option image */}
          <div>
            <Label className="text-xs">Option Image</Label>
            <div className="flex items-center gap-4 mt-1">
              {img ? (
                <div className="relative group">
                  <img src={img} alt="" className="w-20 h-20 object-cover rounded-lg border" />
                  <button type="button" onClick={() => { onUpdate("image", ""); onUpdate("image_url", ""); }} className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"><X size={12} /></button>
                </div>
              ) : (
                <div className="w-20 h-20 bg-white rounded-lg flex items-center justify-center text-gray-300 border"><Upload size={18} /></div>
              )}
              <label className="cursor-pointer">
                <input type="file" accept="image/*" onChange={e => handleUpload(e, "image")} className="hidden" />
                <Button variant="outline" size="sm" asChild><span>{uploading && uploadTarget === "image" ? "Uploading..." : "Upload Image"}</span></Button>
              </label>
            </div>
          </div>

          {/* Image URL */}
          <div>
            <Label className="text-xs">Image URL</Label>
            <Input
              value={option.image_url || ""}
              onChange={e => onUpdate("image_url", e.target.value)}
              placeholder="Paste image URL (used as fallback if no uploaded image)"
              className="bg-white mt-1"
            />
          </div>

          {/* Description */}
          <div>
            <Label className="text-xs">Description</Label>
            <Textarea value={option.description || ""} onChange={e => onUpdate("description", e.target.value)} rows={2} className="bg-white mt-1" placeholder="Short description of this option" />
          </div>

          {/* Gallery images */}
          <div>
            <Label className="text-xs">Gallery Images (optional)</Label>
            {(option.gallery_images || []).length > 0 && (
              <div className="flex flex-wrap gap-2 mt-1">
                {(option.gallery_images || []).map((url, i) => (
                  <div key={i} className="relative group">
                    <img src={url} alt="" className="w-16 h-16 object-cover rounded-lg border" />
                    <button type="button" onClick={() => removeGalleryImage(i)} className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"><X size={12} /></button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2 mt-1">
              <Input
                value={galleryUrlInput}
                onChange={e => setGalleryUrlInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addGalleryUrl())}
                placeholder="Paste image URL and press Enter"
                className="bg-white flex-1"
              />
              <Button variant="outline" size="sm" onClick={addGalleryUrl} className="gap-1"><Plus size={12} /> Add</Button>
            </div>
            <label className="cursor-pointer mt-1 inline-block">
              <input type="file" accept="image/*" onChange={e => handleUpload(e, "gallery")} className="hidden" />
              <Button variant="ghost" size="sm" asChild><span>{uploading && uploadTarget === "gallery" ? "Uploading..." : "Or upload a file"}</span></Button>
            </label>
          </div>

          {/* Spec sheet URL */}
          <div>
            <Label className="text-xs">Spec Sheet URL (optional)</Label>
            <Input
              value={option.spec_sheet_url || ""}
              onChange={e => onUpdate("spec_sheet_url", e.target.value)}
              placeholder="Link to product spec sheet / datasheet"
              className="bg-white mt-1"
            />
          </div>

          {/* Supplier link */}
          <div>
            <Label className="text-xs">Supplier / Product Link (optional)</Label>
            <Input
              value={option.supplier_link || ""}
              onChange={e => onUpdate("supplier_link", e.target.value)}
              placeholder="Link to supplier or product page"
              className="bg-white mt-1"
            />
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