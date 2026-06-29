import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Search, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import StatusBadge from "@/components/ui/StatusBadge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { PROJECT_STATUSES } from "@/lib/constants";

export default function Projects() {
  const [projects, setProjects] = useState([]);
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
    const data = await base44.entities.Project.list("-updated_date", 100);
    setProjects(data);
    setLoading(false);
  }

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
          <Button variant="outline" className="mt-4" onClick={() => setShowCreate(true)}>Create your first project</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(p => (
            <Link key={p.id} to={`/projects/${p.id}`} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow group">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900 group-hover:text-gray-700">{p.name}</h3>
                  <p className="text-sm text-gray-500 mt-0.5">{p.client_name || "No client assigned"}</p>
                </div>
                <StatusBadge status={p.status} />
              </div>
              {p.address && <p className="text-xs text-gray-400 mb-3">{p.address}</p>}
              <div className="flex items-center gap-4 text-xs text-gray-400">
                {p.project_type && <span>{p.project_type}</span>}
                {p.start_date && <span>Start: {p.start_date}</span>}
              </div>
            </Link>
          ))}
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