import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { MessageSquare, DollarSign, RefreshCw, AlertTriangle } from "lucide-react";

export default function ProjectTimeline({ projectId, staff = true }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await base44.functions.invoke("customerPortal", { action: "get_project_timeline", project_id: projectId });
        const data = res.data;
        if (data?.error) throw new Error(data.error);
        const comments = data.comments || [];
        const ledger = data.ledger || [];
        const crs = data.changeRequests || [];

        const evs = [
          ...comments.map(c => ({
            id: c.id, date: c.created_date, type: "Comment", icon: MessageSquare, tone: "blue",
            title: c.author_name || (c.is_internal ? "Staff (internal)" : "Customer"),
            text: c.content, badge: c.is_internal ? "Internal" : "Customer-visible"
          })),
          ...(staff ? ledger.map(l => ({
            id: l.id, date: l.created_date, type: l.event_type, icon: DollarSign, tone: "emerald",
            title: l.performed_by || "Staff", text: l.description || "", badge: l.event_type
          })) : []),
          ...crs.map(r => ({
            id: r.id, date: r.created_date, type: "Change Request", icon: RefreshCw, tone: "amber",
            title: r.status, text: `${r.original_item_name || "—"} → ${r.requested_item_name || "—"}`, badge: r.status
          }))
        ];
        evs.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
        setEvents(evs);
      } catch (err) {
        setLoadError(err.message || "Failed to load timeline");
      } finally {
        setLoading(false);
      }
    })();
  }, [projectId]);

  if (loading) return <div className="flex items-center justify-center h-32"><div className="w-6 h-6 border-4 border-gray-200 border-t-gray-800 rounded-full animate-spin" /></div>;
  if (loadError) return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="font-semibold text-gray-900 text-sm mb-2">Communication Timeline</h3>
      <div className="flex items-center gap-2 text-red-600 text-sm"><AlertTriangle size={14} /> {loadError}</div>
    </div>
  );

  const toneClass = { blue: "bg-blue-100 text-blue-600", emerald: "bg-emerald-100 text-emerald-600", amber: "bg-amber-100 text-amber-600" };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="font-semibold text-gray-900 text-sm mb-4">Communication Timeline</h3>
      {events.length === 0 ? (
        <p className="text-sm text-gray-400">No activity yet</p>
      ) : (
        <div className="space-y-4">
          {events.map(e => {
            const Icon = e.icon;
            return (
              <div key={e.id} className="flex gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${toneClass[e.tone]}`}><Icon size={14} /></div>
                <div className="flex-1 pb-3 border-b border-gray-50 last:border-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-900">{e.title}</p>
                    {e.badge && <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{e.badge}</span>}
                  </div>
                  {e.text && <p className="text-sm text-gray-600 mt-0.5">{e.text}</p>}
                  <p className="text-[10px] text-gray-400 mt-1">{e.date ? new Date(e.date).toLocaleString() : ""}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}