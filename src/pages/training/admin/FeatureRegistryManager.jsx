import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Edit2, Trash2, X, Save, AlertTriangle, Flag, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

const ROLES = ["Admin / Operations Manager", "Project Coordinator", "Sales / Pre-Construction", "Project Manager / Construction Team", "Catalogue Manager"];

export default function FeatureRegistryManager() {
  const [features, setFeatures] = useState([]);
  const [tutorials, setTutorials] = useState([]);
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [tab, setTab] = useState("features");
  const [flagging, setFlagging] = useState(null);
  const [changeNotes, setChangeNotes] = useState("");

  useEffect(() => { load(); }, []);

  const load = async () => {
    const [feats, tuts, arts] = await Promise.all([
      base44.entities.FeatureRegistry.list("-last_changed_date", 100),
      base44.entities.Tutorial.list("-display_order", 100),
      base44.entities.HelpArticle.list("-last_updated", 100)
    ]);
    setFeatures(feats); setTutorials(tuts); setArticles(arts); setLoading(false);
  };

  const startNew = () => setEditing({
    name: "", module: "", description: "", related_pages: [], related_entities: [],
    related_roles: [], related_tutorial_ids: [], related_article_ids: [],
    feature_version: "1.0", status: "Active", change_notes: ""
  });

  const save = async () => {
    const now = new Date().toISOString();
    if (editing.id) {
      await base44.entities.FeatureRegistry.update(editing.id, { ...editing, last_changed_date: now });
    } else {
      await base44.entities.FeatureRegistry.create({ ...editing, last_changed_date: now });
    }
    setEditing(null); load();
  };

  const remove = async (id) => {
    if (!confirm("Delete this feature?")) return;
    await base44.entities.FeatureRegistry.delete(id); load();
  };

  const flagForReview = async () => {
    if (!flagging) return;
    try {
      await base44.functions.invoke("checkFeatureChanges", {
        feature_id: flagging.id, change_notes: changeNotes || "Feature updated"
      });
      alert("Linked tutorials and articles have been flagged for review.");
      setFlagging(null); setChangeNotes(""); load();
    } catch (e) {
      alert(e.response?.data?.error || e.message || "Failed to flag");
    }
  };

  const markReviewed = async (item, type) => {
    const entity = type === "tutorial" ? base44.entities.Tutorial : base44.entities.HelpArticle;
    await entity.update(item.id, { review_status: "Current", status: "Published", review_reason: "" });
    load();
  };

  const toggleArray = (field, val) => {
    const arr = editing[field] || [];
    const newArr = arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val];
    setEditing({ ...editing, [field]: newArr });
  };

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-gray-200 border-t-gray-800 rounded-full animate-spin" /></div>;

  const needsReviewTutorials = tutorials.filter(t => t.review_status === "Needs Review");
  const needsReviewArticles = articles.filter(a => a.review_status === "Needs Review");

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Feature Registry & Review Queue</h1>

      <div className="flex gap-2 mb-6 border-b border-gray-200">
        <button onClick={() => setTab("features")} className={`px-4 py-2 text-sm font-medium ${tab === "features" ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-500"}`}>Features ({features.length})</button>
        <button onClick={() => setTab("review")} className={`px-4 py-2 text-sm font-medium ${tab === "review" ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-500"}`}>
          Review Queue ({needsReviewTutorials.length + needsReviewArticles.length})
        </button>
      </div>

      {tab === "features" && (
        <>
          <div className="flex justify-end mb-4">
            <Button onClick={startNew}><Plus size={16} /> New Feature</Button>
          </div>
          <div className="space-y-2">
            {features.map(f => (
              <div key={f.id} className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900">{f.name}</p>
                      <span className="text-xs text-gray-400">{f.module}</span>
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">v{f.feature_version}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{f.description}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {f.related_tutorial_ids?.length || 0} tutorials · {f.related_article_ids?.length || 0} articles · Changed {f.last_changed_date ? new Date(f.last_changed_date).toLocaleDateString() : "—"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setFlagging(f)}><Flag size={14} /> Flag</Button>
                    <Button variant="outline" size="sm" onClick={() => setEditing(f)}><Edit2 size={14} /></Button>
                    <Button variant="outline" size="sm" onClick={() => remove(f.id)}><Trash2 size={14} /></Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === "review" && (
        <div className="space-y-4">
          {needsReviewTutorials.length === 0 && needsReviewArticles.length === 0 && (
            <p className="text-gray-400 text-sm text-center py-8">All content is up to date!</p>
          )}
          {needsReviewTutorials.map(t => (
            <div key={t.id} className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900 text-sm">📋 {t.title}</p>
                <p className="text-xs text-amber-700 mt-0.5">{t.review_reason || "Needs review"}</p>
                <p className="text-xs text-gray-400 mt-0.5">Last feature change: {t.last_feature_change_date ? new Date(t.last_feature_change_date).toLocaleDateString() : "—"}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => markReviewed(t, "tutorial")}>
                <CheckCircle size={14} /> Mark Current
              </Button>
            </div>
          ))}
          {needsReviewArticles.map(a => (
            <div key={a.id} className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900 text-sm">📄 {a.title}</p>
                <p className="text-xs text-amber-700 mt-0.5">{a.review_reason || "Needs review"}</p>
                <p className="text-xs text-gray-400 mt-0.5">Last feature change: {a.last_feature_change_date ? new Date(a.last_feature_change_date).toLocaleDateString() : "—"}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => markReviewed(a, "article")}>
                <CheckCircle size={14} /> Mark Current
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Flag dialog */}
      {flagging && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setFlagging(null)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2"><AlertTriangle size={18} className="text-amber-500" /> Flag Feature Change</h2>
              <button onClick={() => setFlagging(null)} className="text-gray-400"><X size={20} /></button>
            </div>
            <p className="text-sm text-gray-600 mb-3">This will flag <strong>{flagging.name}</strong> as changed and mark all linked tutorials and articles for review.</p>
            <div className="mb-4">
              <Label>Change Notes</Label>
              <Textarea value={changeNotes} onChange={e => setChangeNotes(e.target.value)} rows={3} placeholder="What changed?" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setFlagging(null)}>Cancel</Button>
              <Button onClick={flagForReview} className="bg-amber-600 hover:bg-amber-700"><Flag size={14} /> Flag for Review</Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit dialog */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b sticky top-0 bg-white z-10">
              <h2 className="font-semibold text-gray-900">{editing.id ? "Edit Feature" : "New Feature"}</h2>
              <button onClick={() => setEditing(null)} className="text-gray-400"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Name</Label><Input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} /></div>
                <div><Label>Module</Label><Input value={editing.module} onChange={e => setEditing({ ...editing, module: e.target.value })} /></div>
              </div>
              <div><Label>Description</Label><Textarea value={editing.description} onChange={e => setEditing({ ...editing, description: e.target.value })} rows={2} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Version</Label><Input value={editing.feature_version} onChange={e => setEditing({ ...editing, feature_version: e.target.value })} /></div>
                <div>
                  <Label>Status</Label>
                  <select className="w-full h-9 rounded-md border border-input px-3 text-sm" value={editing.status} onChange={e => setEditing({ ...editing, status: e.target.value })}>
                    <option value="Active">Active</option><option value="Beta">Beta</option><option value="Deprecated">Deprecated</option>
                  </select>
                </div>
              </div>
              <div>
                <Label>Related Roles</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {ROLES.map(r => (
                    <button key={r} onClick={() => toggleArray("related_roles", r)} className={`text-xs px-2 py-1 rounded-md border ${(editing.related_roles || []).includes(r) ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-300"}`}>{r}</button>
                  ))}
                </div>
              </div>
              <div>
                <Label>Related Tutorials</Label>
                <div className="max-h-32 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-1">
                  {tutorials.map(t => (
                    <label key={t.id} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={(editing.related_tutorial_ids || []).includes(t.id)} onChange={() => toggleArray("related_tutorial_ids", t.id)} />
                      {t.title}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <Label>Related Help Articles</Label>
                <div className="max-h-32 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-1">
                  {articles.map(a => (
                    <label key={a.id} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={(editing.related_article_ids || []).includes(a.id)} onChange={() => toggleArray("related_article_ids", a.id)} />
                      {a.title}
                    </label>
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