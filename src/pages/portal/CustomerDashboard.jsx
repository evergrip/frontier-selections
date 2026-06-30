import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { ChevronRight, CheckCircle, Clock, AlertCircle, ArrowRight, Wallet, AlertTriangle } from "lucide-react";
import StatusBadge from "@/components/ui/StatusBadge";
import AreaCard from "@/components/portal/AreaCard";

const DONE = ["Approved", "Locked", "Ready to Order", "Ordered", "Received", "Installed"];

export default function CustomerDashboard() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        // Link user to any pending invitations
        base44.functions.invoke("customerInvitations", { action: "linkUser" }).catch(() => {});
        const res = await base44.functions.invoke("customerPortal", { action: "list_my_projects" });
        if (res.data?.error) throw new Error(res.data.error);
        setProjects(res.data?.projects || []);
      } catch (err) {
        setLoadError(err.message || "Failed to load projects");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <div className="flex items-center justify-center h-96"><div className="w-8 h-8 border-4 border-gray-200 border-t-gray-800 rounded-full animate-spin" /></div>;
  if (loadError) return (
    <div className="p-8 text-center">
      <AlertTriangle size={32} className="mx-auto text-red-400 mb-2" />
      <p className="text-red-600 text-sm font-medium">Failed to load projects</p>
      <p className="text-gray-400 text-xs mt-1">{loadError}</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Projects</h1>
        <p className="text-sm text-gray-500 mt-1">Track your selections and stay on schedule</p>
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-gray-200">
          <p className="text-gray-400">No projects assigned to you yet.</p>
          <p className="text-sm text-gray-400 mt-1">Contact your project manager to get started.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {projects.map(project => <ProjectCard key={project.id} project={project} />)}
        </div>
      )}
    </div>
  );
}

function ProjectCard({ project }) {
  const [areas, setAreas] = useState([]);
  const [requirements, setRequirements] = useState([]);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await base44.functions.invoke("customerPortal", { action: "get_project_dashboard", project_id: project.id });
        if (res.data?.error) throw new Error(res.data.error);
        setAreas(res.data?.areas || []);
        setRequirements(res.data?.requirements || []);
      } catch (err) {
        setLoadError(err.message);
      }
    })();
  }, [project.id]);

  if (loadError) return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <h2 className="text-lg font-bold text-gray-900 truncate mb-2">{project.name}</h2>
      <div className="flex items-center gap-2 text-red-600 text-sm"><AlertTriangle size={14} /> Failed to load project data</div>
    </div>
  );

  const totalReqs = requirements.length;
  const completed = requirements.filter(r => DONE.includes(r.status)).length;
  const pending = requirements.filter(r => r.status === "Submitted").length;
  const needsAttention = requirements.filter(r => ["Revision Requested", "Rejected"].includes(r.status)).length;
  const progress = totalReqs > 0 ? Math.round((completed / totalReqs) * 100) : 0;

  const nextSelection = requirements
    .filter(r => !DONE.includes(r.status))
    .sort((a, b) => (a.due_date || "9999") > (b.due_date || "9999") ? 1 : -1)[0];

  const showAllowance = project.pricing_visibility && project.pricing_visibility !== "hidden";
  const sortedAreas = [...areas].sort((a, b) => (a.display_order || 0) - (b.display_order || 0));

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6">
      <div className="flex items-start justify-between mb-4 gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-gray-900 truncate">{project.name}</h2>
          <p className="text-sm text-gray-500 truncate">{project.address || project.project_type || ""}</p>
        </div>
        <StatusBadge status={project.status} />
      </div>

      {project.customer_notes && (
        <div className="bg-blue-50 rounded-xl p-3 text-sm text-blue-800 mb-4">{project.customer_notes}</div>
      )}

      <div className="mb-4">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-gray-500">Overall Progress</span>
          <span className="font-bold text-gray-900">{progress}%</span>
        </div>
        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-5">
        <MiniStat icon={CheckCircle} value={completed} label="Approved" color="text-emerald-600" bg="bg-emerald-50" />
        <MiniStat icon={Clock} value={pending} label="Pending" color="text-amber-600" bg="bg-amber-50" />
        <MiniStat icon={AlertCircle} value={needsAttention} label="Action Needed" color="text-red-600" bg="bg-red-50" />
      </div>

      {nextSelection && (
        <Link
          to={`/portal/project/${project.id}/area/${nextSelection.area_id}/selection/${nextSelection.id}`}
          className="flex items-center gap-3 bg-gradient-to-r from-gray-900 to-gray-800 text-white rounded-xl p-4 mb-4 hover:from-gray-800 hover:to-gray-700 transition-all"
        >
          <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center shrink-0">
            <ArrowRight size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-300">Next Selection to Complete</p>
            <p className="font-semibold text-sm truncate">{nextSelection.name}</p>
          </div>
          {nextSelection.due_date && (
            <div className="text-right shrink-0">
              <p className="text-[10px] text-gray-300">Due</p>
              <p className="text-xs font-medium">{nextSelection.due_date}</p>
            </div>
          )}
        </Link>
      )}

      {showAllowance && project.total_allowance > 0 && (
        <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-3 mb-4">
          <div className="w-9 h-9 bg-gray-900 rounded-lg flex items-center justify-center shrink-0">
            <Wallet size={16} className="text-white" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Total Allowance</p>
            <p className="font-bold text-gray-900">${project.total_allowance.toLocaleString()}</p>
          </div>
        </div>
      )}

      <Link to={`/portal/project/${project.id}`} className="flex items-center justify-between bg-blue-50 hover:bg-blue-100 rounded-xl px-4 py-3 transition-colors mb-4">
        <div>
          <p className="font-medium text-gray-900 text-sm">Project Communication</p>
          <p className="text-xs text-gray-500">Ask questions & view timeline</p>
        </div>
        <ChevronRight size={16} className="text-gray-400" />
      </Link>

      {sortedAreas.length > 0 && (
        <div>
          <h3 className="font-semibold text-gray-900 text-sm mb-3">Rooms & Areas</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {sortedAreas.map(area => <AreaCard key={area.id} area={area} requirements={requirements} projectId={project.id} />)}
          </div>
        </div>
      )}
    </div>
  );
}

function MiniStat({ icon: Icon, value, label, color, bg }) {
  return (
    <div className={`rounded-xl p-3 text-center ${bg}`}>
      <div className={`flex items-center justify-center gap-1 ${color} mb-0.5`}>
        <Icon size={14} />
        <span className="text-lg font-bold">{value}</span>
      </div>
      <p className="text-[10px] text-gray-500">{label}</p>
    </div>
  );
}