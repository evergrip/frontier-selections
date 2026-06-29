import React from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Calendar, AlertCircle } from "lucide-react";

const DONE = ["Approved", "Locked", "Ready to Order", "Ordered", "Received", "Installed"];

export default function AreaCard({ area, requirements, projectId }) {
  const areaReqs = requirements.filter(r => r.area_id === area.id);
  const completed = areaReqs.filter(r => DONE.includes(r.status)).length;
  const total = areaReqs.length;
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
  const needsAction = areaReqs.filter(r => ["Revision Requested", "Rejected"].includes(r.status)).length;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const isOverdue = area.due_date && area.status !== "Complete" && new Date(area.due_date + "T00:00:00") < today;

  return (
    <Link
      to={`/portal/project/${projectId}/area/${area.id}`}
      className="block bg-white rounded-2xl border border-gray-200 p-4 hover:shadow-md hover:border-gray-300 transition-all"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-gray-900 text-sm truncate">{area.name}</h3>
          <p className="text-xs text-gray-400">{area.area_type}</p>
        </div>
        <ChevronRight size={16} className="text-gray-300 shrink-0" />
      </div>
      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
        <span className="text-xs font-medium text-gray-500 shrink-0">{completed}/{total}</span>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        {isOverdue && (
          <span className="inline-flex items-center gap-1 text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">
            <AlertCircle size={10} /> Overdue
          </span>
        )}
        {needsAction > 0 && (
          <span className="text-[10px] bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full font-medium">
            {needsAction} need{needsAction > 1 ? "s" : ""} action
          </span>
        )}
        {area.due_date && !isOverdue && (
          <span className="inline-flex items-center gap-1 text-[10px] text-gray-400">
            <Calendar size={10} /> {area.due_date}
          </span>
        )}
      </div>
    </Link>
  );
}