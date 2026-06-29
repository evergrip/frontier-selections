import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Edit2, Trash2, X, GripVertical, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

const CATEGORIES = ["Getting Started", "Projects", "Customers", "Rooms and Areas", "Selection Requirements", "Catalogue", "Product Configurator", "Allowances", "Approvals", "Change Requests", "Procurement", "Mood Board", "Reports", "Final Selections Packages", "Security and Permissions", "Troubleshooting"];
const ROLES = ["Admin / Operations Manager", "Project Coordinator", "Sales / Pre-Construction", "Project Manager / Construction Team", "Catalogue Manager"];

export default function TutorialManager() {
  const [tutorials, setTutorials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    const list = await base44.entities.Tutorial.list("-display_order", 100);
    setTutorials(list); setLoading(false);
  };

  const startNew = () => setEditing({
    title: "", description: "", category: "Getting Started", applies_to_roles: [],
    estimated_minutes: 5, target_page: "", steps: [], status: "Draft", required: false, display_order: 0
  });

  const save = async () => {
    if (editing.id) {
      await base44.entities.Tutorial.update(editing.id, { ...editing, last_updated: new Date().toISOString() });
    } else {
      await base44.entities.Tutorial.create({ ...editing, author: "Admin", last_updated: new Date().toISOString(), app_version: "1.0", review_status: "Current" });
    }
    setEditing(null); load();
  };

  const remove = async (id) => {
    if (!confirm("Delete this tutorial?")) return;
    await base44.entities.Tutorial.delete(id); load();
  };

  const addStep = () => setEditing({ ...editing, steps: [...editing.steps, { title: "", instruction: "", target_element: "", completion_trigger: "" }] });
  const updateStep = (idx, field, val) => {
    const steps = [...editing.steps]; steps[idx] = { ...steps[idx], [field]: val };
    setEditing({ ...editing, steps });
  };
  const removeStep = (idx) => setEditing({ ...editing, steps: editing.steps.filter((_, i) => i !== idx) });
  const moveStep = (idx, dir) => {
    const steps = [...editing.steps]; const target = idx + dir;
    if (target < 0 || target >= steps.length) return;
    [steps[idx], steps[target]] = [steps[target], steps[idx]];
    setEditing({ ...editing, steps });
  };

  const toggleRole = (role) => {
    const roles = editing.applies_to_roles.includes(role)
      ? editing.applies_to_roles.filter(r => r !== role)
      : [...editing.applies_to_roles, role];
    setEditing({ ...editing, applies_to_roles: roles });
  };

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-gray-200 border-t-gray-800 rounded-full animate-spin" /></div>;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Tutorial Management</h1>
        <Button onClick={startNew}><Plus size={16} /> New Tutorial</Button>
      </div>

      <div className="space-y-2">
        {tutorials.map(t => (
          <div key={t.id} className="bg-white border border-gray-200 rounded-lg p-4 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium text-gray-900">{t.title}</p>
                <span className="text-xs text-gray-400">{t.category}</span>
                {t.status === "Published" && <span className="text-xs text-green-600">●</span>}
                {t.status === "Needs Review" && <span className="text-xs text-amber-600">●</span>}
                {t.review_status === "Needs Review" && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Needs Review</span>}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">{t.steps?.length || 0} steps · {t.estimated_minutes || 5} min · {t.applies_to_roles?.length || 0} roles</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditing(t)}><Edit2 size={14} /></Button>
              <Button variant="outline" size="sm" onClick={() => remove(t.id)}><Trash2 size={14} /></Button>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b sticky top-0 bg-white z-10">
              <h2 className="font-semibold text-gray-900">{editing.id ? "Edit Tutorial" : "New Tutorial"}</h2>
              <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <Label>Title</Label>
                <Input value={editing.title} onChange={e => setEditing({ ...editing, title: e.target.value })} />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea value={editing.description} onChange={e => setEditing({ ...editing, description: e.target.value })} rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Category</Label>
                  <select className="w-full h-9 rounded-md border border-input px-3 text-sm" value={editing.category} onChange={e => setEditing({ ...editing, category: e.target.value })}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Estimated Minutes</Label>
                  <Input type="number" value={editing.estimated_minutes} onChange={e => setEditing({ ...editing, estimated_minutes: Number(e.target.value) })} />
                </div>
              </div>
              <div>
                <Label>Target Page (route, e.g. /projects)</Label>
                <Input value={editing.target_page} onChange={e => setEditing({ ...editing, target_page: e.target.value })} placeholder="/projects" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Status</Label>
                  <select className="w-full h-9 rounded-md border border-input px-3 text-sm" value={editing.status} onChange={e => setEditing({ ...editing, status: e.target.value })}>
                    <option value="Draft">Draft</option><option value="Published">Published</option><option value="Needs Review">Needs Review</option><option value="Archived">Archived</option>
                  </select>
                </div>
                <div>
                  <Label>Display Order</Label>
                  <Input type="number" value={editing.display_order} onChange={e => setEditing({ ...editing, display_order: Number(e.target.value) })} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={editing.required} onChange={e => setEditing({ ...editing, required: e.target.checked })} id="req" />
                <Label htmlFor="req" className="cursor-pointer">Required for role</Label>
              </div>
              <div>
                <Label>Applies to Roles</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {ROLES.map(r => (
                    <button key={r} onClick={() => toggleRole(r)} className={`text-xs px-2 py-1 rounded-md border ${editing.applies_to_roles.includes(r) ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-300"}`}>{r}</button>
                  ))}
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Steps</Label>
                  <Button size="sm" variant="outline" onClick={addStep}><Plus size={12} /> Add Step</Button>
                </div>
                <div className="space-y-3">
                  {editing.steps.map((step, idx) => (
                    <div key={idx} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-gray-500">Step {idx + 1}</span>
                        <div className="flex gap-1">
                          <button onClick={() => moveStep(idx, -1)} className="p-1 text-gray-400 hover:text-gray-600"><GripVertical size={12} /></button>
                          <button onClick={() => removeStep(idx)} className="p-1 text-red-400 hover:text-red-600"><X size={12} /></button>
                        </div>
                      </div>
                      <Input value={step.title} onChange={e => updateStep(idx, "title", e.target.value)} placeholder="Step title" className="mb-2" />
                      <Textarea value={step.instruction} onChange={e => updateStep(idx, "instruction", e.target.value)} placeholder="Instruction text" rows={2} className="mb-2" />
                      <div className="grid grid-cols-2 gap-2">
                        <Input value={step.target_element} onChange={e => updateStep(idx, "target_element", e.target.value)} placeholder="CSS selector (e.g. #btn)" />
                        <Input value={step.completion_trigger} onChange={e => updateStep(idx, "completion_trigger", e.target.value)} placeholder="Completion trigger" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t sticky bottom-0 bg-white">
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button onClick={save}><Save size={14} /> Save</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}