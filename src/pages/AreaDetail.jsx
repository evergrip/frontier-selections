import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Plus, Edit2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import StatusBadge from "@/components/ui/StatusBadge";
import CommentThread from "@/components/comments/CommentThread";
import { CATEGORIES, SELECTION_STATUSES } from "@/lib/constants";

export default function AreaDetail() {
  const { projectId, areaId } = useParams();
  const [area, setArea] = useState(null);
  const [requirements, setRequirements] = useState([]);
  const [selections, setSelections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddReq, setShowAddReq] = useState(false);
  const [showEditAllowance, setShowEditAllowance] = useState(false);

  useEffect(() => { load(); }, [areaId]);

  async function load() {
    setLoading(true);
    const [a, r, s] = await Promise.all([
      base44.entities.ProjectArea.get(areaId),
      base44.entities.SelectionRequirement.filter({ area_id: areaId }),
      base44.entities.CustomerSelection.filter({ area_id: areaId })
    ]);
    setArea(a);
    setRequirements(r);
    setSelections(s);
    setLoading(false);
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

      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-900">Selection Requirements ({requirements.length})</h2>
        <Button size="sm" onClick={() => setShowAddReq(true)} className="gap-2"><Plus size={14} /> Add Requirement</Button>
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
            return (
              <Link
                key={req.id}
                to={`/projects/${projectId}/area/${areaId}/requirement/${req.id}`}
                className="flex items-center justify-between bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-gray-900">{req.name}</h3>
                    {req.is_required && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-medium">REQUIRED</span>}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {req.category}{req.due_date ? ` • Due: ${req.due_date}` : ""}{req.allowance_amount ? ` • $${req.allowance_amount.toLocaleString()}` : ""}
                  </p>
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
  const [form, setForm] = useState({ name: "", category: "Other", is_required: true, allowance_amount: 0, approval_required: true, due_date: "" });
  const [saving, setSaving] = useState(false);

  async function handleAdd() {
    if (!form.name.trim()) return;
    setSaving(true);
    await base44.entities.SelectionRequirement.create({
      project_id: projectId, area_id: areaId, ...form,
      allowance_amount: Number(form.allowance_amount) || 0, status: "Not Started"
    });
    setSaving(false);
    setForm({ name: "", category: "Other", is_required: true, allowance_amount: 0, approval_required: true, due_date: "" });
    onAdded();
    onClose();
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
    setSaving(true);
    await base44.entities.ProjectArea.update(area.id, { allowance: Number(allowance) || 0, due_date: dueDate || null });
    setSaving(false);
    onUpdated();
    onClose();
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