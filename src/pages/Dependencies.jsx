import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Plus, Edit2, Trash2, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/ui/StatusBadge";
import DependencyDialog from "@/components/dependencies/DependencyDialog";

export default function Dependencies() {
  const { projectId } = useParams();
  const [project, setProject] = useState(null);
  const [areas, setAreas] = useState([]);
  const [requirements, setRequirements] = useState([]);
  const [dependencies, setDependencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState(null);

  useEffect(() => { load(); }, [projectId]);

  async function load() {
    setLoading(true);
    const [p, a, r, d] = await Promise.all([
      base44.entities.Project.get(projectId),
      base44.entities.ProjectArea.filter({ project_id: projectId }),
      base44.entities.SelectionRequirement.filter({ project_id: projectId }),
      base44.entities.SelectionDependency.filter({ project_id: projectId })
    ]);
    setProject(p);
    setAreas(a);
    setRequirements(r);
    setDependencies(d);
    setLoading(false);
  }

  function reqName(id) { return requirements.find(r => r.id === id)?.name || "—"; }
  function reqArea(id) { const r = requirements.find(r => r.id === id); return areas.find(a => a.id === r?.area_id)?.name || "—"; }

  async function handleDelete(dep) {
    if (!confirm(`Delete dependency: ${reqName(dep.parent_requirement_id)} → ${reqName(dep.dependent_requirement_id)}?`)) return;
    await base44.entities.SelectionDependency.delete(dep.id);
    load();
  }

  if (loading) return <div className="flex items-center justify-center h-96"><div className="w-8 h-8 border-4 border-gray-200 border-t-gray-800 rounded-full animate-spin" /></div>;
  if (!project) return <div className="p-8 text-center text-gray-400">Project not found</div>;

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link to={`/projects/${projectId}`} className="p-2 rounded-lg hover:bg-gray-100"><ArrowLeft size={18} /></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Link2 size={20} className="text-blue-500" /> Selection Dependencies</h1>
          <p className="text-sm text-gray-500">{project.name}</p>
        </div>
        <Button className="gap-2" onClick={() => { setEditing(null); setShowDialog(true); }}><Plus size={14} /> Add Dependency</Button>
      </div>

      <div className="bg-blue-50 rounded-xl p-4 text-sm text-blue-800">
        Define rules between selection requirements. Dependencies can warn customers, block submission until a prerequisite is selected, block staff approval until a parent is approved, or limit available catalogue items and option values.
      </div>

      {dependencies.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <Link2 size={32} className="mx-auto text-gray-300 mb-2" />
          <p className="text-gray-400 text-sm">No dependency rules defined yet</p>
          <Button variant="outline" className="mt-3" onClick={() => { setEditing(null); setShowDialog(true); }}>Add first dependency</Button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Parent (prerequisite)</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Dependent</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Type</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Blocks</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {dependencies.map(dep => (
                  <tr key={dep.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{reqName(dep.parent_requirement_id)}</p>
                      <p className="text-xs text-gray-400">{reqArea(dep.parent_requirement_id)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{reqName(dep.dependent_requirement_id)}</p>
                      <p className="text-xs text-gray-400">{reqArea(dep.dependent_requirement_id)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-700">{dep.dependency_type}</span>
                      {dep.warning_message && <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{dep.warning_message}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        {dep.blocks_submission && <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 w-fit">Submission</span>}
                        {dep.blocks_approval && <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 w-fit">Approval</span>}
                        {dep.dependency_type === "Requires parent selection first" && <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 w-fit">Submission</span>}
                        {dep.dependency_type === "Blocks approval until parent approved" && <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 w-fit">Approval</span>}
                        {!dep.blocks_submission && !dep.blocks_approval && dep.dependency_type !== "Requires parent selection first" && dep.dependency_type !== "Blocks approval until parent approved" && <span className="text-xs text-gray-400">—</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => { setEditing(dep); setShowDialog(true); }}><Edit2 size={14} /></Button>
                        <Button size="icon" variant="ghost" className="text-red-600" onClick={() => handleDelete(dep)}><Trash2 size={14} /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <DependencyDialog open={showDialog} onClose={() => setShowDialog(false)} projectId={projectId} dependency={editing} requirements={requirements} areas={areas} onSaved={load} />
    </div>
  );
}