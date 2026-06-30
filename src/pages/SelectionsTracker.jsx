import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Link, useSearchParams, useOutletContext } from "react-router-dom";
import { Search, X, Download, ExternalLink, Eye, Star, AlertTriangle, Clock, CheckCircle, Package, Loader2, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import StatusBadge from "@/components/ui/StatusBadge";
import { CATEGORIES, SELECTION_STATUSES, hasPermission } from "@/lib/constants";

const DONE_STATUSES = ["Approved", "Locked", "Ready to Order", "Ordered", "Received", "Installed"];
const TODAY = new Date(); TODAY.setHours(0, 0, 0, 0);
const WEEK_END = new Date(TODAY); WEEK_END.setDate(WEEK_END.getDate() + 7);

export default function SelectionsTracker() {
  const { selectedProject } = useOutletContext() || {};
  const [projects, setProjects] = useState([]);
  const [areas, setAreas] = useState([]);
  const [requirements, setRequirements] = useState([]);
  const [selections, setSelections] = useState([]);
  const [procurement, setProcurement] = useState([]);
  const [suggestedOptions, setSuggestedOptions] = useState([]);
  const [catalogueItems, setCatalogueItems] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const [filterProject, setFilterProject] = useState(selectedProject?.id || "");
  const [filterArea, setFilterArea] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterQuick, setFilterQuick] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const qf = searchParams.get("filter");
    if (qf) setFilterQuick(qf);
  }, [searchParams]);

  useEffect(() => {
    base44.auth.me().then(u => setUser(u)).catch(() => {});
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const [p, r, s, proc, paci, ci] = await Promise.all([
        base44.entities.Project.list("-updated_date", 200),
        base44.entities.SelectionRequirement.list(null, 1000),
        base44.entities.CustomerSelection.list("-created_date", 1000),
        base44.entities.ProcurementItem.list(null, 500),
        base44.entities.ProjectAvailableCatalogueItem.list(null, 1000),
        base44.entities.CatalogueItem.list("name", 500)
      ]);
      setProjects(p);
      setRequirements(r);
      setSelections(s);
      setProcurement(proc);
      setSuggestedOptions(paci);
      setCatalogueItems(ci);

      const areaIds = [...new Set(r.map(req => req.area_id))];
      const areaResults = await Promise.all(areaIds.map(id => base44.entities.ProjectArea.get(id).catch(() => null)));
      setAreas(areaResults.filter(Boolean));

      try {
        const invRes = await base44.functions.invoke("customerInvitations", { action: "list" });
        setInvitations(invRes.data?.invitations || []);
      } catch (e) {}
    } catch (e) {}
    setLoading(false);
  }

  const projectMap = useMemo(() => { const m = {}; projects.forEach(p => m[p.id] = p); return m; }, [projects]);
  const areaMap = useMemo(() => { const m = {}; areas.forEach(a => m[a.id] = a); return m; }, [areas]);
  const catalogueMap = useMemo(() => { const m = {}; catalogueItems.forEach(c => m[c.id] = c); return m; }, [catalogueItems]);
  const suggestedByReq = useMemo(() => {
    const m = {};
    suggestedOptions.forEach(s => {
      if (!m[s.requirement_id]) m[s.requirement_id] = [];
      m[s.requirement_id].push(s);
    });
    return m;
  }, [suggestedOptions]);

  const customerMap = useMemo(() => {
    const m = {};
    invitations.forEach(inv => {
      (inv.project_ids || []).forEach(pid => {
        if (!m[pid]) m[pid] = [];
        m[pid].push(inv);
      });
    });
    return m;
  }, [invitations]);

  const rows = useMemo(() => {
    return requirements.map(req => {
      const project = projectMap[req.project_id];
      const area = areaMap[req.area_id];
      const sel = selections.find(s => s.requirement_id === req.id && s.is_current);
      const catItem = sel ? catalogueMap[sel.catalogue_item_id] : null;
      const proc = procurement.find(p => p.requirement_id === req.id);
      const suggested = suggestedByReq[req.id] || [];
      const customers = customerMap[req.project_id] || [];
      const customerName = customers.map(c => c.customer_name || c.email).join(", ") || project?.client_name || "—";
      const isOverdue = req.due_date && !DONE_STATUSES.includes(req.status) && new Date(req.due_date + "T00:00:00") < TODAY;
      const overAllowance = sel && (sel.over_allowance || 0) > 0;
      const hasSuggested = suggested.length > 0;
      const hasSubmission = !!sel;
      const missingSuggested = (req.customer_catalogue_access_mode || "suggested_only") === "suggested_only" && !hasSuggested && !DONE_STATUSES.includes(req.status);

      return {
        req, project, area, sel, catItem, proc, suggested, customerName,
        isOverdue, overAllowance, hasSuggested, hasSubmission, missingSuggested,
        selectedPrice: sel?.calculated_price || 0,
        allowance: req.allowance_amount || 0,
        overage: sel?.over_allowance || 0,
        credit: sel?.under_allowance || 0,
        lastUpdated: sel?.updated_date || req.updated_date
      };
    });
  }, [requirements, projectMap, areaMap, selections, catalogueMap, procurement, suggestedByReq, customerMap]);

  const filtered = useMemo(() => {
    return rows.filter(row => {
      if (filterProject && row.req.project_id !== filterProject) return false;
      if (filterArea && row.req.area_id !== filterArea) return false;
      if (filterCategory && row.req.category !== filterCategory) return false;
      if (filterStatus && row.req.status !== filterStatus) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!row.req.name.toLowerCase().includes(q) &&
            !(row.project?.name || "").toLowerCase().includes(q) &&
            !(row.area?.name || "").toLowerCase().includes(q) &&
            !(row.catItem?.name || "").toLowerCase().includes(q)) return false;
      }
      if (filterQuick) {
        switch (filterQuick) {
          case "overdue": if (!row.isOverdue) return false; break;
          case "due_this_week": {
            if (!row.req.due_date || DONE_STATUSES.includes(row.req.status)) return false;
            const due = new Date(row.req.due_date + "T00:00:00");
            if (due < TODAY || due > WEEK_END) return false;
            break;
          }
          case "pending_customer": if (!["Not Started", "Viewed", "In Progress", "Revision Requested"].includes(row.req.status)) return false; break;
          case "pending_approval": if (row.sel?.status !== "Pending") return false; break;
          case "approved": if (row.req.status !== "Approved") return false; break;
          case "rejected": if (row.req.status !== "Rejected") return false; break;
          case "revision_requested": if (row.req.status !== "Revision Requested") return false; break;
          case "change_requested": if (row.req.status !== "Change Requested") return false; break;
          case "locked": if (row.req.status !== "Locked") return false; break;
          case "ready_to_order": if (row.req.status !== "Ready to Order") return false; break;
          case "ordered": if (row.req.status !== "Ordered") return false; break;
          case "received": if (row.req.status !== "Received") return false; break;
          case "installed": if (row.req.status !== "Installed") return false; break;
          case "over_allowance": if (!row.overAllowance) return false; break;
          case "missing_suggested": if (!row.missingSuggested) return false; break;
          case "no_submission": if (row.hasSubmission) return false; break;
          case "outstanding": if (DONE_STATUSES.includes(row.req.status)) return false; break;
        }
      }
      return true;
    });
  }, [rows, filterProject, filterArea, filterCategory, filterStatus, filterQuick, searchQuery]);

  const stats = useMemo(() => {
    const total = rows.length;
    const approved = rows.filter(r => DONE_STATUSES.includes(r.req.status)).length;
    const outstanding = total - approved;
    const pendingCustomer = rows.filter(r => ["Not Started", "Viewed", "In Progress", "Revision Requested"].includes(r.req.status)).length;
    const pendingApproval = rows.filter(r => r.sel?.status === "Pending").length;
    const overdue = rows.filter(r => r.isOverdue).length;
    const overAllowance = rows.filter(r => r.overAllowance).length;
    const changeRequests = rows.filter(r => r.req.status === "Change Requested").length;
    const readyToOrder = rows.filter(r => r.req.status === "Ready to Order").length;
    const ordered = rows.filter(r => r.req.status === "Ordered").length;
    const installed = rows.filter(r => r.req.status === "Installed").length;
    const missingSuggested = rows.filter(r => r.missingSuggested).length;
    return { total, approved, outstanding, pendingCustomer, pendingApproval, overdue, overAllowance, changeRequests, readyToOrder, ordered, installed, missingSuggested };
  }, [rows]);

  const areasForProject = useMemo(() => {
    if (!filterProject) return areas;
    return areas.filter(a => a.project_id === filterProject);
  }, [areas, filterProject]);

  function exportCSV() {
    const headers = ["Project", "Customer", "Area", "Requirement", "Category", "Required", "Due Date", "Requirement Status", "Selection Status", "Selected Item", "Selected Price", "Allowance", "Overage", "Procurement Status", "Suggested Options", "Last Updated"];
    const lines = [headers.join(",")];
    filtered.forEach(row => {
      lines.push([
        row.project?.name || "",
        row.customerName,
        row.area?.name || "",
        row.req.name,
        row.req.category || "",
        row.req.is_required ? "Required" : "Optional",
        row.req.due_date || "",
        row.req.status,
        row.sel?.status || "",
        row.catItem?.name || "",
        row.selectedPrice,
        row.allowance,
        row.overage,
        row.proc?.status || "",
        row.suggested.length,
        row.lastUpdated || ""
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "selections_tracker.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return <div className="flex items-center justify-center h-96"><div className="w-8 h-8 border-4 border-gray-200 border-t-gray-800 rounded-full animate-spin" /></div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Selections Tracker</h1>
          <p className="text-sm text-gray-500 mt-1">All selection requirements across all projects</p>
        </div>
        {selectedProject && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Viewing: <span className="font-medium">{selectedProject.name}</span></span>
            <button onClick={() => setFilterProject("")} className="text-sm text-blue-600 hover:underline flex items-center gap-1">
              Clear filter <X size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <SummaryCard icon={Package} label="Total" value={stats.total} color="bg-gray-100 text-gray-700" />
        <SummaryCard icon={CheckCircle} label="Approved" value={stats.approved} color="bg-emerald-100 text-emerald-700" />
        <SummaryCard icon={Clock} label="Outstanding" value={stats.outstanding} color="bg-amber-100 text-amber-700" />
        <SummaryCard icon={Clock} label="Pending Customer" value={stats.pendingCustomer} color="bg-sky-100 text-sky-700" />
        <SummaryCard icon={Eye} label="Pending Approval" value={stats.pendingApproval} color="bg-blue-100 text-blue-700" />
        <SummaryCard icon={AlertTriangle} label="Overdue" value={stats.overdue} color="bg-red-100 text-red-700" />
        <SummaryCard icon={AlertTriangle} label="Over Allowance" value={stats.overAllowance} color="bg-rose-100 text-rose-700" />
        <SummaryCard icon={AlertTriangle} label="Change Requests" value={stats.changeRequests} color="bg-orange-100 text-orange-700" />
        <SummaryCard icon={Package} label="Ready to Order" value={stats.readyToOrder} color="bg-cyan-100 text-cyan-700" />
        <SummaryCard icon={Package} label="Ordered" value={stats.ordered} color="bg-blue-100 text-blue-700" />
        <SummaryCard icon={CheckCircle} label="Installed" value={stats.installed} color="bg-green-100 text-green-700" />
        <SummaryCard icon={Star} label="Missing Suggested" value={stats.missingSuggested} color="bg-purple-100 text-purple-700" />
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by project, area, requirement, or selected item..."
              className="w-full h-10 pl-9 pr-9 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
            {searchQuery && <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"><X size={16} /></button>}
          </div>
          <Button variant="outline" onClick={exportCSV} className="gap-2"><Download size={14} /> Export CSV</Button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Select value={filterProject} onValueChange={v => { setFilterProject(v === "all" ? "" : v); setFilterArea(""); }}>
            <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="All Projects" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All Projects</SelectItem>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={filterArea} onValueChange={v => setFilterArea(v === "all" ? "" : v)} disabled={!filterProject}>
            <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="All Areas" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All Areas</SelectItem>{areasForProject.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={filterCategory} onValueChange={v => setFilterCategory(v === "all" ? "" : v)}>
            <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="All Categories" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All Categories</SelectItem>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={v => setFilterStatus(v === "all" ? "" : v)}>
            <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="All Statuses" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All Statuses</SelectItem>{SELECTION_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[
            { value: "", label: "All" },
            { value: "outstanding", label: "Outstanding" },
            { value: "pending_customer", label: "Pending Customer" },
            { value: "pending_approval", label: "Pending Approval" },
            { value: "approved", label: "Approved" },
            { value: "overdue", label: "Overdue" },
            { value: "over_allowance", label: "Over Allowance" },
            { value: "missing_suggested", label: "Missing Suggested" },
            { value: "no_submission", label: "No Submission" },
            { value: "ready_to_order", label: "Ready to Order" },
            { value: "ordered", label: "Ordered" },
            { value: "installed", label: "Installed" }
          ].map(q => (
            <button key={q.value} onClick={() => setFilterQuick(q.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterQuick === q.value ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              {q.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-3 py-3 font-medium text-gray-500 whitespace-nowrap">Project</th>
                <th className="text-left px-3 py-3 font-medium text-gray-500 whitespace-nowrap">Customer</th>
                <th className="text-left px-3 py-3 font-medium text-gray-500 whitespace-nowrap">Area</th>
                <th className="text-left px-3 py-3 font-medium text-gray-500 whitespace-nowrap">Requirement</th>
                <th className="text-left px-3 py-3 font-medium text-gray-500 whitespace-nowrap">Category</th>
                <th className="text-left px-3 py-3 font-medium text-gray-500 whitespace-nowrap">Req.</th>
                <th className="text-left px-3 py-3 font-medium text-gray-500 whitespace-nowrap">Due</th>
                <th className="text-left px-3 py-3 font-medium text-gray-500 whitespace-nowrap">Req Status</th>
                <th className="text-left px-3 py-3 font-medium text-gray-500 whitespace-nowrap">Sel Status</th>
                <th className="text-left px-3 py-3 font-medium text-gray-500 whitespace-nowrap">Selected Item</th>
                <th className="text-right px-3 py-3 font-medium text-gray-500 whitespace-nowrap">Price</th>
                <th className="text-right px-3 py-3 font-medium text-gray-500 whitespace-nowrap">Allowance</th>
                <th className="text-right px-3 py-3 font-medium text-gray-500 whitespace-nowrap">Over/Credit</th>
                <th className="text-left px-3 py-3 font-medium text-gray-500 whitespace-nowrap">Procurement</th>
                <th className="text-center px-3 py-3 font-medium text-gray-500 whitespace-nowrap">Suggested</th>
                <th className="text-left px-3 py-3 font-medium text-gray-500 whitespace-nowrap">Updated</th>
                <th className="text-center px-3 py-3 font-medium text-gray-500 whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr><td colSpan={17} className="px-4 py-10 text-center text-gray-400">No selections match your filters</td></tr>
              ) : filtered.map(row => (
                <tr key={row.req.id} className={`hover:bg-gray-50 ${row.isOverdue ? "bg-red-50/30" : ""}`}>
                  <td className="px-3 py-2.5 text-gray-700 whitespace-nowrap">{row.project?.name || "—"}</td>
                  <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{row.customerName}</td>
                  <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{row.area?.name || "—"}</td>
                  <td className="px-3 py-2.5">
                    <Link to={`/projects/${row.req.project_id}/area/${row.req.area_id}/requirement/${row.req.id}`} className="font-medium text-gray-900 hover:text-blue-600">
                      {row.req.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{row.req.category || "—"}</td>
                  <td className="px-3 py-2.5">{row.req.is_required ? <span className="text-[10px] text-red-500 font-medium">REQ</span> : <span className="text-[10px] text-gray-400">OPT</span>}</td>
                  <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">
                    {row.req.due_date ? (
                      <span className={row.isOverdue ? "text-red-600 font-medium" : ""}>{row.req.due_date}</span>
                    ) : "—"}
                  </td>
                  <td className="px-3 py-2.5"><StatusBadge status={row.req.status} /></td>
                  <td className="px-3 py-2.5">{row.sel ? <StatusBadge status={row.sel.status} /> : <span className="text-gray-400 text-xs">—</span>}</td>
                  <td className="px-3 py-2.5 text-gray-700 whitespace-nowrap">{row.catItem?.name || "—"}</td>
                  <td className="px-3 py-2.5 text-right text-gray-700 whitespace-nowrap">{row.selectedPrice ? `$${row.selectedPrice.toLocaleString()}` : "—"}</td>
                  <td className="px-3 py-2.5 text-right text-gray-500 whitespace-nowrap">{row.allowance ? `$${row.allowance.toLocaleString()}` : "—"}</td>
                  <td className="px-3 py-2.5 text-right whitespace-nowrap">
                    {row.overage > 0 ? <span className="text-red-600">+$${row.overage.toLocaleString()}</span> :
                     row.credit > 0 ? <span className="text-green-600">-$${row.credit.toLocaleString()}</span> : "—"}
                  </td>
                  <td className="px-3 py-2.5">{row.proc ? <StatusBadge status={row.proc.status} /> : <span className="text-gray-400 text-xs">—</span>}</td>
                  <td className="px-3 py-2.5 text-center">
                    {row.suggested.length > 0 ? (
                      <span className="inline-flex items-center gap-1 text-xs text-gray-600">{row.suggested.length}{row.suggested.some(s => s.is_recommended) && <Star size={10} className="text-amber-500" />}</span>
                    ) : row.missingSuggested ? (
                      <span className="text-xs text-red-500" title="Missing suggested options">⚠</span>
                    ) : <span className="text-gray-400 text-xs">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-gray-400 text-xs whitespace-nowrap">{row.lastUpdated ? new Date(row.lastUpdated).toLocaleDateString() : "—"}</td>
                  <td className="px-3 py-2.5 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Link to={`/projects/${row.req.project_id}/area/${row.req.area_id}/requirement/${row.req.id}`} className="p-1.5 rounded hover:bg-gray-100 text-gray-500" title="Open requirement"><ExternalLink size={14} /></Link>
                      <Link to={`/projects/${row.req.project_id}`} className="p-1.5 rounded hover:bg-gray-100 text-gray-500" title="Open project"><Package size={14} /></Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, color }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color} mb-2`}><Icon size={14} /></div>
      <p className="text-xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}