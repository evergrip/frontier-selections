import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Image, Heart, Upload, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import MoodBoardCard from "@/components/moodboard/MoodBoardCard";
import MoodBoardComments from "@/components/moodboard/MoodBoardComments";
import { MOOD_BOARD_TAGS, CATEGORIES } from "@/lib/constants";
import { useCustomerPortal } from "@/components/CustomerPortalContext";

export default function CustomerMoodBoard() {
  const [items, setItems] = useState([]);
  const [projects, setProjects] = useState([]);
  const [areas, setAreas] = useState({});
  const [projectId, setProjectId] = useState("");
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [fTag, setFTag] = useState("all");
  const [fArea, setFArea] = useState("all");
  const [fFav, setFFav] = useState(false);
  const [commentTarget, setCommentTarget] = useState(null);
  const [commentCounts, setCommentCounts] = useState({});
  const [loadError, setLoadError] = useState(null);
  const { isPreviewMode } = useCustomerPortal();

  useEffect(() => {
    (async () => {
      const user = await base44.auth.me();
      const allProjects = await base44.entities.Project.list("-updated_date", 50);
      const myProjects = allProjects.filter(p =>
        (p.assigned_customers || []).includes(user.id) ||
        (p.assigned_customers || []).includes(user.email)
      );
      setProjects(myProjects);
      if (myProjects[0]) setProjectId(myProjects[0].id); else setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!projectId) return;
    (async () => {
      setLoading(true);
      try {
        const [mb, ar] = await Promise.all([
          base44.entities.MoodBoardItem.filter({ project_id: projectId }, "-created_date", 200),
          base44.entities.ProjectArea.filter({ project_id: projectId }, null, 200)
        ]);
        setItems(mb);
        const aMap = {}; ar.forEach(a => aMap[a.id] = a); setAreas(aMap);
        const cs = await base44.entities.Comment.filter({ project_id: projectId, target_type: "mood_board" });
        const counts = {}; cs.forEach(c => { counts[c.target_id] = (counts[c.target_id] || 0) + 1; });
        setCommentCounts(counts);
      } catch (err) {
        setLoadError(err.message || "Failed to load mood board");
      } finally {
        setLoading(false);
      }
    })();
  }, [projectId]);

  const allTags = useMemo(() => [...new Set(items.flatMap(i => i.tags || []))], [items]);

  const filtered = useMemo(() => items.filter(i => {
    if (fTag !== "all" && !(i.tags || []).includes(fTag)) return false;
    if (fArea !== "all" && i.area_id !== fArea) return false;
    if (fFav && !i.is_favourite) return false;
    return true;
  }), [items, fTag, fArea, fFav]);

  function updateItem(updated) { setItems(items.map(i => i.id === updated.id ? updated : i)); }
  async function handleDelete(id) {
    if (isPreviewMode) return;
    try {
      await base44.entities.MoodBoardItem.delete(id);
      setItems(items.filter(i => i.id !== id));
    } catch (err) {
      alert("Failed to delete item: " + (err.message || "Unknown error"));
    }
  }

  if (loading) return <div className="flex items-center justify-center h-96"><div className="w-8 h-8 border-4 border-gray-200 border-t-gray-800 rounded-full animate-spin" /></div>;
  if (loadError) return (
    <div className="p-8 text-center">
      <AlertTriangle size={32} className="mx-auto text-red-400 mb-2" />
      <p className="text-red-600 text-sm font-medium">Failed to load mood board</p>
      <p className="text-gray-400 text-xs mt-1">{loadError}</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mood Board</h1>
          <p className="text-sm text-gray-500 mt-1">Upload and organize inspiration for your project</p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="gap-2" disabled={isPreviewMode}>{isPreviewMode ? "Preview mode" : "Add Inspiration"}</Button>
      </div>

      {projects.length > 1 && (
        <Select value={projectId} onValueChange={setProjectId}>
          <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
          <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
        </Select>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Select value={fArea} onValueChange={setFArea}>
          <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="Room" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All Rooms</SelectItem>{Object.values(areas).map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={fTag} onValueChange={setFTag}>
          <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="Tag" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All Tags</SelectItem>{allTags.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
        </Select>
        <button onClick={() => setFFav(!fFav)} className={`flex items-center gap-1 h-8 px-3 rounded-md border text-xs ${fFav ? "bg-red-50 border-red-200 text-red-600" : "text-gray-600"}`}><Heart size={12} fill={fFav ? "currentColor" : "none"} /> Favourites</button>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-gray-200">
          <Image size={48} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-400 text-sm">No mood board items yet</p>
          <Button variant="outline" className="mt-4" onClick={() => setShowAdd(true)}>Add your first inspiration</Button>
        </div>
      ) : (
        <div className="columns-2 lg:columns-3 gap-4 space-y-4">
          {filtered.map(item => (
            <MoodBoardCard key={item.id} item={item} areas={areas} requirements={{}} staff={false}
              onUpdate={updateItem} onDelete={handleDelete}
              onComments={() => setCommentTarget(item.id)} commentCount={commentCounts[item.id] || 0}
              readOnly={isPreviewMode} />
          ))}
        </div>
      )}

      <AddMoodBoardDialog open={showAdd} onClose={() => setShowAdd(false)} projectId={projectId} areas={areas} onAdded={(item) => { setItems([item, ...items]); setShowAdd(false); }} />
      <MoodBoardComments open={!!commentTarget} onClose={() => setCommentTarget(null)} projectId={projectId} targetId={commentTarget} staff={false} readOnly={isPreviewMode} />
    </div>
  );
}

function AddMoodBoardDialog({ open, onClose, projectId, areas, onAdded }) {
  const [form, setForm] = useState({ area_id: "", selection_category: "", notes: "", link: "", priority: "Medium", tags: [] });
  const [imageUrl, setImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tagInput, setTagInput] = useState("");

  useEffect(() => { if (open) { setForm({ area_id: "", selection_category: "", notes: "", link: "", priority: "Medium", tags: [] }); setImageUrl(""); } }, [open]);

  async function handleUpload(e) {
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
    setSaving(true);
    try {
      const item = await base44.entities.MoodBoardItem.create({ ...form, project_id: projectId, image_url: imageUrl });
      onAdded(item);
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
                  <button onClick={() => setImageUrl("")} className="absolute top-2 right-2 bg-white rounded-full p-1 shadow text-gray-500 hover:text-red-500">×</button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-gray-400">
                  <input type="file" accept="image/*" onChange={handleUpload} className="hidden" />
                  {uploading ? <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin" /> : <><Upload size={24} className="text-gray-400 mb-1" /><span className="text-xs text-gray-400">Upload image or screenshot</span></>}
                </label>
              )}
            </div>
          </div>
          <div><Label>Room / Area</Label>
            <Select value={form.area_id} onValueChange={v => setForm({ ...form, area_id: v })}>
              <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
              <SelectContent><SelectItem value={null}>None</SelectItem>{Object.values(areas).map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Selection Category</Label>
            <Select value={form.selection_category} onValueChange={v => setForm({ ...form, selection_category: v })}>
              <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
              <SelectContent><SelectItem value={null}>None</SelectItem>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="What inspires you about this?" rows={2} /></div>
          <div><Label>Link</Label><Input value={form.link} onChange={e => setForm({ ...form, link: e.target.value })} placeholder="URL to source" /></div>
          <div><Label>Priority</Label>
            <Select value={form.priority} onValueChange={v => setForm({ ...form, priority: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="Low">Low</SelectItem><SelectItem value="Medium">Medium</SelectItem><SelectItem value="High">High</SelectItem></SelectContent>
            </Select>
          </div>
          <div>
            <Label>Tags</Label>
            <div className="flex gap-2 mt-1">
              <Input value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addTag())} placeholder="Add tag" className="flex-1" />
              <Button variant="outline" size="sm" onClick={() => addTag()}>Add</Button>
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
                <button key={t} onClick={() => addTag(t)} className="text-[10px] bg-gray-50 text-gray-500 px-1.5 py-0.5 rounded hover:bg-gray-100">+ {t}</button>
              ))}
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving || !projectId} className="w-full">{saving ? "Saving..." : "Add to Mood Board"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}