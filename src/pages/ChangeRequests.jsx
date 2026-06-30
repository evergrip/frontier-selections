import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Link, useOutletContext, useSearchParams } from "react-router-dom";
import StatusBadge from "@/components/ui/StatusBadge";
import { Input } from "@/components/ui/input";
import { X, Clock, AlertTriangle, DollarSign, RefreshCw } from "lucide-react";

const NEEDING_REVIEW = ["Requested", "Under Review", "More Information Needed"];

export default function ChangeRequests() {
  const { selectedProject } = useOutletContext() || {};
  const [requests, setRequests] = useState([]);
  const [projects, setProjects] = useState({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [filterProject, setFilterProject] = useState(selectedProject?.id || "");
  const [quickFilter, setQuickFilter] = useState("");
  const [searchParams] = useSearchParams();
  const urlFilter = searchParams.get("filter");

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

  const filtered = useMemo(() => requests.filter(r => {
    if (urlFilter === "needing_review" && !NEEDING_REVIEW.includes(r.status)) return false;
    if (quickFilter === "needs_review" && !NEEDING_REVIEW.includes(r.status)) return false;
    if (quickFilter === "more_info" && r.status !== "More Information Needed") return false;
    if (quickFilter === "approved" && r.status !== "Approved") return false;
    if (quickFilter === "rejected" && r.status !== "Rejected") return false;
    if (quickFilter === "has_price_impact" && !(r.price_impact && r.price_impact !== 0)) return false;
    if (quickFilter === "has_allowance_impact" && !(r.allowance_impact && r.allowance_impact !== 0)) return false;
    if (quickFilter === "older_than_3_days") {
      const ageDays = (Date.now() - new Date(r.created_date).getTime()) / (1000 * 60 * 60 * 24);
      if (ageDays < 3) return false;
    }
    if (!filter) return true;
    const q = filter.toLowerCase();
    return (r.original_item_name || "").toLowerCase().includes(q) || (r.requested_item_name || "").toLowerCase().includes(q);
  }), [requests, urlFilter, quickFilter, filter]);

  function getPriority(r) {
    const ageDays = (Date.now() - new Date(r.created_date).getTime()) / (1000 * 60 * 60 * 24);
    const hasPriceImpact = r.price_impact && r.price_impact !== 0;
    if (NEEDING_REVIEW.includes(r.status) && ageDays > 3 && hasPriceImpact) return "Urgent";
    if (NEEDING_REVIEW.includes(r.status) && ageDays > 3) return "High";
    if (NEEDING_REVIEW.includes(r.status)) return "Medium";
    return "Low";
  }

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

      <div className="flex flex-wrap gap-1.5">
        {[
          { value: "", label: "All" },
          { value: "needs_review", label: "Needs Review" },
          { value: "more_info", label: "More Info Needed" },
          { value: "approved", label: "Approved" },
          { value: "rejected", label: "Rejected" },
          { value: "has_price_impact", label: "Price Impact" },
          { value: "has_allowance_impact", label: "Allowance Impact" },
          { value: "older_than_3_days", label: "Older than 3 days" },
        ].map(q => (
          <button key={q.value} onClick={() => setQuickFilter(q.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${quickFilter === q.value ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
            {q.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <RefreshCw size={48} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-400 text-sm">No change requests</p>
          <p className="text-gray-400 text-xs mt-1">Customer change requests will appear here after submission.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">Project / Customer</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">Original → Requested</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">Reason</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">Requested</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">Age</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 whitespace-nowrap">Price Impact</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 whitespace-nowrap">Allow. Impact</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">Priority</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(r => {
                  const ageDays = Math.floor((Date.now() - new Date(r.created_date).getTime()) / (1000 * 60 * 60 * 24));
                  const priority = getPriority(r);
                  return (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="text-gray-700">{projects[r.project_id]?.name || "—"}</p>
                        <p className="text-xs text-gray-400">{projects[r.project_id]?.client_name || ""}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-gray-500 text-xs">{r.original_item_name || "—"}</p>
                        <p className="font-medium text-gray-900">→ {r.requested_item_name || "—"}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-500 max-w-[150px] truncate" title={r.reason}>{r.reason || "—"}</td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{r.created_date ? new Date(r.created_date).toLocaleDateString() : "—"}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={ageDays > 3 ? "text-red-500 font-medium" : "text-gray-500"}>{ageDays}d</span>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {r.price_impact ? <span className={r.price_impact > 0 ? "text-red-600 font-medium" : "text-green-600"}>{r.price_impact > 0 ? "+" : ""}${r.price_impact.toLocaleString()}</span> : "—"}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {r.allowance_impact ? <span className={r.allowance_impact > 0 ? "text-red-600" : "text-green-600"}>{r.allowance_impact > 0 ? "+" : ""}${r.allowance_impact.toLocaleString()}</span> : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded ${priority === "Urgent" ? "bg-red-100 text-red-700" : priority === "High" ? "bg-amber-100 text-amber-700" : priority === "Medium" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"}`}>{priority}</span>
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                      <td className="px-4 py-3"><Link to={`/change-requests/${r.id}`} className="text-blue-600 hover:underline">Review</Link></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}