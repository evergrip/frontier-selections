import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Plus, Settings, MapPin, Calendar, DollarSign, Edit2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import StatusBadge from "@/components/ui/StatusBadge";
import CommentThread from "@/components/comments/CommentThread";
import ProjectTimeline from "@/components/comments/ProjectTimeline";
import { PROJECT_STATUSES, AREA_TYPES, DEFAULT_TEMPLATES } from "@/lib/constants";
import AreaCard from "@/components/staff/AreaCard";
import ContextualHelpLink from "@/components/training/ContextualHelpLink";
import ProjectCustomerAccess from "@/components/ProjectCustomerAccess";

export default function ProjectDetail() {
  const { projectId } = useParams();
  const [project, setProject] = useState(null);
  const [areas, setAreas] = useState([]);
  const [requirements, setRequirements] = useState([]);
  const [selections, setSelections] = useState([]);
  const [suggestedOptions, setSuggestedOptions] = useState([]);
  const [procurement, setProcurement] = useState([]);
  const [catalogueItems, setCatalogueItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddArea, setShowAddArea] = useState(false);
  const [showEditProject, setShowEditProject] = useState(false);

  useEffect(() => { load(); }, [projectId]);

  async function load() {
    setLoading(true);
    const [p, a, r, s, paci, proc, ci] = await Promise.all([
      base44.entities.Project.get(projectId),
      base44.entities.ProjectArea.filter({ project_id: projectId }),
      base44.entities.SelectionRequirement.filter({ project_id: projectId }),
      base44.entities.CustomerSelection.filter({ project_id: projectId }),
      base44.entities.ProjectAvailableCatalogueItem.filter({ project_id: projectId }),
      base44.entities.ProcurementItem.filter({ project_id: projectId }),
      base44.entities.CatalogueItem.list("name", 500)
    ]);
    setProject(p);
    setAreas(a.sort((x, y) => (x.display_order || 0) - (y.display_order || 0)));
    setRequirements(r);
    setSelections(s);
    setSuggestedOptions(paci);
    setProcurement(proc);
    setCatalogueItems(ci);
    setLoading(false);
  }

  if (loading) {
    return <div className="flex items-center justify-center h-96"><div className="w-8 h-8 border-4 border-gray-200 border-t-gray-800 rounded-full animate-spin" /></div>;
  }
  if (!project) {
    return <div className="p-8 text-center text-gray-400">Project not found</div>;
  }

  const totalSelected = selections.filter(s => s.is_current && s.status === "Approved").reduce((sum, s) => sum + (s.calculated_price || 0), 0);
  const pendingCount = selections.filter(s => s.is_current && s.status === "Pending").length;
  const approvedCount = selections.filter(s => s.is_current && s.status === "Approved").length;
  const totalReqs = requirements.length;
  const completedReqs = requirements.filter(r => ["Approved", "Locked", "Ready to Order", "Ordered", "Received", "Installed"].includes(r.status)).length;

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/projects" className="p-2 rounded-lg hover:bg-gray-100"><ArrowLeft size={18} /></Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
            <StatusBadge status={project.status} />
          </div>
          <p className="text-sm text-gray-500 mt-0.5">{project.client_name}{project.address ? ` • ${project.address}` : ""}</p>
        </div>
        <div className="flex items-center gap-3">
          <ContextualHelpLink category="Allowances" label="How allowances and overages are calculated" />
          <Button variant="outline" size="sm" onClick={() => setShowEditProject(true)} className="gap-2">
            <Settings size={14} /> Settings
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <MiniStat label="Areas" value={areas.length} />
        <MiniStat label="Selections" value={`${completedReqs}/${totalReqs}`} />
        <MiniStat label="Pending" value={pendingCount} />
        <MiniStat label="Allowance" value={`$${(project.total_allowance || 0).toLocaleString()}`} />
      </div>

      <Tabs defaultValue="areas">
        <TabsList>
          <TabsTrigger value="areas">Areas & Rooms</TabsTrigger>
          <TabsTrigger value="selections">All Selections</TabsTrigger>
          <TabsTrigger value="details">Project Details</TabsTrigger>
          <TabsTrigger value="communication">Communication</TabsTrigger>
          <TabsTrigger value="customers">Customer Access</TabsTrigger>
        </TabsList>

        <TabsContent value="areas" className="mt-6 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="font-semibold text-gray-900">Areas / Rooms</h2>
            <Button size="sm" onClick={() => setShowAddArea(true)} className="gap-2"><Plus size={14} /> Add Area</Button>
          </div>
          {areas.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
              <p className="text-gray-400 text-sm">No areas added yet</p>
              <Button variant="outline" className="mt-3" onClick={() => setShowAddArea(true)}>Add first area</Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {areas.map(area => (
                <AreaCard
                  key={area.id}
                  area={area}
                  requirements={requirements.filter(r => r.area_id === area.id)}
                  selections={selections.filter(s => s.area_id === area.id && s.is_current)}
                  projectId={projectId}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="selections" className="mt-6">
          <SelectionsTable requirements={requirements} selections={selections} areas={areas} projectId={projectId} suggestedOptions={suggestedOptions} procurement={procurement} catalogueItems={catalogueItems} />
        </TabsContent>

        <TabsContent value="details" className="mt-6">
          <ProjectDetailsCard project={project} onUpdate={load} />
        </TabsContent>
        <TabsContent value="communication" className="mt-6 space-y-4">
          <ProjectTimeline projectId={projectId} staff={true} />
          <CommentThread projectId={projectId} targetType="project" targetId={projectId} staff={true} title="Project Comments" />
        </TabsContent>

        <TabsContent value="customers" className="mt-6">
          <ProjectCustomerAccess project={project} onUpdated={load} />
        </TabsContent>
      </Tabs>

      <AddAreaDialog open={showAddArea} onClose={() => setShowAddArea(false)} projectId={projectId} onAdded={load} />
      <EditProjectDialog open={showEditProject} onClose={() => setShowEditProject(false)} project={project} onUpdated={load} />
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
      <p className="text-lg font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}

function SelectionsTable({ requirements, selections, areas, projectId, suggestedOptions, procurement, catalogueItems }) {
  const [filter, setFilter] = useState("all");
  const TODAY = new Date(); TODAY.setHours(0, 0, 0, 0);
  const DONE = ["Approved", "Locked", "Ready to Order", "Ordered", "Received", "Installed"];

  const catMap = {}; (catalogueItems || []).forEach(c => catMap[c.id] = c);
  const procMap = {}; (procurement || []).forEach(p => procMap[p.requirement_id] = p);
  const suggestedByReq = {}; (suggestedOptions || []).forEach(s => {
    if (!suggestedByReq[s.requirement_id]) suggestedByReq[s.requirement_id] = [];
    suggestedByReq[s.requirement_id].push(s);
  });

  if (requirements.length === 0) {
    return <div className="text-center py-16 text-gray-400 text-sm">No selection requirements yet</div>;
  }

  const rows = requirements.map(req => {
    const area = areas.find(a => a.id === req.area_id);
    const sel = selections.find(s => s.requirement_id === req.id && s.is_current);
    const cat = sel ? catMap[sel.catalogue_item_id] : null;
    const proc = procMap[req.id];
    const suggested = suggestedByReq[req.id] || [];
    const isOverdue = req.due_date && !DONE.includes(req.status) && new Date(req.due_date + "T00:00:00") < TODAY;
    const overAllowance = sel && (sel.over_allowance || 0) > 0;
    const missingSuggested = (req.customer_catalogue_access_mode || "suggested_only") === "suggested_only" && suggested.length === 0 && !DONE.includes(req.status);
    return { req, area, sel, cat, proc, suggested, isOverdue, overAllowance, missingSuggested };
  });

  const filtered = rows.filter(row => {
    if (filter === "all") return true;
    if (filter === "outstanding") return !DONE.includes(row.req.status);
    if (filter === "pending_customer") return ["Not Started", "Viewed", "In Progress", "Revision Requested"].includes(row.req.status);
    if (filter === "pending_approval") return row.sel?.status === "Pending";
    if (filter === "approved") return row.req.status === "Approved";
    if (filter === "overdue") return row.isOverdue;
    if (filter === "over_allowance") return row.overAllowance;
    if (filter === "ready_to_order") return row.req.status === "Ready to Order";
    if (filter === "ordered") return row.req.status === "Ordered";
    if (filter === "installed") return row.req.status === "Installed";
    if (filter === "missing_suggested") return row.missingSuggested;
    return true;
  });

  const filters = [
    { value: "all", label: "All" },
    { value: "outstanding", label: "Outstanding" },
    { value: "pending_customer", label: "Pending Customer" },
    { value: "pending_approval", label: "Pending Approval" },
    { value: "approved", label: "Approved" },
    { value: "overdue", label: "Overdue" },
    { value: "over_allowance", label: "Over Allowance" },
    { value: "ready_to_order", label: "Ready to Order" },
    { value: "ordered", label: "Ordered" },
    { value: "installed", label: "Installed" },
    { value: "missing_suggested", label: "Missing Suggested" }
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {filters.map(f => (
          <button key={f.value} onClick={() => setFilter(f.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === f.value ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
            {f.label}
          </button>
        ))}
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-3 py-3 font-medium text-gray-500 whitespace-nowrap">Area</th>
                <th className="text-left px-3 py-3 font-medium text-gray-500 whitespace-nowrap">Requirement</th>
                <th className="text-left px-3 py-3 font-medium text-gray-500 whitespace-nowrap">Req.</th>
                <th className="text-left px-3 py-3 font-medium text-gray-500 whitespace-nowrap">Due</th>
                <th className="text-left px-3 py-3 font-medium text-gray-500 whitespace-nowrap">Status</th>
                <th className="text-left px-3 py-3 font-medium text-gray-500 whitespace-nowrap">Selected Item</th>
                <th className="text-left px-3 py-3 font-medium text-gray-500 whitespace-nowrap">Options</th>
                <th className="text-right px-3 py-3 font-medium text-gray-500 whitespace-nowrap">Allowance</th>
                <th className="text-right px-3 py-3 font-medium text-gray-500 whitespace-nowrap">Price</th>
                <th className="text-right px-3 py-3 font-medium text-gray-500 whitespace-nowrap">Over/Credit</th>
                <th className="text-left px-3 py-3 font-medium text-gray-500 whitespace-nowrap">Approval</th>
                <th className="text-left px-3 py-3 font-medium text-gray-500 whitespace-nowrap">Procurement</th>
                <th className="text-center px-3 py-3 font-medium text-gray-500 whitespace-nowrap">Suggested</th>
                <th className="text-left px-3 py-3 font-medium text-gray-500 whitespace-nowrap">Updated</th>
                <th className="text-center px-3 py-3 font-medium text-gray-500 whitespace-nowrap"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr><td colSpan={15} className="px-4 py-10 text-center text-gray-400">No selections match this filter</td></tr>
              ) : filtered.map(row => (
                <tr key={row.req.id} className={`hover:bg-gray-50 ${row.isOverdue ? "bg-red-50/30" : ""}`}>
                  <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{row.area?.name || "—"}</td>
                  <td className="px-3 py-2.5">
                    <Link to={`/projects/${projectId}/area/${row.req.area_id}/requirement/${row.req.id}`} className="font-medium text-gray-900 hover:text-blue-600">
                      {row.req.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5">{row.req.is_required ? <span className="text-[10px] text-red-500 font-medium">REQ</span> : <span className="text-[10px] text-gray-400">OPT</span>}</td>
                  <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">
                    {row.req.due_date ? <span className={row.isOverdue ? "text-red-600 font-medium" : ""}>{row.req.due_date}</span> : "—"}
                  </td>
                  <td className="px-3 py-2.5"><StatusBadge status={row.req.status} /></td>
                  <td className="px-3 py-2.5 text-gray-700 whitespace-nowrap">{row.cat?.name || "—"}</td>
                  <td className="px-3 py-2.5 text-gray-500 text-xs">
                    {(row.sel?.selected_options || []).map(o => o.option_name).join(", ") || "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right text-gray-500 whitespace-nowrap">{row.req.allowance_amount ? `$${row.req.allowance_amount.toLocaleString()}` : "—"}</td>
                  <td className="px-3 py-2.5 text-right text-gray-700 whitespace-nowrap">{row.sel?.calculated_price ? `$${row.sel.calculated_price.toLocaleString()}` : "—"}</td>
                  <td className="px-3 py-2.5 text-right whitespace-nowrap">
                    {row.sel?.over_allowance > 0 ? <span className="text-red-600">+$${row.sel.over_allowance.toLocaleString()}</span> :
                     row.sel?.under_allowance > 0 ? <span className="text-green-600">-$${row.sel.under_allowance.toLocaleString()}</span> : "—"}
                  </td>
                  <td className="px-3 py-2.5">{row.sel ? <StatusBadge status={row.sel.status} /> : <span className="text-gray-400 text-xs">—</span>}</td>
                  <td className="px-3 py-2.5">{row.proc ? <StatusBadge status={row.proc.status} /> : <span className="text-gray-400 text-xs">—</span>}</td>
                  <td className="px-3 py-2.5 text-center">
                    {row.suggested.length > 0 ? <span className="text-xs text-gray-600">{row.suggested.length}</span> :
                     row.missingSuggested ? <span className="text-xs text-red-500">⚠</span> : <span className="text-gray-400 text-xs">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-gray-400 text-xs whitespace-nowrap">{row.sel?.updated_date ? new Date(row.sel.updated_date).toLocaleDateString() : row.req.updated_date ? new Date(row.req.updated_date).toLocaleDateString() : "—"}</td>
                  <td className="px-3 py-2.5 text-center">
                    <Link to={`/projects/${projectId}/area/${row.req.area_id}/requirement/${row.req.id}`} className="text-blue-600 hover:text-blue-800 text-xs font-medium">Open →</Link>
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

function ProjectDetailsCard({ project, onUpdate }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
      <h3 className="font-semibold text-gray-900">Project Information</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
        <div><span className="text-gray-500">Type:</span> <span className="ml-2 text-gray-900">{project.project_type || "—"}</span></div>
        <div><span className="text-gray-500">Status:</span> <span className="ml-2"><StatusBadge status={project.status} /></span></div>
        <div><span className="text-gray-500">Start Date:</span> <span className="ml-2 text-gray-900">{project.start_date || "—"}</span></div>
        <div><span className="text-gray-500">Target Completion:</span> <span className="ml-2 text-gray-900">{project.target_completion_date || "—"}</span></div>
        <div><span className="text-gray-500">Total Allowance:</span> <span className="ml-2 text-gray-900">${(project.total_allowance || 0).toLocaleString()}</span></div>
        <div><span className="text-gray-500">Pricing Visibility:</span> <span className="ml-2 text-gray-900 capitalize">{(project.pricing_visibility || "hidden").replace(/_/g, " ")}</span></div>
      </div>
      {project.internal_notes && (
        <div><p className="text-xs text-gray-400 mb-1">Internal Notes</p><p className="text-sm text-gray-700 bg-yellow-50 p-3 rounded-lg">{project.internal_notes}</p></div>
      )}
      {project.customer_notes && (
        <div><p className="text-xs text-gray-400 mb-1">Customer Notes</p><p className="text-sm text-gray-700 bg-blue-50 p-3 rounded-lg">{project.customer_notes}</p></div>
      )}
    </div>
  );
}

function AddAreaDialog({ open, onClose, projectId, onAdded }) {
  const [name, setName] = useState("");
  const [areaType, setAreaType] = useState("Kitchen");
  const [allowance, setAllowance] = useState(0);
  const [useTemplate, setUseTemplate] = useState(true);
  const [saving, setSaving] = useState(false);

  async function handleAdd() {
    if (!name.trim()) return;
    setSaving(true);
    const area = await base44.entities.ProjectArea.create({
      project_id: projectId, name, area_type: areaType, allowance: Number(allowance), status: "Not Started"
    });
    if (useTemplate && DEFAULT_TEMPLATES[areaType]) {
      const reqs = DEFAULT_TEMPLATES[areaType].map(t => ({
        project_id: projectId, area_id: area.id, name: t.name, category: t.category,
        is_required: t.required, status: "Not Started"
      }));
      await base44.entities.SelectionRequirement.bulkCreate(reqs);
    }
    setSaving(false);
    setName(""); setAllowance(0);
    onAdded();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Add Area / Room</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div><Label>Area Name *</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Main Bathroom" /></div>
          <div><Label>Area Type</Label>
            <Select value={areaType} onValueChange={v => { setAreaType(v); if (!name) setName(v); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{AREA_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Allowance ($)</Label><Input type="number" value={allowance} onChange={e => setAllowance(e.target.value)} /></div>
          {DEFAULT_TEMPLATES[areaType] && (
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input type="checkbox" checked={useTemplate} onChange={e => setUseTemplate(e.target.checked)} className="rounded border-gray-300" />
              Load default template ({DEFAULT_TEMPLATES[areaType].length} selections)
            </label>
          )}
          <Button onClick={handleAdd} disabled={saving || !name.trim()} className="w-full">{saving ? "Adding..." : "Add Area"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditProjectDialog({ open, onClose, project, onUpdated }) {
  const [form, setForm] = useState({});

  useEffect(() => {
    if (project) setForm({ ...project });
  }, [project]);

  async function handleSave() {
    await base44.entities.Project.update(project.id, {
      name: form.name, client_name: form.client_name, address: form.address,
      project_type: form.project_type, status: form.status,
      start_date: form.start_date, target_completion_date: form.target_completion_date,
      total_allowance: Number(form.total_allowance) || 0,
      selections_due_date: form.selections_due_date || null,
      pricing_visibility: form.pricing_visibility, allowance_visibility: form.allowance_visibility,
      internal_notes: form.internal_notes, customer_notes: form.customer_notes
    });
    onUpdated();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Project Settings</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div><Label>Name</Label><Input value={form.name || ""} onChange={e => setForm({...form, name: e.target.value})} /></div>
          <div><Label>Client Name</Label><Input value={form.client_name || ""} onChange={e => setForm({...form, client_name: e.target.value})} /></div>
          <div><Label>Address</Label><Input value={form.address || ""} onChange={e => setForm({...form, address: e.target.value})} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Type</Label>
              <Select value={form.project_type || "Renovation"} onValueChange={v => setForm({...form, project_type: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["Renovation", "New Build", "Addition", "Commercial", "Other"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Status</Label>
              <Select value={form.status || "Draft"} onValueChange={v => setForm({...form, status: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PROJECT_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Start Date</Label><Input type="date" value={form.start_date || ""} onChange={e => setForm({...form, start_date: e.target.value})} /></div>
            <div><Label>Target Completion</Label><Input type="date" value={form.target_completion_date || ""} onChange={e => setForm({...form, target_completion_date: e.target.value})} /></div>
          </div>
          <div><Label>Total Allowance ($)</Label><Input type="number" value={form.total_allowance || 0} onChange={e => setForm({...form, total_allowance: e.target.value})} /></div>
          <div><Label>Selections Due Date</Label><Input type="date" value={form.selections_due_date || ""} onChange={e => setForm({...form, selections_due_date: e.target.value})} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Pricing Visibility</Label>
              <Select value={form.pricing_visibility || "hidden"} onValueChange={v => setForm({...form, pricing_visibility: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="hidden">Hidden</SelectItem>
                  <SelectItem value="show_item_prices">Show Item Prices</SelectItem>
                  <SelectItem value="show_total_allowance">Show Total Allowance</SelectItem>
                  <SelectItem value="show_area_allowance">Show Area Allowance</SelectItem>
                  <SelectItem value="show_item_allowance">Show Item Allowance</SelectItem>
                  <SelectItem value="show_remaining_only">Show Remaining Only</SelectItem>
                  <SelectItem value="show_overage_only">Show Overage/Credit Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Allowance Visibility</Label>
              <Select value={form.allowance_visibility || "hidden"} onValueChange={v => setForm({...form, allowance_visibility: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="hidden">Hidden</SelectItem>
                  <SelectItem value="show_total">Show Total</SelectItem>
                  <SelectItem value="show_by_area">Show by Area</SelectItem>
                  <SelectItem value="show_by_item">Show by Item</SelectItem>
                  <SelectItem value="show_remaining">Show Remaining</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>Internal Notes</Label><Textarea value={form.internal_notes || ""} onChange={e => setForm({...form, internal_notes: e.target.value})} /></div>
          <div><Label>Customer Notes</Label><Textarea value={form.customer_notes || ""} onChange={e => setForm({...form, customer_notes: e.target.value})} /></div>
          <Button onClick={handleSave} className="w-full">Save Changes</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}