import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export default function MoodBoardComments({ open, onClose, projectId, targetId, staff }) {
  const [comments, setComments] = useState([]);
  const [content, setContent] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [authorName, setAuthorName] = useState("");

  useEffect(() => {
    if (open && targetId) load();
  }, [open, targetId]);

  async function load() {
    const cs = await base44.entities.Comment.filter({ project_id: projectId, target_type: "mood_board", target_id: targetId });
    setComments(cs.sort((a, b) => (a.created_date || "").localeCompare(b.created_date || "")));
    try { const u = await base44.auth.me(); setAuthorName(u.full_name || u.email || "Customer"); } catch {}
  }

  async function addComment() {
    if (!content.trim()) return;
    const c = await base44.entities.Comment.create({
      project_id: projectId, target_type: "mood_board", target_id: targetId,
      content, is_internal: staff ? isInternal : false,
      author_name: authorName, author_role: staff ? "staff" : "customer"
    });
    setComments([...comments, c]);
    setContent(""); setIsInternal(false);
  }

  const visible = staff ? comments : comments.filter(c => !c.is_internal);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Comments</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {visible.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No comments yet</p>}
          {visible.map(c => (
            <div key={c.id} className={`rounded-lg p-3 text-sm ${c.is_internal ? "bg-yellow-50" : "bg-gray-50"}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-gray-900 text-xs">{c.author_name || (c.is_internal ? "Staff" : "Customer")}</span>
                {c.is_internal && <span className="text-[10px] bg-yellow-200 text-yellow-800 px-1.5 py-0.5 rounded">Internal</span>}
              </div>
              <p className="text-gray-700">{c.content}</p>
            </div>
          ))}
          <div>
            <Textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Add a comment..." rows={2} />
            {staff && (
              <label className="flex items-center gap-2 mt-2 text-xs text-gray-600">
                <input type="checkbox" checked={isInternal} onChange={e => setIsInternal(e.target.checked)} />
                Internal (staff only)
              </label>
            )}
            <Button size="sm" onClick={addComment} className="mt-2 w-full">Add Comment</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}