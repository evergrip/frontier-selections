import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useParams, Link } from "react-router-dom";
import { toast } from "@/components/ui/use-toast";
import { ArrowLeft, Plus, Edit2, Trash2, FileSignature, Lock, Star, Clock, AlertTriangle, Package, User, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import StatusBadge from "@/components/ui/StatusBadge";
import CommentThread from "@/components/comments/CommentThread";
import NextActionPanel from "@/components/staff/NextActionPanel";
import { CATEGORIES, SELECTION_STATUSES, CATALOGUE_ACCESS_MODES } from "@/lib/constants";

const DONE = ["Approved", "Locked", "Ready to Order", "Ordered", "Received", "Installed"];

export default function AreaDetail() {
  const { projectId, areaId } = useParams();
  const [area, setArea] = useState(null);
  const [requirements, setRequirements] = useState([]);
  const [selections, setSelections] = useState([]);
  const [suggestedOptions, setSuggestedOptions] = useState([]);
  const [procurement, setProcurement] = useState([]);
  const [catalogueItems, setCatalogueItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddReq, setShowAddReq] = useState(false);
  const [showEditAllowance, setShowEditAllowance] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);

  useEffect(() => { load(); }, [areaId]);

  async function bulkAction(action) {
    if (bulkBusy) return;
    setBulkBusy(true);
    try {
      const res = await base44.functions.invoke("selectionWorkflow", { action, project_id: projectId, area_id: areaId });
      if (res.data?.error) throw new Error(res.data.error);
      const count = res.data?.count || 0;
      toast({ title: action === "request_signoff" ? "Sign-off requested" : "Selections locked", description: `${count} selection(s) ${action === "request_signoff" ? "have sign-off requested" : "are now locked"}.` });
      window.dispatchEvent(new Event("frontier:data-updated"));
      load();
    } catch (e) {
      toast({ title: "Action failed", description: e.message || "Unknown error", variant: "destructive" });
    }
    setBulkBusy(false);
  }

  async function load() {
    setLoading(true);
    const [a, r, s, paci, proc, ci] = await Promise.all([
      base44.entities.ProjectArea.get(areaId),
      base44.entities.SelectionRequirement.filter({ area_id: areaId }),
      base44.entities.CustomerSelection.filter({ area_id: areaId }),
      base44.entities.ProjectAvailableCatalogueItem.filter({ area_id: areaId }),
      base44.entities.ProcurementItem.filter({ area_id: areaId }),
      base44.entities.CatalogueItem.list("name", 500)
    ]);
    setArea(a);
    setRequirements(r);
    setSelections(s);
    setSuggestedOptions(paci);
    setProcurement(proc);
    setCatalogueItems(ci);
    setLoading(false);
  }

  const areaActions = [];
  const pendingSel = selections.filter(s => s.is_current && s.status === "Pending");
  const missingReqs = requirements.filter(r => !selections.find(s => s.requirement_id === r.id && s.is_current) && !["Approved", "Locked", "Ready to Order", "Ordered", "Received", "Installed"].includes(r.status));
  if (pendingSel.length > 0) {
    const s = pendingSel[0];
    const r = requirements.find(req => req.id === s.requirement_id);
    areaActions.push({ label: `Review submitted selection: "${r?.name || "Selection"}"`, to: r ? `/projects/${projectId}/area/${areaId}/requirement/${r.id}` : "#", priority: "high", buttonLabel: "Review" });
  }
  if (missingReqs.length > 0) {
    areaActions.push({ label: `${missingReqs.length} requirement(s) need selections`, to: "#", priority: "medium", buttonLabel: "View below", description: missingReqs.map(r => r.name).slice(0, 3).join(", ") });
  }

  if (loading) return <div className="flex items-center justify-center h-96"><div className="w-8 h-8 border-4 border-gray-200 border-t-gray-800 rounded-full animate-spin" /></div>;
  if (!area) return <div className="p-8 text-center text-gray-400">Area not found</div>;

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center gap-3">
        <Link to={`/projects/${projectId}`} className="p-2 rounded-lg hover:bg-gray-100"><ArrowLeft size={18} /></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{area.name}</h1>
          <p className="text-sm text-gray-500">{area.area_type} • {area.allowance ? `$${area.allowance.toLocaleString()} allowance` : "No allowance set"}</p>
        </div>
        <StatusBadge status={area.status} />
        <Button variant="outline" size="sm" onClick={() => setShowEditAllowance(true)} className="gap-2"><Edit2 size={14} /> Edit Area</Button>
      </div>

      {area.customer_notes && (
        <div className="bg-blue-50 rounded-xl p-4 text-sm text-blue-800">{area.customer_notes}</div>
      )}

      {areaActions.length > 0 && <NextActionPanel actions={areaActions} />}

      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-semibold text-gray-900">Selection Requirements ({requirements.length})</h2>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" disabled={bulkBusy} onClick={() => bulkAction("request_signoff")} className="gap-2"><FileSignature size={14} /> Request Sign-off (All)</Button>
          <Button size="sm" variant="outline" disabled={bulkBusy} onClick={() => bulkAction("lock")} className="gap-2"><Lock size={14} /> Lock Signed-off (All)</Button>
          <Button size="sm" onClick={() => setShowAddReq(true)} className="gap-2"><Plus size={14} /> Add Requirement</Button>
        </div>
      </div>

      {requirements.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <p className="text-gray-400 text-sm">No selection requirements yet</p>
          <Button variant="outline" className="mt-3" onClick={() => setShowAddReq(true)}>Add first requirement</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {requirements.map(req => {
            const sel = selections.find(s => s.requirement_id === req.id && s.is_current);
            const cat = sel ? catalogueItems.find(c => c.id === sel.catalogue_item_id) : null;
            const suggested = suggestedOptions.filter(s => s.requirement_id === req.id);
            const proc = procurement.find(p => p.requirement_id === req.id);
            const isOverdue = req.due_date && !DONE.includes(req.status) && new Date(req.due_date + "T00:00:00") < new Date();
            const needsStaff = sel?.status === "Pending" || (!sel && suggested.length === 0 && (req.customer_catalogue_access_mode || "suggested_only") === "suggested_only");
            const waitingCustomer = !sel && suggested.length > 0 && ["Not Started", "Viewed", "In Progress", "Revision Requested"].includes(req.status);
            const variance = sel ? ((sel.over_allowance || 0) > 0 ? `+$${sel.over_allowance.toLocaleString()}` : (sel.under_allowance || 0) > 0 ? `-$${sel.under_allowance.toLocaleString()}` : null) : null;
            return (
              <Link
                key={req.id}
                to={`/projects/${projectId}/area/${areaId}/requirement/${req.id}`}
                className={`flex items-start justify-between bg-white rounded-xl border p-4 hover:shadow-md transition-shadow ${isOverdue ? "border-red-200 bg-red-50/30" : "border-gray-200"}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-medium text-gray-900">{req.name}</h3>
                    {req.is_required && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-medium">REQUIRED</span>}
                    {needsStaff && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium flex items-center gap-0.5"><User size={9} /> Needs Staff</span>}
                    {waitingCustomer && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium flex items-center gap-0.5"><Clock size={9} /> Waiting on Customer</span>}
                    {isOverdue && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-medium flex items-center gap-0.5"><AlertTriangle size={9} /> Overdue</span>}
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500 flex-wrap">
                    <span>{req.category}</span>
                    {req.due_date && <span>Due: {req.due_date}</span>}
                    {req.allowance_amount > 0 && <span>${req.allowance_amount.toLocaleString()}</span>}
                    {cat && <span className="text-gray-700">• {cat.name}</span>}
                    {suggested.length > 0 && <span className="flex items-center gap-0.5"><Star size={10} /> {suggested.length} suggested</span>}
                    {suggested.length === 0 && (req.customer_catalogue_access_mode || "suggested_only") === "suggested_only" && !DONE.includes(req.status) && <span className="text-red-500 flex items-center gap-0.5"><Star size={10} /> No suggestions</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {sel && <StatusBadge status={sel.status} />}
                    {sel?.sign_off_requested && !sel?.signed_off && <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded flex items-center gap-0.5"><FileSignature size={9} /> Sign-off requested</span>}
                    {sel?.signed_off && <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded flex items-center gap-0.5"><CheckCircle size={9} /> Signed off</span>}
                    {sel?.locked && <span className="text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded flex items-center gap-0.5"><Lock size={9} /> Locked</span>}
                    {proc && <StatusBadge status={proc.status} />}
                    {variance && <span className={`text-xs font-medium ${sel.over_allowance > 0 ? "text-red-600" : "text-green-600"}`}>{variance}</span>}
                  </div>
                </div>
                <StatusBadge status={req.status} />
              </Link>
            );
          })}
        </div>
      )}

      <CommentThread projectId={projectId} targetType="area" targetId={areaId} staff={true} title="Area Comments" />

      <AddRequirementDialog open={showAddReq} onClose={() => setShowAddReq(false)} projectId={projectId} areaId={areaId} onAdded={load} />
      <EditAllowanceDialog open={showEditAllowance} onClose={() => setShowEditAllowance(false)} area={area} onUpdated={load} />
    </div>
  );
}

function AddRequirementDialog({ open, onClose, projectId, areaId, onAdded }) {
  const [form, setForm] = useState({ name: "", category: "Other", is_required: true, allowance_amount: 0, approval_required: true, due_date: "", customer_catalogue_access_mode: "suggested_only" });
  const [saving, setSaving] = useState(false);

  async function handleAdd() {
    if (!form.name.trim()) return;
    if (saving) return;
    setSaving(true);
    try {
      await base44.functions.invoke("selectionWorkflow", {
        action: "create_requirement",
        project_id: projectId, area_id: areaId,
        name: form.name, category: form.category, is_required: form.is_required,
        allowance_amount: form.allowance_amount, approval_required: form.approval_required,
        due_date: form.due_date, customer_catalogue_access_mode: form.customer_catalogue_access_mode
      });
      toast({ title: "Requirement created", description: `"${form.name}" has been added.` });
      window.dispatchEvent(new Event("frontier:data-updated"));
      setForm({ name: "", category: "Other", is_required: true, allowance_amount: 0, approval_required: true, due_date: "", customer_catalogue_access_mode: "suggested_only" });
      onAdded();
      onClose();
    } catch (e) {
      toast({ title: "Failed to create requirement", description: e.response?.data?.error || e.message || "Unknown error", variant: "destructive" });
    }
    setSaving(false);
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Add Selection Requirement</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div><Label>Selection Name *</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
          <div><Label>Category</Label>
            <Select value={form.category} onValueChange={v => setForm({...form, category: v})}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Allowance ($)</Label><Input type="number" value={form.allowance_amount} onChange={e => setForm({...form, allowance_amount: e.target.value})} /></div>
          <div><Label>Due Date</Label><Input type="date" value={form.due_date} onChange={e => setForm({...form, due_date: e.target.value})} /></div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_required} onChange={e => setForm({...form, is_required: e.target.checked})} className="rounded" />
            Required selection
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.approval_required} onChange={e => setForm({...form, approval_required: e.target.checked})} className="rounded" />
            Approval required
          </label>
          <div><Label>Customer Catalogue Access Mode</Label>
            <Select value={form.customer_catalogue_access_mode} onValueChange={v => setForm({...form, customer_catalogue_access_mode: v})}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CATALOGUE_ACCESS_MODES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button onClick={handleAdd} disabled={saving || !form.name.trim()} className="w-full">{saving ? "Adding..." : "Add Requirement"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditAllowanceDialog({ open, onClose, area, onUpdated }) {
  const [allowance, setAllowance] = useState(0);
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (area) { setAllowance(area.allowance || 0); setDueDate(area.due_date || ""); } }, [area]);
  async function handleSave() {
    if (saving) return;
    setSaving(true);
    try {
      await base44.functions.invoke("selectionWorkflow", {
        action: "update_area",
        area_id: area.id, allowance: Number(allowance) || 0, due_date: dueDate || null
      });
      toast({ title: "Area updated" });
      window.dispatchEvent(new Event("frontier:data-updated"));
      onUpdated();
      onClose();
    } catch (e) {
      toast({ title: "Failed to save", description: e.response?.data?.error || e.message || "Unknown error", variant: "destructive" });
    }
    setSaving(false);
  }
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>Edit Area</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div><Label>Allowance ($)</Label><Input type="number" value={allowance} onChange={e => setAllowance(e.target.value)} /></div>
          <div><Label>Selections Due Date</Label><Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} /></div>
          <Button onClick={handleSave} disabled={saving} className="w-full">{saving ? "Saving..." : "Save"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}