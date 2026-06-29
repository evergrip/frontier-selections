import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Save, Send, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import StatusBadge from "@/components/ui/StatusBadge";
import CommentThread from "@/components/comments/CommentThread";

function assembleItem(item, groups, values, rules) {
  const itemGroups = (groups || []).filter(g => g.catalogue_item_id === item.id)
    .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
    .map(g => ({
      id: g.id, name: g.name, is_required: g.is_required !== false,
      options: (values || []).filter(v => v.option_group_id === g.id).sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
    }));
  return { ...item, option_groups: itemGroups };
}

function getAvailableOptions(item, groupId, selections) {
  const group = item?.option_groups?.find(g => g.id === groupId);
  if (!group) return [];
  return group.options.filter(o => o.is_active !== false && o.status !== "Inactive" && o.status !== "Discontinued");
}

export default function SubstitutionDetail() {
  const { id } = useParams();
  const isNew = id === "new";
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [rec, setRec] = useState(null);
  const [selection, setSelection] = useState(null);
  const [requirement, setRequirement] = useState(null);
  const [originalItem, setOriginalItem] = useState(null);
  const [catalogueItems, setCatalogueItems] = useState([]);
  const [recommendedItem, setRecommendedItem] = useState(null);
  const [selectedOptions, setSelectedOptions] = useState({});
  const [reason, setReason] = useState("");
  const [scheduleImpact, setScheduleImpact] = useState("");
  const [staffNote, setStaffNote] = useState("");
  const [customerExplanation, setCustomerExplanation] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { load(); }, [id]);

  async function load() {
    setLoading(true);
    let sel, req, orig, r;
    if (isNew) {
      sel = await base44.entities.CustomerSelection.get(params.get("selection"));
      req = await base44.entities.SelectionRequirement.get(sel.requirement_id);
      orig = await base44.entities.CatalogueItem.get(sel.catalogue_item_id);
    } else {
      r = await base44.entities.SubstitutionRecommendation.get(id);
      setRec(r);
      setReason(r.reason || ""); setScheduleImpact(r.schedule_impact || ""); setStaffNote(r.staff_note || ""); setCustomerExplanation(r.customer_explanation || "");
      sel = await base44.entities.CustomerSelection.get(r.selection_id);
      req = await base44.entities.SelectionRequirement.get(r.requirement_id);
      orig = await base44.entities.CatalogueItem.get(r.original_item_id);
    }
    setSelection(sel); setRequirement(req); setOriginalItem(orig);
    const [rawItems, groups, values] = await Promise.all([
      base44.entities.CatalogueItem.filter({ category: req.category }, "name", 100),
      base44.entities.CatalogueOptionGroup.filter({ is_active: true }, null, 500),
      base44.entities.CatalogueOptionValue.filter({ is_active: true }, null, 500)
    ]);
    const items = rawItems.map(i => assembleItem(i, groups, values, []));
    setCatalogueItems(items.filter(i => i.id !== orig.id && i.status !== "Discontinued"));
    if (!isNew && r.recommended_item_id) {
      const ri = items.find(i => i.id === r.recommended_item_id) || assembleItem(await base44.entities.CatalogueItem.get(r.recommended_item_id), groups, values, []);
      setRecommendedItem(ri);
      const opts = {};
      (r.recommended_options || []).forEach(o => { opts[o.group_id] = o.option_id; });
      setSelectedOptions(opts);
    }
    setLoading(false);
  }

  function pickRecommended(itemId) {
    setRecommendedItem(catalogueItems.find(i => i.id === itemId));
    setSelectedOptions({});
  }

  const recommendedPrice = useMemo(() => {
    if (!recommendedItem) return 0;
    let total = recommendedItem.base_price || 0;
    (recommendedItem.option_groups || []).forEach(g => {
      const opt = g.options.find(o => o.id === selectedOptions[g.id]);
      if (opt) total += opt.price_modifier || 0;
    });
    return total;
  }, [recommendedItem, selectedOptions]);

  const originalPrice = selection?.calculated_price || 0;
  const allowance = requirement?.allowance_amount || 0;
  const priceImpact = recommendedPrice - originalPrice;
  const allowanceImpact = recommendedPrice - allowance;

  function optionsArray() {
    if (!recommendedItem) return [];
    return Object.entries(selectedOptions).map(([groupId, optionId]) => {
      const group = recommendedItem.option_groups.find(g => g.id === groupId);
      const opt = group?.options.find(o => o.id === optionId);
      return { group_id: groupId, group_name: group?.name || "", option_id: optionId, option_name: opt?.name || "", price_modifier: opt?.price_modifier || 0 };
    });
  }

  async function saveDraft() {
    if (!recommendedItem) { alert("Select a recommended item"); return; }
    setBusy(true);
    try {
      if (isNew) {
        const created = await base44.entities.SubstitutionRecommendation.create({
          project_id: selection.project_id, area_id: selection.area_id, requirement_id: selection.requirement_id, selection_id: selection.id,
          original_item_id: originalItem.id, original_item_name: originalItem.name,
          original_selected_options: (selection.selected_options || []).map(o => ({ group_name: o.group_name, option_name: o.option_name, price_modifier: o.price_modifier })),
          recommended_item_id: recommendedItem.id, recommended_item_name: recommendedItem.name, recommended_options: optionsArray(), recommended_price: recommendedPrice,
          reason, price_impact: priceImpact, allowance_impact: allowanceImpact, schedule_impact: scheduleImpact, staff_note: staffNote, customer_explanation: customerExplanation,
          status: "Draft", created_by: "staff"
        });
        navigate(`/substitution/${created.id}`, { replace: true });
      } else {
        await base44.entities.SubstitutionRecommendation.update(id, {
          recommended_item_id: recommendedItem.id, recommended_item_name: recommendedItem.name, recommended_options: optionsArray(), recommended_price: recommendedPrice,
          reason, price_impact: priceImpact, allowance_impact: allowanceImpact, schedule_impact: scheduleImpact, staff_note: staffNote, customer_explanation: customerExplanation
        });
        load();
      }
    } catch (e) { alert("Save failed"); }
    setBusy(false);
  }

  async function sendToCustomer() {
    setBusy(true);
    try { await base44.functions.invoke("substitutionWorkflow", { action: "send", recommendation_id: id }); load(); } catch (e) { alert("Failed"); }
    setBusy(false);
  }
  async function approve() {
    setBusy(true);
    try {
      await base44.functions.invoke("substitutionWorkflow", { action: "approve", recommendation_id: id, calculated_price: recommendedPrice });
      alert("Substitution applied");
      navigate(`/projects/${rec.project_id}/area/${rec.area_id}/requirement/${rec.requirement_id}`);
    } catch (e) { alert(e.response?.data?.error || "Failed"); }
    setBusy(false);
  }
  async function cancelRec() {
    setBusy(true);
    try { await base44.functions.invoke("substitutionWorkflow", { action: "cancel", recommendation_id: id }); load(); } catch (e) { alert("Failed"); }
    setBusy(false);
  }

  if (loading) return <div className="flex items-center justify-center h-96"><div className="w-8 h-8 border-4 border-gray-200 border-t-gray-800 rounded-full animate-spin" /></div>;

  const editable = !rec || rec.status === "Draft";
  const projectId = rec?.project_id || selection?.project_id;
  const areaId = rec?.area_id || selection?.area_id;

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-gray-100"><ArrowLeft size={18} /></button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Substitution Recommendation</h1>
          <p className="text-sm text-gray-500">{requirement?.name} • {originalItem?.name}</p>
        </div>
        {rec && <StatusBadge status={rec.status} />}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
        <h2 className="font-semibold text-gray-900 text-sm">Original Approved Selection</h2>
        <div className="flex gap-4">
          {originalItem?.default_image && <img src={originalItem.default_image} alt="" className="w-20 h-20 object-cover rounded-lg border" />}
          <div>
            <p className="font-medium text-gray-900">{originalItem?.name}</p>
            <p className="text-xs text-gray-500">{originalItem?.supplier} • {originalItem?.sku}</p>
            <div className="mt-1 space-y-0.5">
              {(selection?.selected_options || []).map((o, i) => <p key={i} className="text-xs text-gray-500"><span className="text-gray-400">{o.group_name}:</span> {o.option_name}</p>)}
            </div>
            <p className="text-sm font-semibold mt-1">${originalPrice.toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h2 className="font-semibold text-gray-900 text-sm">Recommended Substitute</h2>
        <div>
          <Label>Substitute Item</Label>
          <Select value={recommendedItem?.id || ""} onValueChange={pickRecommended} disabled={!editable}>
            <SelectTrigger><SelectValue placeholder="Select a substitute" /></SelectTrigger>
            <SelectContent>{catalogueItems.map(i => <SelectItem key={i.id} value={i.id}>{i.name}{i.status !== "Active" ? ` (${i.status})` : ""}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        {recommendedItem && (recommendedItem.option_groups || []).map(group => {
          const avail = getAvailableOptions(recommendedItem, group.id, selectedOptions);
          return (
            <div key={group.id}>
              <Label className="text-xs">{group.name}{group.is_required && <span className="text-red-500"> *</span>}</Label>
              <Select value={selectedOptions[group.id] || ""} onValueChange={v => setSelectedOptions(p => ({ ...p, [group.id]: v }))} disabled={!editable}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select option" /></SelectTrigger>
                <SelectContent>{avail.map(o => <SelectItem key={o.id} value={o.id}>{o.name}{o.price_modifier ? ` (${o.price_modifier > 0 ? "+" : ""}$${o.price_modifier})` : ""}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          );
        })}
        {recommendedItem && (
          <div className="grid grid-cols-3 gap-3 text-sm bg-gray-50 rounded-lg p-3">
            <div><span className="text-gray-500">Original:</span> <span className="font-medium">${originalPrice.toLocaleString()}</span></div>
            <div><span className="text-gray-500">Substitute:</span> <span className="font-medium">${recommendedPrice.toLocaleString()}</span></div>
            <div><span className="text-gray-500">Price impact:</span> <span className={`font-medium ${priceImpact > 0 ? "text-red-600" : priceImpact < 0 ? "text-green-600" : ""}`}>{priceImpact > 0 ? "+" : ""}${priceImpact.toLocaleString()}</span></div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <div><Label>Reason for Substitution *</Label><Textarea value={reason} onChange={e => setReason(e.target.value)} disabled={!editable} rows={2} /></div>
        <div><Label>Schedule Impact</Label><Input value={scheduleImpact} onChange={e => setScheduleImpact(e.target.value)} disabled={!editable} placeholder="e.g. +2 weeks" /></div>
        <div><Label>Customer-Facing Explanation</Label><Textarea value={customerExplanation} onChange={e => setCustomerExplanation(e.target.value)} disabled={!editable} rows={2} placeholder="Shown to the customer" /></div>
        <div><Label>Internal Staff Note</Label><Textarea value={staffNote} onChange={e => setStaffNote(e.target.value)} disabled={!editable} rows={2} placeholder="Visible to staff only" /></div>
      </div>

      <div className="flex flex-wrap gap-2">
        {editable && <Button onClick={saveDraft} disabled={busy || !reason.trim()} className="gap-2"><Save size={14} /> {isNew ? "Create Draft" : "Save Changes"}</Button>}
        {rec && rec.status === "Draft" && <Button onClick={sendToCustomer} disabled={busy} className="gap-2"><Send size={14} /> Send to Customer</Button>}
        {rec && rec.status === "Customer accepted" && <Button onClick={approve} disabled={busy} className="gap-2 bg-emerald-600 hover:bg-emerald-700"><Check size={14} /> Approve & Apply</Button>}
        {rec && !["Staff approved", "Cancelled"].includes(rec.status) && <Button variant="outline" onClick={cancelRec} disabled={busy} className="gap-2 text-red-600"><X size={14} /> Cancel</Button>}
      </div>

      {rec && <CommentThread projectId={projectId} targetType="substitution" targetId={id} staff={true} title="Substitution Comments" />}
    </div>
  );
}