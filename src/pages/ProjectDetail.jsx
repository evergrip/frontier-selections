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

export default function ProjectDetail() {
  const { projectId } = useParams();
  const [project, setProject] = useState(null);
  const [areas, setAreas] = useState([]);
  const [requirements, setRequirements] = useState([]);
  const [selections, setSelections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddArea, setShowAddArea] = useState(false);
  const [showEditProject, setShowEditProject] = useState(false);

  useEffect(() => { load(); }, [projectId]);

  async function load() {
    setLoading(true);
    const [p, a, r, s] = await Promise.all([
      base44.entities.Project.get(projectId),
      base44.entities.ProjectArea.filter({ project_id: projectId }),
      base44.entities.SelectionRequirement.filter({ project_id: projectId }),
      base44.entities.CustomerSelection.filter({ project_id: projectId })
    ]);
    setProject(p);
    setAreas(a.sort((x, y) => (x.display_order || 0) - (y.display_order || 0)));
    setRequirements(r);
    setSelections(s);
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
        <Button variant="outline" size="sm" onClick={() => setShowEditProject(true)} className="gap-2">
          <Settings size={14} /> Settings
        </Button>
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
          <SelectionsTable requirements={requirements} selections={selections} areas={areas} projectId={projectId} />
        </TabsContent>

        <TabsContent value="details" className="mt-6">
          <ProjectDetailsCard project={project} onUpdate={load} />
        </TabsContent>
        <TabsContent value="communication" className="mt-6 space-y-4">
          <ProjectTimeline projectId={projectId} staff={true} />
          <CommentThread projectId={projectId} targetType="project" targetId={projectId} staff={true} title="Project Comments" />
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

function SelectionsTable({ requirements, selections, areas, projectId }) {
  if (requirements.length === 0) {
    return <div className="text-center py-16 text-gray-400 text-sm">No selection requirements yet</div>;
  }
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Selection</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Area</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Category</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Due</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">Allowance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {requirements.map(req => {
              const area = areas.find(a => a.id === req.area_id);
              const sel = selections.find(s => s.requirement_id === req.id && s.is_current);
              return (
                <tr key={req.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link to={`/projects/${projectId}/area/${req.area_id}/requirement/${req.id}`} className="font-medium text-gray-900 hover:text-blue-600">
                      {req.name}
                    </Link>
                    {req.is_required && <span className="ml-2 text-[10px] text-red-500 font-medium">REQUIRED</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{area?.name || "—"}</td>
                  <td className="px-4 py-3 text-gray-500">{req.category || "—"}</td>
                  <td className="px-4 py-3"><StatusBadge status={req.status} /></td>
                  <td className="px-4 py-3 text-gray-500">{req.due_date || "—"}</td>
                  <td className="px-4 py-3 text-right text-gray-500">{req.allowance_amount ? `$${req.allowance_amount.toLocaleString()}` : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
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