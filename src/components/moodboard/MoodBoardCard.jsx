import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Heart, Trash2, MessageCircle, CheckCircle, Link2 } from "lucide-react";

export default function MoodBoardCard({ item, areas, requirements, staff, onUpdate, onDelete, onComments, commentCount, readOnly = false }) {
  const [showLink, setShowLink] = useState(false);
  const [linkVal, setLinkVal] = useState(item.linked_requirement_id || "");
  const [internalNotes, setInternalNotes] = useState(item.internal_notes || "");

  const area = areas[item.area_id];
  const req = item.linked_requirement_id ? requirements[item.linked_requirement_id] : null;

  async function toggleFavourite() {
    if (readOnly) return;
    const updated = await base44.entities.MoodBoardItem.update(item.id, { is_favourite: !item.is_favourite });
    onUpdate(updated);
  }
  async function toggleReviewed() {
    const updated = await base44.entities.MoodBoardItem.update(item.id, { is_reviewed: !item.is_reviewed });
    onUpdate(updated);
  }
  async function saveLink() {
    const updated = await base44.entities.MoodBoardItem.update(item.id, { linked_requirement_id: linkVal || null });
    onUpdate(updated);
    setShowLink(false);
  }
  async function saveInternalNotes() {
    if (internalNotes === (item.internal_notes || "")) return;
    const updated = await base44.entities.MoodBoardItem.update(item.id, { internal_notes: internalNotes });
    onUpdate(updated);
  }

  return (
    <div className="break-inside-avoid bg-white rounded-xl border border-gray-200 overflow-hidden group">
      {item.image_url && <img src={item.image_url} alt="" className="w-full object-cover" />}
      <div className="p-3 space-y-2">
        {item.notes && <p className="text-sm text-gray-700">{item.notes}</p>}
        {item.link && <a href={item.link} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline block truncate">{item.link}</a>}
        <div className="flex flex-wrap gap-1">
          {(item.tags || []).map((tag, i) => <span key={i} className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{tag}</span>)}
          {item.selection_category && <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">{item.selection_category}</span>}
          {area && <span className="text-[10px] bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded">{area.name}</span>}
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={toggleFavourite} className={item.is_favourite ? "text-red-500" : "text-gray-300 hover:text-red-400"}><Heart size={14} fill={item.is_favourite ? "currentColor" : "none"} /></button>
            <button onClick={onComments} className="text-gray-400 hover:text-gray-600 flex items-center gap-1"><MessageCircle size={14} /> {commentCount > 0 && <span className="text-xs">{commentCount}</span>}</button>
            {item.priority && <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${item.priority === "High" ? "bg-red-100 text-red-600" : item.priority === "Medium" ? "bg-amber-100 text-amber-600" : "bg-gray-100 text-gray-500"}`}>{item.priority}</span>}
          </div>
          <button onClick={() => onDelete(item.id)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14} /></button>
        </div>
        {staff && (
          <div className="pt-2 border-t border-gray-50 space-y-2">
            <div className="flex items-center gap-2">
              <button onClick={toggleReviewed} className={`text-xs flex items-center gap-1 px-2 py-1 rounded ${item.is_reviewed ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}><CheckCircle size={12} /> {item.is_reviewed ? "Reviewed" : "Mark Reviewed"}</button>
              <button onClick={() => setShowLink(!showLink)} className="text-xs flex items-center gap-1 px-2 py-1 rounded bg-gray-100 text-gray-500"><Link2 size={12} /> Link</button>
            </div>
            {req && !showLink && <p className="text-xs text-gray-500">Linked: {req.name}</p>}
            {showLink && (
              <div className="flex gap-2">
                <select value={linkVal} onChange={e => setLinkVal(e.target.value)} className="text-xs border rounded px-2 py-1 flex-1">
                  <option value="">None</option>
                  {Object.values(requirements).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
                <button onClick={saveLink} className="text-xs bg-gray-900 text-white px-2 py-1 rounded">Save</button>
              </div>
            )}
            <textarea value={internalNotes} onChange={e => setInternalNotes(e.target.value)} onBlur={saveInternalNotes} placeholder="Internal notes..." rows={1} className="text-xs w-full border rounded px-2 py-1" />
          </div>
        )}
      </div>
    </div>
  );
}