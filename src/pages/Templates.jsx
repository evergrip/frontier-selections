import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Trash2, Edit2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AREA_TYPES, CATEGORIES, DEFAULT_TEMPLATES } from "@/lib/constants";

export default function Templates() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const data = await base44.entities.RoomTemplate.list("-updated_date", 100);
    setTemplates(data);
    setLoading(false);
  }

  async function seedDefaults() {
    const entries = Object.entries(DEFAULT_TEMPLATES);
    for (const [areaType, selections] of entries) {
      await base44.entities.RoomTemplate.create({
        name: `${areaType} Template`, area_type: areaType,
        selections: selections, is_default: true
      });
    }
    load();
  }

  async function handleDelete(id) {
    await base44.entities.RoomTemplate.delete(id);
    load();
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Room Templates</h1>
          <p className="text-sm text-gray-500 mt-1">Default selection lists by room type</p>
        </div>
        <div className="flex gap-2">
          {templates.length === 0 && (
            <Button variant="outline" onClick={seedDefaults}>Load Default Templates</Button>
          )}
          <Button onClick={() => setShowCreate(true)} className="gap-2"><Plus size={16} /> New Template</Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-gray-200 border-t-gray-800 rounded-full animate-spin" /></div>
      ) : templates.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-gray-200">
          <p className="text-gray-400 text-sm mb-3">No templates yet</p>
          <Button variant="outline" onClick={seedDefaults}>Load Default Templates</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map(t => (
            <div key={t.id} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900">{t.name}</h3>
                  <p className="text-xs text-gray-500">{t.area_type}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(t.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={14} /></Button>
              </div>
              <div className="space-y-1">
                {(t.selections || []).map((s, i) => (
                  <div key={i} className="flex items-center justify-between text-xs bg-gray-50 rounded px-2.5 py-1.5">
                    <span className="text-gray-700">{s.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400">{s.category}</span>
                      {s.required && <span className="text-red-500 font-medium">REQ</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <CreateTemplateDialog open={showCreate} onClose={() => setShowCreate(false)} onCreated={load} />
    </div>
  );
}

function CreateTemplateDialog({ open, onClose, onCreated }) {
  const [name, setName] = useState("");
  const [areaType, setAreaType] = useState("Kitchen");
  const [selections, setSelections] = useState([]);
  const [saving, setSaving] = useState(false);

  function addSelection() {
    setSelections([...selections, { name: "", category: "Other", required: true }]);
  }

  function updateSel(i, field, value) {
    setSelections(selections.map((s, j) => j === i ? { ...s, [field]: value } : s));
  }

  function removeSel(i) {
    setSelections(selections.filter((_, j) => j !== i));
  }

  async function handleCreate() {
    if (!name.trim()) return;
    setSaving(true);
    await base44.entities.RoomTemplate.create({ name, area_type: areaType, selections, is_default: false });
    setSaving(false);
    setName(""); setSelections([]);
    onCreated();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle>New Room Template</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div><Label>Template Name *</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
          <div><Label>Area Type</Label>
            <Select value={areaType} onValueChange={setAreaType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{AREA_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Selections</Label>
            <div className="space-y-2 mt-2">
              {selections.map((s, i) => (
                <div key={i} className="flex gap-2">
                  <Input value={s.name} onChange={e => updateSel(i, "name", e.target.value)} placeholder="Name" className="flex-1" />
                  <Select value={s.category} onValueChange={v => updateSel(i, "category", v)}>
                    <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button variant="ghost" size="icon" onClick={() => removeSel(i)}><Trash2 size={14} /></Button>
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={addSelection} className="mt-2 gap-1"><Plus size={12} /> Add</Button>
          </div>
          <Button onClick={handleCreate} disabled={saving || !name.trim()} className="w-full">{saving ? "Creating..." : "Create Template"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}