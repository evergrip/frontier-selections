import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useOutletContext } from "react-router-dom";
import { Image, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import MoodBoardCard from "@/components/moodboard/MoodBoardCard";
import MoodBoardComments from "@/components/moodboard/MoodBoardComments";
import { CATEGORIES } from "@/lib/constants";

export default function StaffMoodBoard() {
  const { selectedProject } = useOutletContext() || {};
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState(selectedProject?.id || "");
  const [items, setItems] = useState([]);
  const [areas, setAreas] = useState({});
  const [requirements, setRequirements] = useState({});
  const [loading, setLoading] = useState(true);
  const [fArea, setFArea] = useState("all");
  const [fTag, setFTag] = useState("all");
  const [fCategory, setFCategory] = useState("all");
  const [fReviewed, setFReviewed] = useState("all");
  const [commentTarget, setCommentTarget] = useState(null);
  const [commentCounts, setCommentCounts] = useState({});

  useEffect(() => {
    base44.entities.Project.list("-updated_date", 100).then(p => {
      setProjects(p);
      if (p[0]) setProjectId(p[0].id); else setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!projectId) return;
    (async () => {
      setLoading(true);
      const [mb, ar, reqs] = await Promise.all([
        base44.entities.MoodBoardItem.filter({ project_id: projectId }, "-created_date", 300),
        base44.entities.ProjectArea.filter({ project_id: projectId }, null, 200),
        base44.entities.SelectionRequirement.filter({ project_id: projectId }, null, 300)
      ]);
      setItems(mb);
      const aMap = {}; ar.forEach(a => aMap[a.id] = a); setAreas(aMap);
      const rMap = {}; reqs.forEach(r => rMap[r.id] = r); setRequirements(rMap);
      const cs = await base44.entities.Comment.filter({ project_id: projectId, target_type: "mood_board" });
      const counts = {}; cs.forEach(c => counts[c.target_id] = (counts[c.target_id] || 0) + 1);
      setCommentCounts(counts);
      setLoading(false);
    })();
  }, [projectId]);

  const allTags = useMemo(() => [...new Set(items.flatMap(i => i.tags || []))], [items]);

  const filtered = useMemo(() => items.filter(i => {
    if (fArea !== "all" && i.area_id !== fArea) return false;
    if (fTag !== "all" && !(i.tags || []).includes(fTag)) return false;
    if (fCategory !== "all" && i.selection_category !== fCategory) return false;
    if (fReviewed === "reviewed" && !i.is_reviewed) return false;
    if (fReviewed === "unreviewed" && i.is_reviewed) return false;
    return true;
  }), [items, fArea, fTag, fCategory, fReviewed]);

  function updateItem(updated) { setItems(items.map(i => i.id === updated.id ? updated : i)); }
  async function handleDelete(id) { await base44.entities.MoodBoardItem.delete(id); setItems(items.filter(i => i.id !== id)); }

  if (loading) return <div className="flex items-center justify-center h-96"><div className="w-8 h-8 border-4 border-gray-200 border-t-gray-800 rounded-full animate-spin" /></div>;

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mood Board Review</h1>
          {selectedProject && (
            <p className="text-sm text-gray-500 mt-1">Viewing: <span className="font-medium">{selectedProject.name}</span></p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {selectedProject && (
            <button onClick={() => setProjectId("")} className="text-sm text-blue-600 hover:underline flex items-center gap-1">
              Clear filter <X size={14} />
            </button>
          )}
          {projects.length > 0 && (
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
              <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={fArea} onValueChange={setFArea}>
          <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="Room" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All Rooms</SelectItem>{Object.values(areas).map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={fCategory} onValueChange={setFCategory}>
          <SelectTrigger className="w-44 h-8 text-xs"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All Categories</SelectItem>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={fTag} onValueChange={setFTag}>
          <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="Tag" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All Tags</SelectItem>{allTags.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={fReviewed} onValueChange={setFReviewed}>
          <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="Reviewed" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="reviewed">Reviewed</SelectItem><SelectItem value="unreviewed">Unreviewed</SelectItem></SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-gray-200">
          <Image size={48} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-400 text-sm">No mood board items</p>
        </div>
      ) : (
        <div className="columns-2 lg:columns-4 gap-4 space-y-4">
          {filtered.map(item => (
            <MoodBoardCard key={item.id} item={item} areas={areas} requirements={requirements} staff={true}
              onUpdate={updateItem} onDelete={handleDelete}
              onComments={() => setCommentTarget(item.id)} commentCount={commentCounts[item.id] || 0} />
          ))}
        </div>
      )}

      <MoodBoardComments open={!!commentTarget} onClose={() => setCommentTarget(null)} projectId={projectId} targetId={commentTarget} staff={true} />
    </div>
  );
}