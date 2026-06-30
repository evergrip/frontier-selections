import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, AlertCircle, AlertTriangle } from "lucide-react";
import SelectionCard from "@/components/portal/SelectionCard";
import { useProjectAccess } from "@/hooks/useProjectAccess";

const DONE = ["Approved", "Locked", "Ready to Order", "Ordered", "Received", "Installed"];

export default function CustomerAreaView() {
  const { projectId, areaId } = useParams();
  const [area, setArea] = useState(null);
  const [requirements, setRequirements] = useState([]);
  const [selections, setSelections] = useState([]);
  const [catalogueItems, setCatalogueItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const { loading: accessLoading, hasAccess } = useProjectAccess(projectId);

  useEffect(() => {
    if (accessLoading || !hasAccess) return;
    async function load() {
      try {
        const res = await base44.functions.invoke("customerPortal", {
          action: "get_project_area", project_id: projectId, area_id: areaId
        });
        const data = res.data;
        if (data?.error) throw new Error(data.error);
        setArea(data.area);
        setRequirements(data.requirements || []);
        setSelections(data.selections || []);
        setCatalogueItems(data.catalogueItems || []);
      } catch (err) {
        setLoadError(err.message || "Failed to load area data");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [areaId, projectId, accessLoading, hasAccess]);

  if (loading || accessLoading) return <div className="flex items-center justify-center h-96"><div className="w-8 h-8 border-4 border-gray-200 border-t-gray-800 rounded-full animate-spin" /></div>;
  if (!hasAccess) return <div className="p-8 text-center text-gray-400">You don't have access to this project.</div>;
  if (loadError) return (
    <div className="p-8 text-center">
      <AlertTriangle size={32} className="mx-auto text-red-400 mb-2" />
      <p className="text-red-600 text-sm font-medium">Failed to load area</p>
      <p className="text-gray-400 text-xs mt-1">{loadError}</p>
    </div>
  );
  if (!area) return <div className="text-center py-20 text-gray-400">Area not found</div>;

  const completed = requirements.filter(r => DONE.includes(r.status)).length;
  const progress = requirements.length > 0 ? Math.round((completed / requirements.length) * 100) : 0;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const overdueCount = requirements.filter(r => r.due_date && !DONE.includes(r.status) && new Date(r.due_date + "T00:00:00") < today).length;
  const sortedReqs = [...requirements].sort((a, b) => {
    if (a.is_required !== b.is_required) return a.is_required ? -1 : 1;
    if (a.due_date && b.due_date) return a.due_date > b.due_date ? 1 : -1;
    if (a.due_date) return -1;
    if (b.due_date) return 1;
    return a.name > b.name ? 1 : -1;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to={`/portal/project/${projectId}`} className="p-2 rounded-lg hover:bg-gray-100"><ArrowLeft size={18} /></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{area.name}</h1>
          <p className="text-sm text-gray-500">{area.area_type}</p>
        </div>
      </div>

      {area.customer_notes && (
        <div className="bg-blue-50 rounded-xl p-4 text-sm text-blue-800">{area.customer_notes}</div>
      )}

      {overdueCount > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 flex items-center gap-2">
          <AlertCircle size={16} /> {overdueCount} selection{overdueCount > 1 ? "s" : ""} overdue in this area
        </div>
      )}

      <div>
        <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
          <span>Progress</span>
          <span className="font-medium text-gray-900">{completed}/{requirements.length} complete</span>
        </div>
        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {requirements.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm bg-white rounded-2xl border border-gray-200">No selections required for this area yet</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedReqs.map(req => {
            const sel = selections.find(s => s.requirement_id === req.id);
            const item = sel ? catalogueItems.find(i => i.id === sel.catalogue_item_id) : null;
            return <SelectionCard key={req.id} requirement={req} selection={sel} catalogueItem={item} projectId={projectId} areaId={areaId} />;
          })}
        </div>
      )}
    </div>
  );
}