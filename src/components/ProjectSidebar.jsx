import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Link, useLocation } from "react-router-dom";
import { ChevronDown, ChevronRight, Search, Filter, AlertTriangle, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { hasPermission, PROJECT_STATUSES } from "@/lib/constants";

const STATUS_GROUPS = [
  { value: "Draft", label: "Draft", color: "border-gray-300" },
  { value: "Active", label: "Active Projects", color: "border-emerald-500" },
  { value: "Waiting on Customer", label: "Waiting on Customer", color: "border-amber-500" },
  { value: "Waiting on Staff", label: "Waiting on Staff", color: "border-blue-500" },
  { value: "Selections Complete", label: "Selections Complete", color: "border-purple-500" },
  { value: "In Construction", label: "In Construction", color: "border-orange-500" },
  { value: "Completed", label: "Completed", color: "border-green-500" },
  { value: "Archived", label: "Archived", color: "border-gray-400" }
];

export default function ProjectSidebar({ selectedProject, onProjectSelect, collapsed, user }) {
  const location = useLocation();
  const [projects, setProjects] = useState([]);
  const [requirements, setRequirements] = useState([]);
  const [selections, setSelections] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedGroups, setExpandedGroups] = useState(["Active", "Waiting on Customer", "Waiting on Staff"]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProjects();
  }, []);

  async function loadProjects() {
    setLoading(true);
    try {
      const [proj, req, sel] = await Promise.all([
        base44.entities.Project.list("-updated_date", 200),
        base44.entities.SelectionRequirement.list(null, 1000),
        base44.entities.CustomerSelection.list(null, 1000)
      ]);
      setProjects(proj);
      setRequirements(req);
      setSelections(sel);
    } catch (e) {
      console.error("Failed to load projects", e);
    }
    setLoading(false);
  }

  const projectStats = useMemo(() => {
    const stats = {};
    projects.forEach(p => {
      const projReqs = requirements.filter(r => r.project_id === p.id);
      const projSels = selections.filter(s => s.project_id === p.id && s.is_current);
      
      const completed = projReqs.filter(r => {
        const sel = projSels.find(s => s.requirement_id === r.id);
        return sel && ["Approved", "Locked", "Ready to Order", "Ordered", "Received", "Installed"].includes(sel.status);
      }).length;
      
      const pending = projReqs.filter(r => {
        const sel = projSels.find(s => s.requirement_id === r.id);
        return sel && ["Submitted", "In Progress", "Viewed"].includes(sel.status);
      }).length;
      
      const overdue = projReqs.filter(r => {
        if (!r.due_date) return false;
        const sel = projSels.find(s => s.requirement_id === r.id);
        if (sel && ["Approved", "Locked", "Ready to Order", "Ordered", "Received", "Installed"].includes(sel.status)) return false;
        return new Date(r.due_date) < new Date();
      }).length;

      const pendingStaff = projReqs.filter(r => {
        const sel = projSels.find(s => s.requirement_id === r.id);
        return sel && sel.status === "Submitted";
      }).length;

      stats[p.id] = {
        total: projReqs.length,
        completed,
        pending,
        overdue,
        pendingStaff,
        percent: projReqs.length > 0 ? Math.round((completed / projReqs.length) * 100) : 0
      };
    });
    return stats;
  }, [projects, requirements, selections]);

  const filteredProjects = useMemo(() => {
    let filtered = projects;
    
    // Filter by search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(q) || 
        (p.client_name && p.client_name.toLowerCase().includes(q))
      );
    }

    // Filter by permissions
    if (!hasPermission(user, "view_all_projects")) {
      // For now, show all - actual filtering would need assigned_projects logic
    }

    return filtered;
  }, [projects, searchQuery, user]);

  const groupedProjects = useMemo(() => {
    const groups = {};
    STATUS_GROUPS.forEach(g => groups[g.value] = []);
    
    filteredProjects.forEach(p => {
      const status = p.status || "Draft";
      if (groups[status]) {
        groups[status].push(p);
      }
    });

    // Sort each group
    Object.keys(groups).forEach(status => {
      groups[status].sort((a, b) => {
        const aStats = projectStats[a.id] || {};
        const bStats = projectStats[b.id] || {};
        // Priority: overdue > pending staff > recently updated
        if (aStats.overdue !== bStats.overdue) return bStats.overdue - aStats.overdue;
        if (aStats.pendingStaff !== bStats.pendingStaff) return bStats.pendingStaff - aStats.pendingStaff;
        return new Date(b.updated_date || 0) - new Date(a.updated_date || 0);
      });
    });

    return groups;
  }, [filteredProjects, projectStats]);

  const toggleGroup = (status) => {
    setExpandedGroups(prev => 
      prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
    );
  };

  if (loading) {
    return (
      <div className={`h-full bg-white border-r border-gray-200 ${collapsed ? "w-16" : "w-72"} transition-all duration-200`}>
        <div className="p-4">
          <div className="animate-pulse space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-12 bg-gray-100 rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-full bg-white border-r border-gray-200 flex flex-col ${collapsed ? "w-16" : "w-72"} transition-all duration-200`}>
      {!collapsed && (
        <div className="p-3 border-b border-gray-100">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-9 text-sm"
            />
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto py-2">
        {STATUS_GROUPS.map(group => {
          const groupProjects = groupedProjects[group.value] || [];
          if (groupProjects.length === 0) return null;
          
          const isExpanded = expandedGroups.includes(group.value);
          
          return (
            <div key={group.value} className="mb-1">
              <button
                onClick={() => toggleGroup(group.value)}
                className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 uppercase tracking-wide"
              >
                <div className="flex items-center gap-2">
                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <span className={`border-l-2 pl-2 ${group.color}`}>{group.label}</span>
                  <span className="text-gray-400">({groupProjects.length})</span>
                </div>
              </button>
              
              {isExpanded && (
                <div className="space-y-0.5 px-2 pb-2">
                  {groupProjects.map(project => {
                    const stats = projectStats[project.id] || {};
                    const isActive = selectedProject?.id === project.id;
                    
                    return (
                      <Link
                        key={project.id}
                        to={`/projects/${project.id}`}
                        onClick={(e) => {
                          e.preventDefault();
                          onProjectSelect(project);
                        }}
                        className={`
                          block p-2.5 rounded-lg text-sm transition-all
                          ${isActive 
                            ? "bg-gray-900 text-white" 
                            : "hover:bg-gray-100 text-gray-700"
                          }
                        `}
                      >
                        <div className="font-medium truncate">{project.name}</div>
                        <div className={`text-xs truncate ${isActive ? "text-gray-300" : "text-gray-500"}`}>
                          {project.client_name || "No client"}
                        </div>
                        <div className="flex items-center gap-2 mt-1.5 text-xs">
                          <span className={isActive ? "text-gray-300" : "text-gray-400"}>
                            {stats.percent || 0}%
                          </span>
                          {stats.overdue > 0 && (
                            <span className="flex items-center gap-0.5 text-red-500" title={`${stats.overdue} overdue`}>
                              <AlertTriangle size={12} />
                              {stats.overdue}
                            </span>
                          )}
                          {stats.pendingStaff > 0 && (
                            <span className="flex items-center gap-0.5 text-blue-500" title={`${stats.pendingStaff} pending staff review`}>
                              <Clock size={12} />
                              {stats.pendingStaff}
                            </span>
                          )}
                          {stats.percent === 100 && stats.total > 0 && (
                            <span className="flex items-center gap-0.5 text-green-500" title="Complete">
                              <CheckCircle size={12} />
                            </span>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {filteredProjects.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-gray-500">
            {searchQuery ? "No projects match your search" : "No projects found"}
          </div>
        )}
      </div>
    </div>
  );
}