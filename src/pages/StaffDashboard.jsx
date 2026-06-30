import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { Clock, AlertTriangle, ArrowRight, Calendar, FileEdit, RefreshCw, Hourglass, PackageX, FolderKanban, TrendingUp, ClipboardCheck, Star, Eye } from "lucide-react";
import StatusBadge from "@/components/ui/StatusBadge";
import NextActionPanel from "@/components/staff/NextActionPanel";

const DONE = ["Approved", "Locked", "Ready to Order", "Ordered", "Received", "Installed"];

export default function StaffDashboard() {
  const [projects, setProjects] = useState([]);
  const [requirements, setRequirements] = useState([]);
  const [selections, setSelections] = useState([]);
  const [changeRequests, setChangeRequests] = useState([]);
  const [procurement, setProcurement] = useState([]);
  const [suggestedOptions, setSuggestedOptions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [p, r, s, cr, proc, paci] = await Promise.all([
          base44.entities.Project.list("-updated_date", 100),
          base44.entities.SelectionRequirement.list(null, 500),
          base44.entities.CustomerSelection.list("-created_date", 500),
          base44.entities.ChangeRequest.list("-created_date", 100),
          base44.entities.ProcurementItem.list(null, 200),
          base44.entities.ProjectAvailableCatalogueItem.list(null, 1000)
        ]);
        setProjects(p); setRequirements(r); setSelections(s); setChangeRequests(cr); setProcurement(proc); setSuggestedOptions(paci);
      } catch (e) {}
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <div className="flex items-center justify-center h-96"><div className="w-8 h-8 border-4 border-gray-200 border-t-gray-800 rounded-full animate-spin" /></div>;

  const projectMap = {}; projects.forEach(p => projectMap[p.id] = p);

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const weekEnd = new Date(today); weekEnd.setDate(weekEnd.getDate() + 7);

  const overdue = requirements.filter(r => r.due_date && !DONE.includes(r.status) && new Date(r.due_date + "T00:00:00") < today);
  const dueThisWeek = requirements.filter(r => r.due_date && !DONE.includes(r.status) && new Date(r.due_date + "T00:00:00") >= today && new Date(r.due_date + "T00:00:00") <= weekEnd);
  const pendingApprovals = selections.filter(s => s.status === "Pending");
  const pendingCustomerAction = requirements.filter(r => ["Not Started", "Viewed", "In Progress", "Revision Requested"].includes(r.status));
  const recentSubmissions = pendingApprovals.slice(0, 6);
  const crNeedingReview = changeRequests.filter(c => ["Requested", "Under Review", "More Information Needed"].includes(c.status));
  const activeProjects = projects.filter(p => !["Completed", "Archived", "Draft"].includes(p.status));

  const overAllowanceSelections = selections.filter(s => (s.over_allowance || 0) > 0 && s.status === "Approved");
  const procurementWarnings = procurement.filter(p => ["Backordered", "Delayed", "Substitution Required"].includes(p.status));
  const backordered = procurement.filter(p => p.status === "Backordered");

  const suggestedByReq = {};
  suggestedOptions.forEach(s => {
    if (!suggestedByReq[s.requirement_id]) suggestedByReq[s.requirement_id] = [];
    suggestedByReq[s.requirement_id].push(s);
  });
  const missingSuggestedOptions = requirements.filter(r =>
    (r.customer_catalogue_access_mode || "suggested_only") === "suggested_only" &&
    !(suggestedByReq[r.id] || []).length &&
    !DONE.includes(r.status)
  );

  const reqMap = {}; requirements.forEach(r => reqMap[r.id] = r);

  const dashboardActions = [];
  if (overdue.length > 0) {
    const r = overdue[0];
    dashboardActions.push({ label: `Review overdue: "${r.name}"`, to: `/projects/${r.project_id}/area/${r.area_id}/requirement/${r.id}`, priority: "urgent", buttonLabel: "Open", description: `${projectMap[r.project_id]?.name || "Project"} • Due ${r.due_date}` });
  }
  if (pendingApprovals.length > 0) {
    const s = pendingApprovals[0];
    const r = reqMap[s.requirement_id];
    dashboardActions.push({ label: "Review submitted selection", to: r ? `/projects/${r.project_id}/area/${r.area_id}/requirement/${r.id}` : `/projects/${s.project_id}`, priority: "high", buttonLabel: "Review", description: projectMap[s.project_id]?.name || "" });
  }
  if (missingSuggestedOptions.length > 0) {
    const r = missingSuggestedOptions[0];
    dashboardActions.push({ label: "Add suggested options", to: `/projects/${r.project_id}/area/${r.area_id}/requirement/${r.id}`, priority: "high", buttonLabel: "Add", description: `${projectMap[r.project_id]?.name || ""} • ${r.name}` });
  }
  if (crNeedingReview.length > 0) {
    dashboardActions.push({ label: "Resolve change request", to: `/change-requests/${crNeedingReview[0].id}`, priority: "medium", buttonLabel: "Review" });
  }
  if (procurementWarnings.length > 0) {
    dashboardActions.push({ label: "Check procurement warning", to: `/procurement/${procurementWarnings[0].id}`, priority: "medium", buttonLabel: "Open" });
  }

  const projectIdsWithIssues = new Set([
    ...overdue.map(r => r.project_id),
    ...pendingApprovals.map(s => s.project_id),
    ...crNeedingReview.map(c => c.project_id)
  ]);
  const projectsNeedingAttention = activeProjects.filter(p => projectIdsWithIssues.has(p.id));

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 lg:space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Frontier Building Group — Selections Overview</p>
      </div>

      <NextActionPanel actions={dashboardActions} />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <WidgetStat icon={AlertTriangle} label="Overdue" value={overdue.length} color="bg-red-50 text-red-600" to="/selections-tracker?filter=overdue" />
        <WidgetStat icon={Clock} label="Pending Approvals" value={pendingApprovals.length} color="bg-blue-50 text-blue-600" to="/selections-tracker?filter=pending_approval" />
        <WidgetStat icon={RefreshCw} label="Change Requests" value={crNeedingReview.length} color="bg-orange-50 text-orange-600" to="/change-requests?filter=needing_review" />
        <WidgetStat icon={PackageX} label="Procurement Warnings" value={procurementWarnings.length} color="bg-purple-50 text-purple-600" to="/procurement?filter=warnings" />
        <WidgetStat icon={Calendar} label="Due This Week" value={dueThisWeek.length} color="bg-amber-50 text-amber-600" to="/selections-tracker?filter=due_this_week" />
        <WidgetStat icon={Hourglass} label="Pending Customer" value={pendingCustomerAction.length} color="bg-sky-50 text-sky-600" to="/selections-tracker?filter=pending_customer" />
        <WidgetStat icon={TrendingUp} label="Over Allowance" value={overAllowanceSelections.length} color="bg-rose-50 text-rose-600" to="/selections-tracker?filter=over_allowance" />
        <WidgetStat icon={Star} label="Missing Suggested Options" value={missingSuggestedOptions.length} color="bg-violet-50 text-violet-600" to="/selections-tracker?filter=missing_suggested" />
      </div>

      <div className="flex flex-wrap gap-2">
        <Link to="/selections-tracker" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800">
          <ClipboardCheck size={14} /> View All Selections
        </Link>
        <Link to="/selections-tracker?filter=outstanding" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-gray-200 text-sm font-medium hover:bg-gray-50">
          <Clock size={14} /> View Outstanding
        </Link>
        <Link to="/selections-tracker?filter=pending_approval" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-gray-200 text-sm font-medium hover:bg-gray-50">
          <Eye size={14} /> View Pending Approvals
        </Link>
        <Link to="/selections-tracker?filter=missing_suggested" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-gray-200 text-sm font-medium hover:bg-gray-50">
          <Star size={14} /> View Missing Suggested
        </Link>
        <Link to="/selections-tracker?filter=overdue" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-gray-200 text-sm font-medium hover:bg-gray-50">
          <AlertTriangle size={14} /> View Overdue
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        <Widget title="Overdue Selections" items={overdue.slice(0, 6)} renderItem={r => (
          <Link key={r.id} to={`/projects/${r.project_id}/area/${r.area_id}/requirement/${r.id}`} className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50">
            <div><p className="text-sm font-medium text-gray-900">{r.name}</p><p className="text-xs text-red-500">Due {r.due_date}</p></div>
            <StatusBadge status={r.status} />
          </Link>
        )} />
        <Widget title="Pending Staff Approvals" items={pendingApprovals.slice(0, 6)} renderItem={s => {
          const r = reqMap[s.requirement_id];
          const to = r ? `/projects/${r.project_id}/area/${r.area_id}/requirement/${r.id}` : `/projects/${s.project_id}`;
          return (
          <Link key={s.id} to={to} className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50">
            <div><p className="text-sm font-medium text-gray-900">{r?.name || "Selection Submitted"}</p><p className="text-xs text-gray-500">{projectMap[s.project_id]?.name || ""}</p></div>
            <StatusBadge status="Pending" />
          </Link>
          );
        }} />
        <Widget title="Change Requests Needing Review" link="/change-requests" items={crNeedingReview.slice(0, 6)} renderItem={c => (
          <Link key={c.id} to={`/change-requests/${c.id}`} className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50">
            <div><p className="text-sm font-medium text-gray-900">{c.original_item_name} → {c.requested_item_name}</p><p className="text-xs text-gray-500">{projectMap[c.project_id]?.name || ""}</p></div>
            <StatusBadge status={c.status} />
          </Link>
        )} />
        <Widget title="Over Allowance Selections" items={overAllowanceSelections.slice(0, 6)} renderItem={s => {
          const r = reqMap[s.requirement_id];
          const to = r ? `/projects/${r.project_id}/area/${r.area_id}/requirement/${r.id}` : `/projects/${s.project_id}`;
          return (
          <Link key={s.id} to={to} className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50">
            <div><p className="text-sm font-medium text-gray-900">Over by ${s.over_allowance.toLocaleString()}</p><p className="text-xs text-gray-500">{projectMap[s.project_id]?.name || ""}</p></div>
            <StatusBadge status="Approved" />
          </Link>
          );
        }} />
        <Widget title="Procurement Warnings" link="/procurement" items={procurementWarnings.slice(0, 6)} renderItem={p => (
          <Link key={p.id} to={`/procurement/${p.id}`} className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50">
            <div><p className="text-sm font-medium text-gray-900">{p.item_name}</p><p className="text-xs text-gray-500">{projectMap[p.project_id]?.name || ""}</p></div>
            <StatusBadge status={p.status} />
          </Link>
        )} />
        <Widget title="Backordered Items" link="/procurement" items={backordered.slice(0, 6)} renderItem={p => (
          <Link key={p.id} to={`/procurement/${p.id}`} className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50">
            <div><p className="text-sm font-medium text-gray-900">{p.item_name}</p><p className="text-xs text-gray-500">{p.supplier || ""}</p></div>
            <StatusBadge status={p.status} />
          </Link>
        )} />
        <Widget title="Recent Customer Submissions" items={recentSubmissions} renderItem={s => {
          const r = reqMap[s.requirement_id];
          const to = r ? `/projects/${r.project_id}/area/${r.area_id}/requirement/${r.id}` : `/projects/${s.project_id}`;
          return (
          <Link key={s.id} to={to} className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50">
            <div><p className="text-sm font-medium text-gray-900">{r?.name || "Selection Submitted"}</p><p className="text-xs text-gray-500">{projectMap[s.project_id]?.name || ""}</p></div>
            <StatusBadge status="Pending" />
          </Link>
          );
        }} />
        <Widget title="Projects Needing Attention" link="/projects" items={projectsNeedingAttention.slice(0, 6)} renderItem={p => (
          <Link key={p.id} to={`/projects/${p.id}`} className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50">
            <div><p className="text-sm font-medium text-gray-900">{p.name}</p><p className="text-xs text-gray-500">{p.client_name || "No client"}</p></div>
            <StatusBadge status={p.status} />
          </Link>
        )} />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Active Projects</h2>
          <Link to="/projects" className="text-sm text-gray-500 hover:text-gray-900 flex items-center gap-1">View all <ArrowRight size={14} /></Link>
        </div>
        {activeProjects.length === 0 ? <div className="px-5 py-12 text-center text-sm text-gray-400">No active projects</div> : (
          <div className="divide-y divide-gray-50">
            {activeProjects.slice(0, 8).map(p => (
              <Link key={p.id} to={`/projects/${p.id}`} className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50">
                <div><p className="text-sm font-medium text-gray-900">{p.name}</p><p className="text-xs text-gray-500">{p.client_name || "No client"}</p></div>
                <StatusBadge status={p.status} />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function WidgetStat({ icon: Icon, label, value, color, to }) {
  const content = (
    <>
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color} mb-2`}><Icon size={16} /></div>
      <p className="text-xl sm:text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </>
  );
  if (to) {
    return (
      <Link to={to} className="block bg-white rounded-xl border border-gray-200 p-3 sm:p-4 hover:border-gray-300 hover:shadow-sm transition-all">
        {content}
      </Link>
    );
  }
  return <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4">{content}</div>;
}

function Widget({ title, link, items, renderItem }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <h2 className="font-semibold text-gray-900">{title}</h2>
        {link && <Link to={link} className="text-sm text-gray-500 hover:text-gray-900 flex items-center gap-1">View all <ArrowRight size={14} /></Link>}
      </div>
      {items.length === 0 ? <div className="px-5 py-10 text-center text-sm text-gray-400">Nothing needs attention here</div> : (
        <div className="divide-y divide-gray-50">{items.map(renderItem)}</div>
      )}
    </div>
  );
}