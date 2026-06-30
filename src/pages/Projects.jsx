import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Search, Filter, AlertTriangle, Clock, Star, Eye, CheckCircle, UserPlus, ExternalLink, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import StatusBadge from "@/components/ui/StatusBadge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { PROJECT_STATUSES } from "@/lib/constants";

const DONE = ["Approved", "Locked", "Ready to Order", "Ordered", "Received", "Installed"];

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [requirements, setRequirements] = useState([]);
  const [selections, setSelections] = useState([]);
  const [suggestedOptions, setSuggestedOptions] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadProjects();
  }, []);

  async function loadProjects() {
    setLoading(true);
    try {
      const [p, r, s, paci] = await Promise.all([
        base44.entities.Project.list("-updated_date", 100),
        base44.entities.SelectionRequirement.list(null, 1000),
        base44.entities.CustomerSelection.list(null, 1000),
        base44.entities.ProjectAvailableCatalogueItem.list(null, 1000)
      ]);
      setProjects(p); setRequirements(r); setSelections(s); setSuggestedOptions(paci);
      try {
        const invRes = await base44.functions.invoke("customerInvitations", { action: "list" });
        setInvitations(invRes.data?.invitations || []);
      } catch {}
    } catch {}
    setLoading(false);
  }

  const projectStats = useMemo(() => {
    const stats = {};
    projects.forEach(p => {
      const reqs = requirements.filter(r => r.project_id === p.id);
      const sels = selections.filter(s => s.project_id === p.id && s.is_current);
      const suggested = suggestedOptions.filter(s => s.project_id === p.id);
      const suggestedByReq = {};
      suggested.forEach(s => { if (!suggestedByReq[s.requirement_id]) suggestedByReq[s.requirement_id] = []; suggestedByReq[s.requirement_id].push(s); });

      const completed = reqs.filter(r => {
        const sel = sels.find(s => s.requirement_id === r.id);
        return sel && DONE.includes(sel.status);
      }).length;
      const overdue = reqs.filter(r => {
        if (!r.due_date) return false;
        const sel = sels.find(s => s.requirement_id === r.id);
        if (sel && DONE.includes(sel.status)) return false;
        return new Date(r.due_date) < new Date();
      }).length;
      const pendingCustomer = reqs.filter(r => ["Not Started", "Viewed", "In Progress", "Revision Requested"].includes(r.status)).length;
      const pendingApproval = sels.filter(s => s.status === "Pending").length;
      const missingSuggested = reqs.filter(r =>
        (r.customer_catalogue_access_mode || "suggested_only") === "suggested_only" &&
        !(suggestedByReq[r.id] || []).length && !DONE.includes(r.status)
      ).length;

      const invs = invitations.filter(i => (i.project_ids || []).includes(p.id));
      const customerInvited = invs.length > 0 && invs.some(i => ["Account created", "Active"].includes(i.status));
      const lastActivity = sels.length > 0 ? sels.sort((a, b) => new Date(b.updated_date || 0) - new Date(a.updated_date || 0))[0].updated_date : null;
      const nextDue = reqs.filter(r => r.due_date && !DONE.includes(r.status)).sort((a, b) => new Date(a.due_date) - new Date(b.due_date))[0]?.due_date;

      stats[p.id] = { total: reqs.length, completed, overdue, pendingCustomer, pendingApproval, missingSuggested, customerInvited, lastActivity, nextDue, percent: reqs.length > 0 ? Math.round((completed / reqs.length) * 100) : 0 };
    });
    return stats;
  }, [projects, requirements, selections, suggestedOptions, invitations]);

  const filtered = projects.filter(p => {
    const matchesSearch = !search || p.name?.toLowerCase().includes(search.toLowerCase()) || p.client_name?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <p className="text-sm text-gray-500 mt-1">{projects.length} projects total</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-2">
          <Plus size={16} /> New Project
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input placeholder="Search projects..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {PROJECT_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-gray-200 border-t-gray-800 rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-gray-400 text-sm">No projects found</p>
          <p className="text-gray-400 text-xs mt-1">Create your first project, then invite the customer and add areas.</p>
          <Button variant="outline" className="mt-4" onClick={() => setShowCreate(true)}>Create your first project</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(p => {
            const s = projectStats[p.id] || {};
            return (
              <div key={p.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow group flex flex-col">
                <div className="flex items-start justify-between mb-3">
                  <div className="min-w-0">
                    <Link to={`/projects/${p.id}`}><h3 className="font-semibold text-gray-900 group-hover:text-blue-600 truncate">{p.name}</h3></Link>
                    <p className="text-sm text-gray-500 mt-0.5">{p.client_name || "No client assigned"}</p>
                  </div>
                  <StatusBadge status={p.status} />
                </div>
                {p.address && <p className="text-xs text-gray-400 mb-3 truncate">{p.address}</p>}

                <div className="flex items-center gap-3 mb-3">
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-gray-500">{s.completed || 0}/{s.total || 0} selections</span>
                      <span className="font-medium text-gray-700">{s.percent || 0}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${s.percent || 0}%` }} />
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mb-3 text-xs">
                  {s.overdue > 0 && <span className="flex items-center gap-1 text-red-600 bg-red-50 px-1.5 py-0.5 rounded"><AlertTriangle size={10} /> {s.overdue} overdue</span>}
                  {s.pendingApproval > 0 && <span className="flex items-center gap-1 text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded"><Clock size={10} /> {s.pendingApproval} to approve</span>}
                  {s.pendingCustomer > 0 && <span className="flex items-center gap-1 text-sky-600 bg-sky-50 px-1.5 py-0.5 rounded"><Clock size={10} /> {s.pendingCustomer} waiting</span>}
                  {s.missingSuggested > 0 && <span className="flex items-center gap-1 text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded"><Star size={10} /> {s.missingSuggested} no options</span>}
                  <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${s.customerInvited ? "text-emerald-600 bg-emerald-50" : "text-gray-500 bg-gray-50"}`}>
                    {s.customerInvited ? <><CheckCircle size={10} /> Invited</> : <><UserPlus size={10} /> Not invited</>}
                  </span>
                </div>

                {(s.nextDue || s.lastActivity) && (
                  <div className="flex items-center gap-3 text-xs text-gray-400 mb-3">
                    {s.nextDue && <span>Next due: <span className={s.overdue > 0 ? "text-red-500 font-medium" : ""}>{s.nextDue}</span></span>}
                    {s.lastActivity && <span>Last activity: {new Date(s.lastActivity).toLocaleDateString()}</span>}
                  </div>
                )}

                <div className="flex flex-wrap gap-1.5 mt-auto pt-2 border-t border-gray-50">
                  <Link to={`/projects/${p.id}`} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-900 text-white text-xs font-medium hover:bg-gray-800">
                    <ExternalLink size={12} /> Open
                  </Link>
                  <Link to={`/selections-tracker?project=${p.id}`} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50">
                    <ClipboardCheck size={12} /> Selections
                  </Link>
                  {!s.customerInvited && (
                    <Link to={`/projects/${p.id}`} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50">
                      <UserPlus size={12} /> Invite
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <CreateProjectDialog open={showCreate} onClose={() => setShowCreate(false)} onCreated={(p) => { setShowCreate(false); navigate(`/projects/${p.id}`); }} />
    </div>
  );
}

function CreateProjectDialog({ open, onClose, onCreated }) {
  const [form, setForm] = useState({ name: "", client_name: "", address: "", project_type: "Renovation", status: "Draft", total_allowance: 0 });
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    if (!form.name.trim()) return;
    setSaving(true);
    const p = await base44.entities.Project.create(form);
    setSaving(false);
    onCreated(p);
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>New Project</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div><Label>Project Name *</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
          <div><Label>Client Name</Label><Input value={form.client_name} onChange={e => setForm({...form, client_name: e.target.value})} /></div>
          <div><Label>Address</Label><Input value={form.address} onChange={e => setForm({...form, address: e.target.value})} /></div>
          <div><Label>Project Type</Label>
            <Select value={form.project_type} onValueChange={v => setForm({...form, project_type: v})}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["Renovation", "New Build", "Addition", "Commercial", "Other"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Total Allowance ($)</Label><Input type="number" value={form.total_allowance} onChange={e => setForm({...form, total_allowance: Number(e.target.value)})} /></div>
          <Button onClick={handleCreate} disabled={saving || !form.name.trim()} className="w-full">{saving ? "Creating..." : "Create Project"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}