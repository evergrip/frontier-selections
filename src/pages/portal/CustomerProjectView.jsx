import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, AlertCircle, CheckCircle, MessageSquare, Package, ArrowRight, AlertTriangle } from "lucide-react";
import StatusBadge from "@/components/ui/StatusBadge";
import CommentThread from "@/components/comments/CommentThread";
import ProjectTimeline from "@/components/comments/ProjectTimeline";
import { useProjectAccess } from "@/hooks/useProjectAccess";
import { useCustomerPortal } from "@/components/CustomerPortalContext";

const DONE = ["Approved", "Locked", "Ready to Order", "Ordered", "Received", "Installed"];

export default function CustomerProjectView() {
  const { projectId } = useParams();
  const [project, setProject] = useState(null);
  const [areas, setAreas] = useState([]);
  const [requirements, setRequirements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const { loading: accessLoading, hasAccess } = useProjectAccess(projectId);
  const { isPreviewMode } = useCustomerPortal();

  useEffect(() => {
    if (accessLoading || !hasAccess) return;
    async function load() {
      try {
        const res = await base44.functions.invoke("customerPortal", { action: "get_project_dashboard", project_id: projectId });
        const data = res.data;
        if (data?.error) throw new Error(data.error);
        setProject(data.project);
        setAreas(data.areas || []);
        setRequirements(data.requirements || []);
      } catch (err) {
        setLoadError(err.message || "Failed to load project data");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [projectId, accessLoading, hasAccess]);

  const reqByArea = useMemo(() => {
    const map = {};
    areas.forEach(area => { map[area.id] = requirements.filter(r => r.area_id === area.id); });
    return map;
  }, [areas, requirements]);

  const overdue = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return requirements.filter(r => r.due_date && !DONE.includes(r.status) && new Date(r.due_date + "T00:00:00") < today);
  }, [requirements]);

  const revisionRequested = useMemo(() => {
    return requirements.filter(r => ["Revision Requested", "Rejected"].includes(r.status));
  }, [requirements]);

  const approved = useMemo(() => {
    return requirements.filter(r => DONE.includes(r.status));
  }, [requirements]);

  const nextStep = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const notDone = requirements.filter(r => !DONE.includes(r.status));
    if (notDone.length === 0) return null;
    const revision = notDone.find(r => ["Revision Requested", "Rejected"].includes(r.status));
    if (revision) return { req: revision, type: "revision", label: "Needs your review" };
    const overdueItem = notDone.find(r => r.due_date && new Date(r.due_date + "T00:00:00") < today);
    if (overdueItem) return { req: overdueItem, type: "overdue", label: "Overdue" };
    const withDueDate = notDone.filter(r => r.due_date).sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
    if (withDueDate.length > 0) return { req: withDueDate[0], type: "upcoming", label: "Up next" };
    const required = notDone.find(r => r.is_required);
    if (required) return { req: required, type: "required", label: "Required choice" };
    return { req: notDone[0], type: "optional", label: "Optional choice" };
  }, [requirements]);

  if (loading || accessLoading) return <div className="flex items-center justify-center h-96"><div className="w-8 h-8 border-4 border-gray-200 border-t-gray-800 rounded-full animate-spin" /></div>;
  if (!hasAccess) return <div className="p-8 text-center text-gray-400">You don't have access to this project.</div>;
  if (loadError) return (
    <div className="p-8 text-center">
      <AlertTriangle size={32} className="mx-auto text-red-400 mb-2" />
      <p className="text-red-600 text-sm font-medium">Failed to load project</p>
      <p className="text-gray-400 text-xs mt-1">{loadError}</p>
    </div>
  );
  if (!project) return <div className="p-8 text-center text-gray-400">Project not found</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/portal" className="p-2 rounded-lg hover:bg-gray-100"><ArrowLeft size={18} /></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
          <p className="text-sm text-gray-500">{project.address || project.project_type}</p>
        </div>
        <StatusBadge status={project.status} />
      </div>

      {project.customer_notes && (
        <div className="bg-blue-50 rounded-xl p-4 text-sm text-blue-800">{project.customer_notes}</div>
      )}

      {nextStep && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">Next Step</p>
              <h3 className="font-bold text-gray-900 text-lg">{nextStep.req.name}</h3>
              <p className="text-sm text-gray-600 mt-1">
                {nextStep.req.area_id && areas.find(a => a.id === nextStep.req.area_id)?.name} • {nextStep.label}
              </p>
              {nextStep.req.due_date && (
                <p className="text-xs text-gray-500 mt-2">Due: {new Date(nextStep.req.due_date).toLocaleDateString()}</p>
              )}
            </div>
            <Link to={`/portal/project/${projectId}/area/${nextStep.req.area_id}/selection/${nextStep.req.id}`} className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
              Make this choice <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={AlertCircle} label="Overdue" value={overdue.length} sub="Needs attention" color="red" />
        <StatCard icon={AlertCircle} label="Action Needed" value={revisionRequested.length} sub="Review required" color="amber" />
        <StatCard icon={Package} label="In Progress" value={requirements.filter(r => ["Submitted", "In Progress", "Viewed"].includes(r.status)).length} sub="Being reviewed" color="blue" />
        <StatCard icon={CheckCircle} label="Approved" value={approved.length} sub="Ready to order" color="emerald" />
      </div>

      {(overdue.length > 0 || revisionRequested.length > 0) && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2"><AlertCircle size={18} className="text-red-500" /> Needs Your Attention</h2>
          <div className="space-y-2">
            {overdue.map(r => (
              <Link key={r.id} to={`/portal/project/${projectId}/area/${r.area_id}/selection/${r.id}`} className="block p-3 rounded-lg bg-red-50 hover:bg-red-100 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-red-800 text-sm">{r.name}</span>
                  <span className="text-xs text-red-600">Due {r.due_date}</span>
                </div>
              </Link>
            ))}
            {revisionRequested.map(r => (
              <Link key={r.id} to={`/portal/project/${projectId}/area/${r.area_id}/selection/${r.id}`} className="block p-3 rounded-lg bg-amber-50 hover:bg-amber-100 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-amber-800 text-sm">{r.name}</span>
                  <span className="text-xs text-amber-600">Action needed</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-900 mb-4">Rooms & Areas</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {areas.map(area => {
            const areaReqs = reqByArea[area.id] || [];
            const areaCompleted = areaReqs.filter(r => DONE.includes(r.status)).length;
            const areaProgress = areaReqs.length > 0 ? Math.round((areaCompleted / areaReqs.length) * 100) : 0;
            return (
              <Link key={area.id} to={`/portal/project/${projectId}/area/${area.id}`} className="block p-4 rounded-xl border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-gray-900 text-sm">{area.name}</h3>
                  <span className="text-xs text-gray-500">{area.area_type}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${areaProgress}%` }} />
                </div>
                <p className="text-xs text-gray-500 mt-1">{areaCompleted}/{areaReqs.length} complete</p>
              </Link>
            );
          })}
        </div>
      </div>

      <Link to={`/portal/project/${projectId}/final-package`} className="block bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">Final Selections Package</h3>
            <p className="text-sm text-gray-500 mt-0.5">View all your approved selections</p>
          </div>
          <span className="text-sm text-blue-600">View →</span>
        </div>
      </Link>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2"><MessageSquare size={18} className="text-gray-500" /> Project Messages</h2>
        <CommentThread projectId={projectId} targetType="project" targetId={projectId} staff={false} title="" readOnly={isPreviewMode} />
      </div>

      <ProjectTimeline projectId={projectId} staff={false} />
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, color = "blue" }) {
  const colors = {
    blue: "text-blue-700",
    red: "text-red-700",
    green: "text-emerald-700",
    amber: "text-amber-700",
    emerald: "text-emerald-700"
  };
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={18} className={colors[color]} />
        <span className="text-xs text-gray-500">{label}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className={`text-xs mt-1 ${colors[color]}`}>{sub}</p>
    </div>
  );
}