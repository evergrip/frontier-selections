import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Edit2, Trash2, X, Save, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

const CATEGORIES = ["Getting Started", "Projects", "Customers", "Rooms and Areas", "Selection Requirements", "Catalogue", "Product Configurator", "Allowances", "Approvals", "Change Requests", "Procurement", "Mood Board", "Reports", "Final Selections Packages", "Security and Permissions", "Troubleshooting"];
const ROLES = ["Admin / Operations Manager", "Project Coordinator", "Sales / Pre-Construction", "Project Manager / Construction Team", "Catalogue Manager"];

export default function HelpArticleManager() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    const list = await base44.entities.HelpArticle.list("-last_updated", 100);
    setArticles(list); setLoading(false);
  };

  const startNew = () => setEditing({
    title: "", category: "Getting Started", applies_to_roles: [], related_module: "",
    body: "", screenshots: [], video_url: "", status: "Draft", is_customer_facing: false, display_order: 0
  });

  const save = async () => {
    if (editing.id) {
      await base44.entities.HelpArticle.update(editing.id, { ...editing, last_updated: new Date().toISOString() });
    } else {
      await base44.entities.HelpArticle.create({ ...editing, author: "Admin", last_updated: new Date().toISOString(), app_version: "1.0", review_status: "Current", view_count: 0 });
    }
    setEditing(null); load();
  };

  const remove = async (id) => {
    if (!confirm("Delete this article?")) return;
    await base44.entities.HelpArticle.delete(id); load();
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
        <h1 className="text-2xl font-bold text-gray-900">Help Article Management</h1>
        <Button onClick={startNew}><Plus size={16} /> New Article</Button>
      </div>

      <div className="space-y-2">
        {articles.map(a => (
          <div key={a.id} className="bg-white border border-gray-200 rounded-lg p-4 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium text-gray-900">{a.title}</p>
                <span className="text-xs text-gray-400">{a.category}</span>
                {a.status === "Published" && <span className="text-xs text-green-600">●</span>}
                {a.status === "Needs Review" && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Needs Review</span>}
                {a.is_customer_facing && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">Customer-facing</span>}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">{a.view_count || 0} views · Updated {a.last_updated ? new Date(a.last_updated).toLocaleDateString() : "—"}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditing(a)}><Edit2 size={14} /></Button>
              <Button variant="outline" size="sm" onClick={() => remove(a.id)}><Trash2 size={14} /></Button>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b sticky top-0 bg-white z-10">
              <h2 className="font-semibold text-gray-900">{editing.id ? "Edit Article" : "New Article"}</h2>
              <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <Label>Title</Label>
                <Input value={editing.title} onChange={e => setEditing({ ...editing, title: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Category</Label>
                  <select className="w-full h-9 rounded-md border border-input px-3 text-sm" value={editing.category} onChange={e => setEditing({ ...editing, category: e.target.value })}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Related Module</Label>
                  <Input value={editing.related_module} onChange={e => setEditing({ ...editing, related_module: e.target.value })} placeholder="e.g. Customer Portal" />
                </div>
              </div>
              <div>
                <Label>Status</Label>
                <select className="w-full h-9 rounded-md border border-input px-3 text-sm" value={editing.status} onChange={e => setEditing({ ...editing, status: e.target.value })}>
                  <option value="Draft">Draft</option><option value="Published">Published</option><option value="Needs Review">Needs Review</option><option value="Archived">Archived</option>
                </select>
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
                <Label>Body (Markdown)</Label>
                <Textarea value={editing.body} onChange={e => setEditing({ ...editing, body: e.target.value })} rows={10} className="font-mono text-xs" placeholder="# Article title..." />
              </div>
              <div>
                <Label>Video URL (optional)</Label>
                <Input value={editing.video_url} onChange={e => setEditing({ ...editing, video_url: e.target.value })} placeholder="https://..." />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={editing.is_customer_facing} onChange={e => setEditing({ ...editing, is_customer_facing: e.target.checked })} id="cf" />
                <Label htmlFor="cf" className="cursor-pointer">Customer-facing (visible in customer portal)</Label>
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