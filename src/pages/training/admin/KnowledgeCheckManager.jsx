import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Edit2, Trash2, X, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

const ROLES = ["Admin / Operations Manager", "Project Coordinator", "Sales / Pre-Construction", "Project Manager / Construction Team", "Catalogue Manager"];

export default function KnowledgeCheckManager() {
  const [checks, setChecks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    const list = await base44.entities.KnowledgeCheck.list();
    setChecks(list); setLoading(false);
  };

  const startNew = () => setEditing({
    question: "", answer_choices: ["", "", "", ""], correct_answer: "",
    explanation: "", required_for_roles: [], category: "", related_article_id: ""
  });

  const save = async () => {
    const cleanChoices = editing.answer_choices.filter(c => c.trim());
    const data = { ...editing, answer_choices: cleanChoices };
    if (editing.id) {
      await base44.entities.KnowledgeCheck.update(editing.id, data);
    } else {
      await base44.entities.KnowledgeCheck.create(data);
    }
    setEditing(null); load();
  };

  const remove = async (id) => {
    if (!confirm("Delete this question?")) return;
    await base44.entities.KnowledgeCheck.delete(id); load();
  };

  const updateChoice = (idx, val) => {
    const choices = [...editing.answer_choices];
    choices[idx] = val;
    setEditing({ ...editing, answer_choices: choices });
  };

  const addChoice = () => setEditing({ ...editing, answer_choices: [...editing.answer_choices, ""] });
  const removeChoice = (idx) => setEditing({ ...editing, answer_choices: editing.answer_choices.filter((_, i) => i !== idx) });

  const toggleRole = (role) => {
    const roles = editing.required_for_roles.includes(role)
      ? editing.required_for_roles.filter(r => r !== role)
      : [...editing.required_for_roles, role];
    setEditing({ ...editing, required_for_roles: roles });
  };

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-gray-200 border-t-gray-800 rounded-full animate-spin" /></div>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Knowledge Check Management</h1>
        <Button onClick={startNew}><Plus size={16} /> New Question</Button>
      </div>

      <div className="space-y-3">
        {checks.map(c => (
          <div key={c.id} className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="font-medium text-gray-900 text-sm">{c.question}</p>
                <p className="text-xs text-green-600 mt-1">✓ {c.correct_answer}</p>
                <p className="text-xs text-gray-400 mt-1">{c.required_for_roles?.length || 0} roles · {c.category}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditing(c)}><Edit2 size={14} /></Button>
                <Button variant="outline" size="sm" onClick={() => remove(c.id)}><Trash2 size={14} /></Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b sticky top-0 bg-white z-10">
              <h2 className="font-semibold text-gray-900">{editing.id ? "Edit Question" : "New Question"}</h2>
              <button onClick={() => setEditing(null)} className="text-gray-400"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <Label>Question</Label>
                <Textarea value={editing.question} onChange={e => setEditing({ ...editing, question: e.target.value })} rows={2} />
              </div>
              <div>
                <Label>Answer Choices</Label>
                <div className="space-y-2 mt-1">
                  {editing.answer_choices.map((choice, idx) => (
                    <div key={idx} className="flex gap-2">
                      <Input value={choice} onChange={e => updateChoice(idx, e.target.value)} placeholder={`Choice ${idx + 1}`} />
                      <button onClick={() => removeChoice(idx)} className="text-red-400 hover:text-red-600 p-2"><X size={14} /></button>
                    </div>
                  ))}
                  <Button size="sm" variant="outline" onClick={addChoice}><Plus size={12} /> Add Choice</Button>
                </div>
              </div>
              <div>
                <Label>Correct Answer (must match a choice exactly)</Label>
                <Input value={editing.correct_answer} onChange={e => setEditing({ ...editing, correct_answer: e.target.value })} />
              </div>
              <div>
                <Label>Explanation</Label>
                <Textarea value={editing.explanation} onChange={e => setEditing({ ...editing, explanation: e.target.value })} rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Category</Label><Input value={editing.category} onChange={e => setEditing({ ...editing, category: e.target.value })} /></div>
                <div><Label>Related Article ID</Label><Input value={editing.related_article_id} onChange={e => setEditing({ ...editing, related_article_id: e.target.value })} /></div>
              </div>
              <div>
                <Label>Required for Roles</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {ROLES.map(r => (
                    <button key={r} onClick={() => toggleRole(r)} className={`text-xs px-2 py-1 rounded-md border ${editing.required_for_roles.includes(r) ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-300"}`}>{r}</button>
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