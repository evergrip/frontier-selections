import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Image, Heart, Upload, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import MoodBoardCard from "@/components/moodboard/MoodBoardCard";
import MoodBoardComments from "@/components/moodboard/MoodBoardComments";
import AddMoodBoardDialog from "@/components/moodboard/AddMoodBoardDialog";
import PortalBreadcrumb from "@/components/portal/PortalBreadcrumb";
import { MOOD_BOARD_TAGS } from "@/lib/constants";
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
  const [deletingId, setDeletingId] = useState(null);
  const [togglingId, setTogglingId] = useState(null);
  const { isPreviewMode } = useCustomerPortal();

  useEffect(() => {
    (async () => {
      try {
        const res = await base44.functions.invoke("customerPortal", { action: "list_my_projects" });
        const myProjects = res.data?.projects || [];
        setProjects(myProjects);
        if (myProjects[0]) setProjectId(myProjects[0].id); else setLoading(false);
      } catch (err) {
        setLoadError(err.message || "Failed to load projects");
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!projectId) return;
    (async () => {
      setLoading(true);
      try {
        const res = await base44.functions.invoke("customerPortal", { action: "get_mood_board", project_id: projectId });
        const data = res.data;
        setItems(data.items || []);
        const aMap = {}; (data.areas || []).forEach(a => aMap[a.id] = a); setAreas(aMap);
        setCommentCounts(data.commentCounts || {});
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
    if (isPreviewMode || deletingId) return;
    setDeletingId(id);
    try {
      await base44.functions.invoke("customerPortal", { action: "delete_mood_board_item", project_id: projectId, item_id: id });
      setItems(items.filter(i => i.id !== id));
    } catch (err) {
      alert("Failed to delete item: " + (err.message || "Unknown error"));
    } finally {
      setDeletingId(null);
    }
  }

  async function handleToggleFavourite(item) {
    if (isPreviewMode || togglingId) return;
    setTogglingId(item.id);
    try {
      const res = await base44.functions.invoke("customerPortal", {
        action: "update_mood_board_item", project_id: projectId, item_id: item.id,
        updates: { is_favourite: !item.is_favourite }
      });
      if (res.data?.item) updateItem(res.data.item);
    } catch (err) {
      alert("Failed to update: " + (err.message || "Unknown error"));
    } finally {
      setTogglingId(null);
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
      <PortalBreadcrumb items={[{ label: "Mood Board" }]} />
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
          <p className="text-gray-500 text-sm font-medium">No inspiration saved yet</p>
          <p className="text-gray-400 text-xs mt-1">Upload photos, screenshots, or links to show Frontier your style preferences.</p>
          {!isPreviewMode && <Button variant="outline" className="mt-4" onClick={() => setShowAdd(true)}>Add your first inspiration</Button>}
        </div>
      ) : (
        <div className="columns-2 lg:columns-3 gap-4 space-y-4">
          {filtered.map(item => (
            <MoodBoardCard key={item.id} item={item} areas={areas} requirements={{}} staff={false}
              onUpdate={handleToggleFavourite} onDelete={handleDelete}
              onComments={() => setCommentTarget(item.id)} commentCount={commentCounts[item.id] || 0}
              readOnly={isPreviewMode} />
          ))}
        </div>
      )}

      <AddMoodBoardDialog open={showAdd} onClose={() => setShowAdd(false)} projectId={projectId} areas={areas}
        readOnly={isPreviewMode}
        onAdded={(item) => { setItems([item, ...items]); setShowAdd(false); }} />
      <MoodBoardComments open={!!commentTarget} onClose={() => setCommentTarget(null)} projectId={projectId} targetId={commentTarget} staff={false} readOnly={isPreviewMode} />
    </div>
  );
}