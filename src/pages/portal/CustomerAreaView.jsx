import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, CheckCircle, Clock, AlertCircle, ChevronRight } from "lucide-react";
import StatusBadge from "@/components/ui/StatusBadge";

export default function CustomerAreaView() {
  const { projectId, areaId } = useParams();
  const [area, setArea] = useState(null);
  const [requirements, setRequirements] = useState([]);
  const [selections, setSelections] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [a, r, s] = await Promise.all([
        base44.entities.ProjectArea.get(areaId),
        base44.entities.SelectionRequirement.filter({ area_id: areaId }),
        base44.entities.CustomerSelection.filter({ area_id: areaId })
      ]);
      setArea(a);
      setRequirements(r);
      setSelections(s.filter(sel => sel.is_current));
      setLoading(false);
    }
    load();
  }, [areaId]);

  if (loading) return <div className="flex items-center justify-center h-96"><div className="w-8 h-8 border-4 border-gray-200 border-t-gray-800 rounded-full animate-spin" /></div>;
  if (!area) return <div className="text-center py-20 text-gray-400">Area not found</div>;

  const completed = requirements.filter(r => ["Approved", "Locked", "Ready to Order", "Ordered", "Received", "Installed"].includes(r.status)).length;
  const progress = requirements.length > 0 ? Math.round((completed / requirements.length) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/portal" className="p-2 rounded-lg hover:bg-gray-100"><ArrowLeft size={18} /></Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{area.name}</h1>
          <p className="text-sm text-gray-500">{area.area_type}</p>
        </div>
      </div>

      {area.customer_notes && (
        <div className="bg-blue-50 rounded-xl p-4 text-sm text-blue-800">{area.customer_notes}</div>
      )}

      <div>
        <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
          <span>Progress</span>
          <span className="font-medium text-gray-900">{completed}/{requirements.length} complete</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="space-y-3">
        {requirements.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">No selections required for this area yet</div>
        ) : (
          <>
            <h2 className="font-semibold text-gray-900 text-sm">Selections</h2>
            {requirements.map(req => {
              const sel = selections.find(s => s.requirement_id === req.id);
              const needsAction = ["Revision Requested", "Rejected"].includes(req.status);
              return (
                <Link
                  key={req.id}
                  to={`/portal/project/${projectId}/area/${areaId}/selection/${req.id}`}
                  className={`flex items-center gap-4 bg-white rounded-xl border p-4 hover:shadow-md transition-shadow ${needsAction ? "border-amber-200" : "border-gray-200"}`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                    ["Approved", "Locked"].includes(req.status) ? "bg-emerald-100 text-emerald-600" :
                    needsAction ? "bg-amber-100 text-amber-600" :
                    req.status === "Submitted" ? "bg-blue-100 text-blue-600" :
                    "bg-gray-100 text-gray-400"
                  }`}>
                    {["Approved", "Locked"].includes(req.status) ? <CheckCircle size={18} /> :
                     req.status === "Submitted" ? <Clock size={18} /> :
                     needsAction ? <AlertCircle size={18} /> :
                     <span className="text-xs font-bold">{req.name.charAt(0)}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900 text-sm">{req.name}</p>
                      {req.is_required && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-medium">REQUIRED</span>}
                    </div>
                    <p className="text-xs text-gray-500">{req.category}{req.due_date ? ` • Due: ${req.due_date}` : ""}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <StatusBadge status={req.status} />
                    <ChevronRight size={16} className="text-gray-300" />
                  </div>
                </Link>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}