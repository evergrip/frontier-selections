import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link, useOutletContext } from "react-router-dom";
import StatusBadge from "@/components/ui/StatusBadge";
import { Input } from "@/components/ui/input";
import { X } from "lucide-react";

export default function ChangeRequests() {
  const { selectedProject } = useOutletContext() || {};
  const [requests, setRequests] = useState([]);
  const [projects, setProjects] = useState({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [filterProject, setFilterProject] = useState(selectedProject?.id || "");

  useEffect(() => {
    base44.entities.ChangeRequest.list("-created_date", 200).then(async rs => {
      let filtered = rs;
      if (filterProject) filtered = rs.filter(r => r.project_id === filterProject);
      setRequests(filtered);
      const pIds = [...new Set(filtered.map(r => r.project_id))];
      const p = {};
      for (const id of pIds) { try { p[id] = await base44.entities.Project.get(id); } catch {} }
      setProjects(p);
      setLoading(false);
    });
  }, [filterProject]);

  const filtered = requests.filter(r => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return (r.original_item_name || "").toLowerCase().includes(q) || (r.requested_item_name || "").toLowerCase().includes(q);
  });

  if (loading) return <div className="flex items-center justify-center h-96"><div className="w-8 h-8 border-4 border-gray-200 border-t-gray-800 rounded-full animate-spin" /></div>;

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Change Requests</h1>
          {selectedProject && (
            <p className="text-sm text-gray-500 mt-1">Viewing: <span className="font-medium">{selectedProject.name}</span></p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {selectedProject && (
            <button onClick={() => setFilterProject("")} className="text-sm text-blue-600 hover:underline flex items-center gap-1">
              Clear filter <X size={14} />
            </button>
          )}
          <Input placeholder="Search by item..." value={filter} onChange={e => setFilter(e.target.value)} className="max-w-sm" />
        </div>
      </div>
      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200 text-gray-400 text-sm">No change requests</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Project</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Original</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Requested</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Price Impact</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-600">{projects[r.project_id]?.name || "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{r.original_item_name || "—"}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{r.requested_item_name || "—"}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{r.price_impact ? `${r.price_impact > 0 ? "+" : ""}$${r.price_impact.toLocaleString()}` : "—"}</td>
                    <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                    <td className="px-4 py-3"><Link to={`/change-requests/${r.id}`} className="text-blue-600 hover:underline">Review</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}