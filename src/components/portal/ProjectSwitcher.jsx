import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate, useLocation } from "react-router-dom";
import { ChevronDown, FolderKanban, Check, Building2 } from "lucide-react";

export default function ProjectSwitcher() {
  const [projects, setProjects] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const ref = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    async function load() {
      try {
        const res = await base44.functions.invoke("customerPortal", { action: "list_my_projects" });
        if (!res.data?.error) setProjects(res.data?.projects || []);
      } catch (e) { /* */ }
      setLoading(false);
    }
    load();
  }, []);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Extract current project ID from URL
  const match = location.pathname.match(/\/portal\/project\/([^/]+)/);
  const currentProjectId = match ? match[1] : null;
  const currentProject = projects.find(p => p.id === currentProjectId);

  // Only show if on a project page and there's more than one project
  if (!currentProjectId || loading || projects.length <= 1) return null;

  function switchTo(projectId) {
    setOpen(false);
    if (projectId === currentProjectId) return;
    // Navigate to the equivalent page in the new project
    const newPath = location.pathname.replace(/\/portal\/project\/[^/]+/, `/portal/project/${projectId}`);
    navigate(newPath);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors max-w-[200px] sm:max-w-xs"
      >
        <Building2 size={16} className="text-gray-500 shrink-0" />
        <span className="truncate">{currentProject?.name || "Select Project"}</span>
        <ChevronDown size={14} className={`text-gray-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-white rounded-xl border border-gray-200 shadow-lg z-50 overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
              <FolderKanban size={12} /> Switch Project
            </p>
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {projects.map(p => (
              <button
                key={p.id}
                onClick={() => switchTo(p.id)}
                className={`w-full flex items-center gap-2 px-3 py-2.5 text-left transition-colors ${
                  p.id === currentProjectId ? "bg-blue-50" : "hover:bg-gray-50"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${p.id === currentProjectId ? "text-blue-700" : "text-gray-900"}`}>{p.name}</p>
                  {p.address && <p className="text-xs text-gray-400 truncate">{p.address}</p>}
                </div>
                {p.id === currentProjectId && <Check size={16} className="text-blue-600 shrink-0" />}
              </button>
            ))}
          </div>
          <div className="border-t border-gray-100">
            <button
              onClick={() => { setOpen(false); navigate("/portal"); }}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <FolderKanban size={14} /> View All Projects
            </button>
          </div>
        </div>
      )}
    </div>
  );
}