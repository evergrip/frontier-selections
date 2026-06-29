import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { ChevronRight, CheckCircle, Clock, AlertCircle } from "lucide-react";
import StatusBadge from "@/components/ui/StatusBadge";

export default function CustomerDashboard() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const user = await base44.auth.me();
      const allProjects = await base44.entities.Project.list("-updated_date", 50);
      const myProjects = allProjects.filter(p =>
        (p.assigned_customers || []).includes(user.id) ||
        (p.assigned_customers || []).includes(user.email)
      );
      setProjects(myProjects.length > 0 ? myProjects : allProjects);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <div className="flex items-center justify-center h-96"><div className="w-8 h-8 border-4 border-gray-200 border-t-gray-800 rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Projects</h1>
        <p className="text-sm text-gray-500 mt-1">View and manage your selections</p>
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-gray-200">
          <p className="text-gray-400">No projects assigned to you yet.</p>
          <p className="text-sm text-gray-400 mt-1">Contact your project manager to get started.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {projects.map(project => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectCard({ project }) {
  const [areas, setAreas] = useState([]);
  const [requirements, setRequirements] = useState([]);

  useEffect(() => {
    Promise.all([
      base44.entities.ProjectArea.filter({ project_id: project.id }),
      base44.entities.SelectionRequirement.filter({ project_id: project.id })
    ]).then(([a, r]) => { setAreas(a); setRequirements(r); });
  }, [project.id]);

  const totalReqs = requirements.length;
  const completed = requirements.filter(r => ["Approved", "Locked", "Ready to Order", "Ordered", "Received", "Installed"].includes(r.status)).length;
  const pending = requirements.filter(r => r.status === "Submitted").length;
  const needsAttention = requirements.filter(r => ["Revision Requested", "Rejected"].includes(r.status)).length;
  const progress = totalReqs > 0 ? Math.round((completed / totalReqs) * 100) : 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">{project.name}</h2>
          <p className="text-sm text-gray-500">{project.address || project.project_type || ""}</p>
        </div>
        <StatusBadge status={project.status} />
      </div>

      {project.customer_notes && (
        <div className="bg-blue-50 rounded-xl p-3 text-sm text-blue-800 mb-4">{project.customer_notes}</div>
      )}

      <div className="mb-4">
        <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
          <span>Overall Progress</span>
          <span className="font-medium text-gray-900">{progress}%</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-5">
        <MiniStat icon={CheckCircle} value={completed} label="Approved" color="text-emerald-600" />
        <MiniStat icon={Clock} value={pending} label="Pending" color="text-amber-600" />
        <MiniStat icon={AlertCircle} value={needsAttention} label="Needs Action" color="text-red-600" />
      </div>

      <Link to={`/portal/project/${project.id}`} className="flex items-center justify-between bg-blue-50 hover:bg-blue-100 rounded-xl px-4 py-3 transition-colors mb-2">
        <div>
          <p className="font-medium text-gray-900 text-sm">Project Communication</p>
          <p className="text-xs text-gray-500">Ask questions & view timeline</p>
        </div>
        <ChevronRight size={16} className="text-gray-400" />
      </Link>

      <div className="space-y-2">
        {areas.sort((a, b) => (a.display_order || 0) - (b.display_order || 0)).map(area => {
          const areaReqs = requirements.filter(r => r.area_id === area.id);
          const areaCompleted = areaReqs.filter(r => ["Approved", "Locked", "Ready to Order", "Ordered", "Received", "Installed"].includes(r.status)).length;
          return (
            <Link
              key={area.id}
              to={`/portal/project/${project.id}/area/${area.id}`}
              className="flex items-center justify-between bg-gray-50 hover:bg-gray-100 rounded-xl px-4 py-3 transition-colors"
            >
              <div>
                <p className="font-medium text-gray-900 text-sm">{area.name}</p>
                <p className="text-xs text-gray-500">{areaCompleted}/{areaReqs.length} selections complete</p>
              </div>
              <ChevronRight size={16} className="text-gray-400" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function MiniStat({ icon: Icon, value, label, color }) {
  return (
    <div className="text-center">
      <div className={`flex items-center justify-center gap-1 ${color}`}>
        <Icon size={14} />
        <span className="text-lg font-bold">{value}</span>
      </div>
      <p className="text-[10px] text-gray-500">{label}</p>
    </div>
  );
}