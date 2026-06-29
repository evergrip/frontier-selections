import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, Upload, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CATEGORIES } from "@/lib/constants";

const emptyItem = {
  name: "", category: "Other", supplier: "", brand: "", collection: "", sku: "",
  description: "", base_price: 0, unit_of_measure: "", default_image: "",
  gallery_images: [], spec_sheet_url: "", supplier_link: "", lead_time: "",
  warranty_info: "", installation_notes: "", customer_notes: "", internal_notes: "",
  is_active: true, tags: [], taxable: true, markup_rule: "", labour_included: false,
  install_complexity: "", option_groups: [], option_rules: []
};

export default function CatalogueItemEditor() {
  const { itemId } = useParams();
  const navigate = useNavigate();
  const isNew = itemId === "new";
  const [form, setForm] = useState(emptyItem);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isNew) {
      base44.entities.CatalogueItem.get(itemId).then(data => {
        setForm({ ...emptyItem, ...data });
        setLoading(false);
      });
    }
  }, [itemId]);

  function update(field, value) { setForm(prev => ({ ...prev, [field]: value })); }

  async function handleImageUpload(e, field) {
    const file = e.target.files[0];
    if (!file) return;
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    if (field === "default_image") {
      update("default_image", file_url);
    } else {
      update("gallery_images", [...(form.gallery_images || []), file_url]);
    }
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    if (isNew) {
      const item = await base44.entities.CatalogueItem.create(form);
      navigate(`/catalogue/${item.id}`, { replace: true });
    } else {
      await base44.entities.CatalogueItem.update(itemId, form);
    }
    setSaving(false);
  }

  function addOptionGroup() {
    const id = "og_" + Date.now();
    update("option_groups", [...(form.option_groups || []), {
      id, name: "", display_order: (form.option_groups || []).length, is_required: true, options: []
    }]);
  }

  function updateGroup(groupId, field, value) {
    update("option_groups", form.option_groups.map(g => g.id === groupId ? { ...g, [field]: value } : g));
  }

  function removeGroup(groupId) {
    update("option_groups", form.option_groups.filter(g => g.id !== groupId));
    update("option_rules", (form.option_rules || []).filter(r => r.condition_group_id !== groupId && r.target_group_id !== groupId));
  }

  function addOption(groupId) {
    const optId = "opt_" + Date.now();
    update("option_groups", form.option_groups.map(g =>
      g.id === groupId ? { ...g, options: [...g.options, { id: optId, name: "", price_modifier: 0, is_active: true, warnings: [], requires_approval: false }] } : g
    ));
  }

  function updateOption(groupId, optionId, field, value) {
    update("option_groups", form.option_groups.map(g =>
      g.id === groupId ? { ...g, options: g.options.map(o => o.id === optionId ? { ...o, [field]: value } : o) } : g
    ));
  }

  function removeOption(groupId, optionId) {
    update("option_groups", form.option_groups.map(g =>
      g.id === groupId ? { ...g, options: g.options.filter(o => o.id !== optionId) } : g
    ));
  }

  function addRule() {
    const id = "rule_" + Date.now();
    update("option_rules", [...(form.option_rules || []), {
      id, rule_type: "availability", condition_group_id: "", condition_option_id: "",
      target_group_id: "", target_option_id: "", action: "hide", value: ""
    }]);
  }

  function updateRule(ruleId, field, value) {
    update("option_rules", form.option_rules.map(r => r.id === ruleId ? { ...r, [field]: value } : r));
  }

  function removeRule(ruleId) {
    update("option_rules", form.option_rules.filter(r => r.id !== ruleId));
  }

  if (loading) return <div className="flex items-center justify-center h-96"><div className="w-8 h-8 border-4 border-gray-200 border-t-gray-800 rounded-full animate-spin" /></div>;

  const allOptions = (form.option_groups || []).flatMap(g => g.options.map(o => ({ ...o, groupId: g.id, groupName: g.name })));

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/catalogue")} className="p-2 rounded-lg hover:bg-gray-100"><ArrowLeft size={18} /></button>
        <h1 className="text-2xl font-bold text-gray-900">{isNew ? "New Catalogue Item" : "Edit Item"}</h1>
      </div>

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="options">Options ({(form.option_groups || []).length})</TabsTrigger>
          <TabsTrigger value="rules">Rules ({(form.option_rules || []).length})</TabsTrigger>
          <TabsTrigger value="images">Images</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="mt-6 space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><Label>Item Name *</Label><Input value={form.name} onChange={e => update("name", e.target.value)} /></div>
              <div><Label>Category</Label>
                <Select value={form.category} onValueChange={v => update("category", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Supplier</Label><Input value={form.supplier} onChange={e => update("supplier", e.target.value)} /></div>
              <div><Label>Brand</Label><Input value={form.brand} onChange={e => update("brand", e.target.value)} /></div>
              <div><Label>Collection</Label><Input value={form.collection} onChange={e => update("collection", e.target.value)} /></div>
              <div><Label>SKU / Reference</Label><Input value={form.sku} onChange={e => update("sku", e.target.value)} /></div>
              <div><Label>Base Price ($)</Label><Input type="number" value={form.base_price} onChange={e => update("base_price", Number(e.target.value))} /></div>
              <div><Label>Unit of Measure</Label><Input value={form.unit_of_measure} onChange={e => update("unit_of_measure", e.target.value)} placeholder="e.g. each, sqft, linear ft" /></div>
            </div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={e => update("description", e.target.value)} rows={3} /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><Label>Lead Time</Label><Input value={form.lead_time} onChange={e => update("lead_time", e.target.value)} /></div>
              <div><Label>Supplier Link</Label><Input value={form.supplier_link} onChange={e => update("supplier_link", e.target.value)} /></div>
            </div>
            <div><Label>Warranty Info</Label><Textarea value={form.warranty_info} onChange={e => update("warranty_info", e.target.value)} rows={2} /></div>
            <div><Label>Installation Notes</Label><Textarea value={form.installation_notes} onChange={e => update("installation_notes", e.target.value)} rows={2} /></div>
            <div><Label>Customer Notes</Label><Textarea value={form.customer_notes} onChange={e => update("customer_notes", e.target.value)} rows={2} /></div>
            <div><Label>Internal Staff Notes</Label><Textarea value={form.internal_notes} onChange={e => update("internal_notes", e.target.value)} rows={2} /></div>
            <div><Label>Install Complexity</Label><Input value={form.install_complexity} onChange={e => update("install_complexity", e.target.value)} /></div>
            <div className="flex flex-wrap gap-6">
              <label className="flex items-center gap-2 text-sm"><Switch checked={form.is_active} onCheckedChange={v => update("is_active", v)} /> Active</label>
              <label className="flex items-center gap-2 text-sm"><Switch checked={form.taxable} onCheckedChange={v => update("taxable", v)} /> Taxable</label>
              <label className="flex items-center gap-2 text-sm"><Switch checked={form.labour_included} onCheckedChange={v => update("labour_included", v)} /> Labour Included</label>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="options" className="mt-6 space-y-4">
          {(form.option_groups || []).map((group, gi) => (
            <div key={group.id} className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <Input value={group.name} onChange={e => updateGroup(group.id, "name", e.target.value)} placeholder="Option group name" className="font-medium max-w-xs" />
                  <label className="flex items-center gap-1.5 text-xs text-gray-500">
                    <input type="checkbox" checked={group.is_required} onChange={e => updateGroup(group.id, "is_required", e.target.checked)} className="rounded" /> Required
                  </label>
                </div>
                <Button variant="ghost" size="icon" onClick={() => removeGroup(group.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={14} /></Button>
              </div>

              <div className="space-y-2">
                {group.options.map(opt => (
                  <div key={opt.id} className="flex items-center gap-2 bg-gray-50 rounded-lg p-3">
                    <Input value={opt.name} onChange={e => updateOption(group.id, opt.id, "name", e.target.value)} placeholder="Option name" className="flex-1 bg-white" />
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-400">$</span>
                      <Input type="number" value={opt.price_modifier || 0} onChange={e => updateOption(group.id, opt.id, "price_modifier", Number(e.target.value))} className="w-24 bg-white" />
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => removeOption(group.id, opt.id)} className="text-gray-400 hover:text-red-500 shrink-0"><Trash2 size={14} /></Button>
                  </div>
                ))}
              </div>
              <Button variant="outline" size="sm" onClick={() => addOption(group.id)} className="gap-1"><Plus size={12} /> Add Option</Button>
            </div>
          ))}
          <Button variant="outline" onClick={addOptionGroup} className="gap-2"><Plus size={16} /> Add Option Group</Button>
        </TabsContent>

        <TabsContent value="rules" className="mt-6 space-y-4">
          <p className="text-sm text-gray-500">Define conditional availability rules. For example: "When Size is 36 inch, hide Colour Black."</p>
          {(form.option_rules || []).map(rule => (
            <div key={rule.id} className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                <Select value={rule.condition_group_id} onValueChange={v => updateRule(rule.id, "condition_group_id", v)}>
                  <SelectTrigger className="text-xs"><SelectValue placeholder="When group..." /></SelectTrigger>
                  <SelectContent>{(form.option_groups || []).map(g => <SelectItem key={g.id} value={g.id}>{g.name || "Unnamed"}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={rule.condition_option_id} onValueChange={v => updateRule(rule.id, "condition_option_id", v)}>
                  <SelectTrigger className="text-xs"><SelectValue placeholder="is..." /></SelectTrigger>
                  <SelectContent>{((form.option_groups || []).find(g => g.id === rule.condition_group_id)?.options || []).map(o => <SelectItem key={o.id} value={o.id}>{o.name || "Unnamed"}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={rule.action} onValueChange={v => updateRule(rule.id, "action", v)}>
                  <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="show">Show</SelectItem>
                    <SelectItem value="hide">Hide</SelectItem>
                    <SelectItem value="set_price">Set Price</SelectItem>
                    <SelectItem value="add_warning">Add Warning</SelectItem>
                    <SelectItem value="require_approval">Require Approval</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={rule.target_group_id} onValueChange={v => updateRule(rule.id, "target_group_id", v)}>
                  <SelectTrigger className="text-xs"><SelectValue placeholder="target group..." /></SelectTrigger>
                  <SelectContent>{(form.option_groups || []).map(g => <SelectItem key={g.id} value={g.id}>{g.name || "Unnamed"}</SelectItem>)}</SelectContent>
                </Select>
                <div className="flex items-center gap-1">
                  <Select value={rule.target_option_id} onValueChange={v => updateRule(rule.id, "target_option_id", v)}>
                    <SelectTrigger className="text-xs"><SelectValue placeholder="option..." /></SelectTrigger>
                    <SelectContent>{((form.option_groups || []).find(g => g.id === rule.target_group_id)?.options || []).map(o => <SelectItem key={o.id} value={o.id}>{o.name || "Unnamed"}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button variant="ghost" size="icon" onClick={() => removeRule(rule.id)} className="text-gray-400 hover:text-red-500 shrink-0"><Trash2 size={14} /></Button>
                </div>
              </div>
              {(rule.action === "set_price" || rule.action === "add_warning") && (
                <Input value={rule.value || ""} onChange={e => updateRule(rule.id, "value", e.target.value)} placeholder={rule.action === "set_price" ? "Price amount" : "Warning message"} className="max-w-xs text-sm" />
              )}
            </div>
          ))}
          <Button variant="outline" onClick={addRule} className="gap-2"><Plus size={16} /> Add Rule</Button>
        </TabsContent>

        <TabsContent value="images" className="mt-6 space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <div>
              <Label>Default Image</Label>
              <div className="mt-2 flex items-center gap-4">
                {form.default_image ? (
                  <img src={form.default_image} alt="Default" className="w-32 h-32 object-cover rounded-lg border" />
                ) : (
                  <div className="w-32 h-32 bg-gray-100 rounded-lg flex items-center justify-center text-gray-300"><Upload size={24} /></div>
                )}
                <label className="cursor-pointer">
                  <input type="file" accept="image/*" onChange={e => handleImageUpload(e, "default_image")} className="hidden" />
                  <Button variant="outline" size="sm" asChild><span>Upload Image</span></Button>
                </label>
              </div>
            </div>
            <div>
              <Label>Gallery Images</Label>
              <div className="mt-2 flex flex-wrap gap-3">
                {(form.gallery_images || []).map((url, i) => (
                  <div key={i} className="relative group">
                    <img src={url} alt="" className="w-24 h-24 object-cover rounded-lg border" />
                    <button onClick={() => update("gallery_images", form.gallery_images.filter((_, j) => j !== i))} className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity">×</button>
                  </div>
                ))}
                <label className="w-24 h-24 border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center cursor-pointer hover:border-gray-400 transition-colors">
                  <input type="file" accept="image/*" onChange={e => handleImageUpload(e, "gallery")} className="hidden" />
                  <Plus size={20} className="text-gray-400" />
                </label>
              </div>
            </div>
            <div>
              <Label>Spec Sheet URL</Label>
              <Input value={form.spec_sheet_url} onChange={e => update("spec_sheet_url", e.target.value)} placeholder="Upload or paste URL" className="mt-1" />
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex gap-3 pt-4">
        <Button onClick={handleSave} disabled={saving || !form.name.trim()} className="px-8">{saving ? "Saving..." : isNew ? "Create Item" : "Save Changes"}</Button>
        <Button variant="outline" onClick={() => navigate("/catalogue")}>Cancel</Button>
      </div>
    </div>
  );
}