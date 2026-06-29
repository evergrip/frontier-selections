import React from "react";
import { Link } from "react-router-dom";
import { AlertCircle, CheckCircle, Calendar } from "lucide-react";
import StatusBadge from "@/components/ui/StatusBadge";

const DONE = ["Approved", "Locked", "Ready to Order", "Ordered", "Received", "Installed"];

export default function SelectionCard({ requirement, selection, catalogueItem, projectId, areaId }) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const isOverdue = requirement.due_date && !DONE.includes(requirement.status) && new Date(requirement.due_date + "T00:00:00") < today;
  const needsAction = ["Revision Requested", "Rejected"].includes(requirement.status);
  const isApproved = DONE.includes(requirement.status);
  const thumbnail = catalogueItem?.default_image;

  return (
    <Link
      to={`/portal/project/${projectId}/area/${areaId}/selection/${requirement.id}`}
      className={`block bg-white rounded-2xl border overflow-hidden hover:shadow-md transition-all ${
        needsAction ? "border-amber-300" : isOverdue ? "border-red-200" : "border-gray-200"
      }`}
    >
      <div className="aspect-[4/3] bg-gray-100 relative">
        {thumbnail ? (
          <img src={thumbnail} alt={requirement.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
            <span className="text-4xl font-bold text-gray-200">{requirement.name.charAt(0)}</span>
          </div>
        )}
        <div className="absolute top-2 left-2">
          {requirement.is_required ? (
            <span className="text-[10px] bg-gray-900 text-white px-2 py-0.5 rounded-full font-medium">Required</span>
          ) : (
            <span className="text-[10px] bg-white/90 text-gray-600 px-2 py-0.5 rounded-full font-medium">Optional</span>
          )}
        </div>
        {isApproved && (
          <div className="absolute top-2 right-2 w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center shadow-sm">
            <CheckCircle size={14} className="text-white" />
          </div>
        )}
        {isOverdue && (
          <div className="absolute bottom-2 right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center shadow-sm">
            <AlertCircle size={14} className="text-white" />
          </div>
        )}
      </div>
      <div className="p-3">
        <h3 className="font-semibold text-gray-900 text-sm truncate">{requirement.name}</h3>
        <p className="text-xs text-gray-400 mb-2">{requirement.category}</p>
        <div className="flex items-center justify-between gap-2">
          <StatusBadge status={requirement.status} />
          {isOverdue ? (
            <span className="inline-flex items-center gap-1 text-[10px] text-red-600 font-medium shrink-0">
              <AlertCircle size={10} /> Overdue
            </span>
          ) : requirement.due_date ? (
            <span className="inline-flex items-center gap-1 text-[10px] text-gray-400 shrink-0">
              <Calendar size={10} /> {requirement.due_date}
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}