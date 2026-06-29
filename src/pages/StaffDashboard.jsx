import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { FolderKanban, Package, Clock, AlertTriangle, CheckCircle, ArrowRight } from "lucide-react";
import StatusBadge from "@/components/ui/StatusBadge";

export default function StaffDashboard() {
  const [projects, setProjects] = useState([]);
  const [recentSelections, setRecentSelections] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [p, s] = await Promise.all([
          base44.entities.Project.list("-updated_date", 50),
          base44.entities.CustomerSelection.filter({ status: "Pending" }, "-created_date", 10)
        ]);
        setProjects(p);
        setRecentSelections(s);
      } catch (e) { console.error(e); }
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center h-96"><div className="w-8 h-8 border-4 border-gray-200 border-t-gray-800 rounded-full animate-spin" /></div>;
  }

  const activeProjects = projects.filter(p => !["Completed", "Archived", "Draft"].includes(p.status));
  const pendingCount = recentSelections.length;
  const completedProjects = projects.filter(p => p.status === "Completed").length;

  return (
    <div className="p-6 lg:p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Frontier Building Group — Selections Overview</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={FolderKanban} label="Active Projects" value={activeProjects.length} color="bg-blue-50 text-blue-600" />
        <StatCard icon={Clock} label="Pending Approvals" value={pendingCount} color="bg-amber-50 text-amber-600" />
        <StatCard icon={Package} label="Total Projects" value={projects.length} color="bg-gray-50 text-gray-600" />
        <StatCard icon={CheckCircle} label="Completed" value={completedProjects} color="bg-emerald-50 text-emerald-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Active Projects</h2>
            <Link to="/projects" className="text-sm text-gray-500 hover:text-gray-900 flex items-center gap-1">
              View all <ArrowRight size={14} />
            </Link>
          </div>
          {activeProjects.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-gray-400">No active projects</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {activeProjects.slice(0, 8).map(p => (
                <Link key={p.id} to={`/projects/${p.id}`} className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{p.name}</p>
                    <p className="text-xs text-gray-500">{p.client_name || "No client"}</p>
                  </div>
                  <StatusBadge status={p.status} />
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Pending Approvals</h2>
          </div>
          {recentSelections.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-gray-400">No pending selections</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {recentSelections.map(s => (
                <Link key={s.id} to={`/projects/${s.project_id}`} className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Selection Submitted</p>
                    <p className="text-xs text-gray-500">Needs review</p>
                  </div>
                  <StatusBadge status="Submitted" />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
          <Icon size={18} />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-xs text-gray-500">{label}</p>
        </div>
      </div>
    </div>
  );
}