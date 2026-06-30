import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Lightbulb } from "lucide-react";

export default function NextActionPanel({ actions, title = "Next Actions" }) {
  if (!actions || actions.length === 0) return null;

  const rank = { urgent: 1, high: 2, medium: 3, low: 4 };
  const sorted = [...actions].sort((a, b) => (rank[a.priority] || 99) - (rank[b.priority] || 99));
  const top = sorted[0];
  const rest = sorted.slice(1, 4);

  const priorityStyles = {
    urgent: "border-red-200 bg-red-50",
    high: "border-amber-200 bg-amber-50",
    medium: "border-blue-200 bg-blue-50",
    low: "border-gray-200 bg-gray-50"
  };
  const priorityText = {
    urgent: "text-red-700",
    high: "text-amber-700",
    medium: "text-blue-700",
    low: "text-gray-700"
  };
  const style = priorityStyles[top.priority || "low"] || priorityStyles.low;
  const textStyle = priorityText[top.priority || "low"] || priorityText.low;

  return (
    <div className="space-y-2">
      {title && (
        <div className="flex items-center gap-1.5">
          <Lightbulb size={14} className="text-amber-500" />
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{title}</h3>
        </div>
      )}
      <div className={`rounded-xl border ${style} p-4 flex items-center justify-between gap-3`}>
        <div className="min-w-0">
          <p className={`text-sm font-medium ${textStyle}`}>{top.label}</p>
          {top.description && <p className="text-xs text-gray-500 mt-0.5">{top.description}</p>}
        </div>
        {top.to && (
          <Link to={top.to} onClick={top.onClick} className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-xs font-medium text-gray-700 hover:bg-gray-50 whitespace-nowrap">
            {top.buttonLabel || "Go"} <ArrowRight size={12} />
          </Link>
        )}
        {!top.to && top.onClick && (
          <button onClick={top.onClick} disabled={top.disabled} className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 whitespace-nowrap">
            {top.buttonLabel || "Go"} <ArrowRight size={12} />
          </button>
        )}
      </div>
      {rest.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {rest.map((a, i) => (
            <Link key={i} to={a.to || "#"} onClick={a.onClick} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-gray-200 text-xs text-gray-600 hover:bg-gray-50">
              {a.label} <ArrowRight size={10} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}