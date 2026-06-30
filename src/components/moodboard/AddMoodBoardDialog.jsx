import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MOOD_BOARD_TAGS, CATEGORIES } from "@/lib/constants";

export default function AddMoodBoardDialog({ open, onClose, projectId, areas, onAdded, readOnly = false }) {
  const [form, setForm] = useState({ area_id: "", selection_category: "", notes: "", link: "", priority: "Medium", tags: [] });
  const [imageUrl, setImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tagInput, setTagInput] = useState("");

  useEffect(() => { if (open) { setForm({ area_id: "", selection_category: "", notes: "", link: "", priority: "Medium", tags: [] }); setImageUrl(""); } }, [open]);

  async function handleUpload(e) {
    if (readOnly) return;
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setImageUrl(file_url);
    } catch (err) {
      alert("Upload failed: " + (err.message || "Unknown error"));
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    if (readOnly) return;
    setSaving(true);
    try {
      const res = await base44.functions.invoke("customerPortal", {
        action: "create_mood_board_item",
        project_id: projectId,
        area_id: form.area_id || null,
        selection_category: form.selection_category || "",
        image_url: imageUrl,
        link: form.link || "",
        notes: form.notes || "",
        tags: form.tags || [],
        priority: form.priority || "Medium"
      });
      if (res.data?.error) throw new Error(res.data.error);
      if (res.data?.item) onAdded(res.data.item);
    } catch (err) {
      alert("Failed to save: " + (err.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  }

  function addTag(t) {
    const tag = (t || tagInput).trim();
    if (tag && !form.tags.includes(tag)) { setForm({ ...form, tags: [...form.tags, tag] }); setTagInput(""); }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Add Inspiration</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Image / Screenshot</Label>
            <div className="mt-2">
              {imageUrl ? (
                <div className="relative">
                  <img src={imageUrl} alt="" className="w-full max-h-48 object-cover rounded-lg" />
                  {!readOnly && <button onClick={() => setImageUrl("")} className="absolute top-2 right-2 bg-white rounded-full p-1 shadow text-gray-500 hover:text-red-500">×</button>}
                </div>
              ) : (
                <label className={`flex flex-col items-center justify-center h-32 border-2 border-dashed border-gray-200 rounded-xl ${readOnly ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:border-gray-400"}`}>
                  <input type="file" accept="image/*" onChange={handleUpload} className="hidden" disabled={readOnly} />
                  {uploading ? <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin" /> : <><Upload size={24} className="text-gray-400 mb-1" /><span className="text-xs text-gray-400">{readOnly ? "Uploads disabled in preview" : "Upload image or screenshot"}</span></>}
                </label>
              )}
            </div>
          </div>
          <div><Label>Room / Area</Label>
            <Select value={form.area_id} onValueChange={v => setForm({ ...form, area_id: v })} disabled={readOnly}>
              <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
              <SelectContent><SelectItem value={null}>None</SelectItem>{Object.values(areas).map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Selection Category</Label>
            <Select value={form.selection_category} onValueChange={v => setForm({ ...form, selection_category: v })} disabled={readOnly}>
              <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
              <SelectContent><SelectItem value={null}>None</SelectItem>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="What inspires you about this?" rows={2} disabled={readOnly} /></div>
          <div><Label>Link</Label><Input value={form.link} onChange={e => setForm({ ...form, link: e.target.value })} placeholder="URL to source" disabled={readOnly} /></div>
          <div><Label>Priority</Label>
            <Select value={form.priority} onValueChange={v => setForm({ ...form, priority: v })} disabled={readOnly}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="Low">Low</SelectItem><SelectItem value="Medium">Medium</SelectItem><SelectItem value="High">High</SelectItem></SelectContent>
            </Select>
          </div>
          <div>
            <Label>Tags</Label>
            <div className="flex gap-2 mt-1">
              <Input value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addTag())} placeholder="Add tag" className="flex-1" disabled={readOnly} />
              <Button variant="outline" size="sm" onClick={() => addTag()} disabled={readOnly}>Add</Button>
            </div>
            <div className="flex gap-1 flex-wrap mt-2">
              {form.tags.map((tag, i) => (
                <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded flex items-center gap-1">{tag}
                  <button onClick={() => setForm({ ...form, tags: form.tags.filter((_, j) => j !== i) })} className="text-gray-400 hover:text-red-500">×</button>
                </span>
              ))}
            </div>
            <div className="flex gap-1 flex-wrap mt-2">
              {MOOD_BOARD_TAGS.filter(t => !form.tags.includes(t)).slice(0, 12).map(t => (
                <button key={t} onClick={() => addTag(t)} disabled={readOnly} className="text-[10px] bg-gray-50 text-gray-500 px-1.5 py-0.5 rounded hover:bg-gray-100 disabled:opacity-50">+ {t}</button>
              ))}
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving || !projectId || readOnly} className="w-full">{readOnly ? "Preview mode - changes disabled" : saving ? "Saving..." : "Add to Mood Board"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}