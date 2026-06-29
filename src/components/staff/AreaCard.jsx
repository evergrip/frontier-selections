import React from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import StatusBadge from "@/components/ui/StatusBadge";

export default function AreaCard({ area, requirements, selections, projectId }) {
  const totalReqs = requirements.length;
  const completed = requirements.filter(r =>
    ["Approved", "Locked", "Ready to Order", "Ordered", "Received", "Installed"].includes(r.status)
  ).length;
  const pending = selections.filter(s => s.status === "Pending").length;
  const progress = totalReqs > 0 ? Math.round((completed / totalReqs) * 100) : 0;

  return (
    <Link
      to={`/projects/${projectId}/area/${area.id}`}
      className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow group"
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-gray-900 group-hover:text-gray-700">{area.name}</h3>
          <p className="text-xs text-gray-500 mt-0.5">{area.area_type}</p>
        </div>
        <ChevronRight size={18} className="text-gray-300 group-hover:text-gray-500 mt-1" />
      </div>

      <div className="mb-3">
        <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
          <span>{completed}/{totalReqs} selections complete</span>
          <span>{progress}%</span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="flex items-center gap-3 text-xs">
        <StatusBadge status={area.status} />
        {pending > 0 && (
          <span className="text-amber-600 font-medium">{pending} pending</span>
        )}
        {area.allowance > 0 && (
          <span className="text-gray-400">${area.allowance.toLocaleString()} allowance</span>
        )}
      </div>
    </Link>
  );
}