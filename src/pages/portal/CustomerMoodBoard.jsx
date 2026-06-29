import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Image, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function CustomerMoodBoard() {
  const [items, setItems] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    async function load() {
      const [mb, p] = await Promise.all([
        base44.entities.MoodBoardItem.list("-created_date", 100),
        base44.entities.Project.list("-updated_date", 20)
      ]);
      setItems(mb);
      setProjects(p);
      setLoading(false);
    }
    load();
  }, []);

  async function handleDelete(id) {
    await base44.entities.MoodBoardItem.delete(id);
    setItems(items.filter(i => i.id !== id));
  }

  if (loading) return <div className="flex items-center justify-center h-96"><div className="w-8 h-8 border-4 border-gray-200 border-t-gray-800 rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mood Board</h1>
          <p className="text-sm text-gray-500 mt-1">Upload inspiration for your project</p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="gap-2"><Plus size={16} /> Add Inspiration</Button>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-gray-200">
          <Image size={48} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-400 text-sm">No mood board items yet</p>
          <Button variant="outline" className="mt-4" onClick={() => setShowAdd(true)}>Add your first inspiration</Button>
        </div>
      ) : (
        <div className="columns-2 lg:columns-3 gap-4 space-y-4">
          {items.map(item => (
            <div key={item.id} className="break-inside-avoid bg-white rounded-xl border border-gray-200 overflow-hidden group">
              {item.image_url && (
                <img src={item.image_url} alt="" className="w-full object-cover" />
              )}
              <div className="p-3">
                {item.notes && <p className="text-sm text-gray-700">{item.notes}</p>}
                {item.link && <a href={item.link} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline block mt-1">{item.link}</a>}
                <div className="flex items-center justify-between mt-2">
                  <div className="flex gap-1 flex-wrap">
                    {(item.tags || []).map((tag, i) => (
                      <span key={i} className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{tag}</span>
                    ))}
                    {item.priority && <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${item.priority === "High" ? "bg-red-100 text-red-600" : item.priority === "Medium" ? "bg-amber-100 text-amber-600" : "bg-gray-100 text-gray-500"}`}>{item.priority}</span>}
                  </div>
                  <button onClick={() => handleDelete(item.id)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <AddMoodBoardDialog open={showAdd} onClose={() => setShowAdd(false)} projects={projects} onAdded={(item) => { setItems([item, ...items]); setShowAdd(false); }} />
    </div>
  );
}

function AddMoodBoardDialog({ open, onClose, projects, onAdded }) {
  const [form, setForm] = useState({ project_id: "", notes: "", link: "", priority: "Medium", tags: [] });
  const [imageUrl, setImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tagInput, setTagInput] = useState("");

  async function handleUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setImageUrl(file_url);
    setUploading(false);
  }

  async function handleSave() {
    setSaving(true);
    const item = await base44.entities.MoodBoardItem.create({
      ...form,
      project_id: form.project_id || (projects[0]?.id || ""),
      image_url: imageUrl,
      tags: form.tags
    });
    setSaving(false);
    setForm({ project_id: "", notes: "", link: "", priority: "Medium", tags: [] });
    setImageUrl("");
    onAdded(item);
  }

  function addTag() {
    if (tagInput.trim() && !form.tags.includes(tagInput.trim())) {
      setForm({ ...form, tags: [...form.tags, tagInput.trim()] });
      setTagInput("");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Add Inspiration</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Image</Label>
            <div className="mt-2">
              {imageUrl ? (
                <img src={imageUrl} alt="" className="w-full max-h-48 object-cover rounded-lg" />
              ) : (
                <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-gray-400">
                  <input type="file" accept="image/*" onChange={handleUpload} className="hidden" />
                  {uploading ? <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin" /> : <><Upload size={24} className="text-gray-400 mb-1" /><span className="text-xs text-gray-400">Upload image</span></>}
                </label>
              )}
            </div>
          </div>
          {projects.length > 0 && (
            <div><Label>Project</Label>
              <Select value={form.project_id} onValueChange={v => setForm({...form, project_id: v})}>
                <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="What inspires you about this?" rows={2} /></div>
          <div><Label>Link</Label><Input value={form.link} onChange={e => setForm({...form, link: e.target.value})} placeholder="URL to source" /></div>
          <div><Label>Priority</Label>
            <Select value={form.priority} onValueChange={v => setForm({...form, priority: v})}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Low">Low</SelectItem>
                <SelectItem value="Medium">Medium</SelectItem>
                <SelectItem value="High">High</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Tags</Label>
            <div className="flex gap-2 mt-1">
              <Input value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addTag())} placeholder="Add tag" className="flex-1" />
              <Button variant="outline" size="sm" onClick={addTag}>Add</Button>
            </div>
            <div className="flex gap-1 flex-wrap mt-2">
              {form.tags.map((tag, i) => (
                <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded flex items-center gap-1">
                  {tag}
                  <button onClick={() => setForm({...form, tags: form.tags.filter((_, j) => j !== i)})} className="text-gray-400 hover:text-red-500">×</button>
                </span>
              ))}
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving} className="w-full">{saving ? "Saving..." : "Add to Mood Board"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}