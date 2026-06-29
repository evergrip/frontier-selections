import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DEPENDENCY_TYPES } from "@/lib/constants";

export default function DependencyDialog({ open, onClose, projectId, dependency, requirements, areas, onSaved }) {
  const [parentReqId, setParentReqId] = useState("");
  const [dependentReqId, setDependentReqId] = useState("");
  const [depType, setDepType] = useState("Informational only");
  const [ruleNote, setRuleNote] = useState("");
  const [warningMessage, setWarningMessage] = useState("");
  const [blocksSubmission, setBlocksSubmission] = useState(false);
  const [blocksApproval, setBlocksApproval] = useState(false);
  const [allowedItemIds, setAllowedItemIds] = useState([]);
  const [allowedOptionIds, setAllowedOptionIds] = useState([]);
  const [catalogueItems, setCatalogueItems] = useState([]);
  const [optionGroups, setOptionGroups] = useState([]);
  const [optionValues, setOptionValues] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (dependency) {
      setParentReqId(dependency.parent_requirement_id || "");
      setDependentReqId(dependency.dependent_requirement_id || "");
      setDepType(dependency.dependency_type || "Informational only");
      setRuleNote(dependency.rule_note || "");
      setWarningMessage(dependency.warning_message || "");
      setBlocksSubmission(!!dependency.blocks_submission);
      setBlocksApproval(!!dependency.blocks_approval);
      setAllowedItemIds(dependency.allowed_catalogue_item_ids || []);
      setAllowedOptionIds(dependency.allowed_option_value_ids || []);
    } else {
      setParentReqId(""); setDependentReqId(""); setDepType("Informational only");
      setRuleNote(""); setWarningMessage(""); setBlocksSubmission(false); setBlocksApproval(false);
      setAllowedItemIds([]); setAllowedOptionIds([]);
    }
  }, [open, dependency]);

  const dependentReq = requirements.find(r => r.id === dependentReqId);

  useEffect(() => {
    if (!dependentReq?.category) { setCatalogueItems([]); setOptionGroups([]); setOptionValues([]); return; }
    let cancelled = false;
    (async () => {
      const [items, groups, values] = await Promise.all([
        base44.entities.CatalogueItem.filter({ category: dependentReq.category }, "name", 200),
        base44.entities.CatalogueOptionGroup.filter({ is_active: true }, null, 500),
        base44.entities.CatalogueOptionValue.filter({ is_active: true }, null, 500)
      ]);
      if (cancelled) return;
      const itemIds = new Set(items.map(i => i.id));
      setCatalogueItems(items);
      setOptionGroups((groups || []).filter(g => itemIds.has(g.catalogue_item_id)));
      setOptionValues((values || []).filter(v => itemIds.has(v.catalogue_item_id)));
    })();
    return () => { cancelled = true; };
  }, [dependentReqId]);

  function toggleItemId(id) {
    setAllowedItemIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }
  function toggleOptionId(id) {
    setAllowedOptionIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  async function handleSave() {
    if (!parentReqId || !dependentReqId || parentReqId === dependentReqId) { alert("Select two different requirements"); return; }
    setSaving(true);
    const payload = {
      project_id: projectId,
      area_id: requirements.find(r => r.id === dependentReqId)?.area_id || null,
      parent_requirement_id: parentReqId,
      dependent_requirement_id: dependentReqId,
      dependency_type: depType,
      rule_note: ruleNote,
      warning_message: warningMessage,
      blocks_submission: blocksSubmission,
      blocks_approval: blocksApproval,
      allowed_catalogue_item_ids: depType === "Limits available catalogue items" ? allowedItemIds : [],
      allowed_option_value_ids: depType === "Limits available option values" ? allowedOptionIds : [],
      is_active: true
    };
    try {
      if (dependency) await base44.entities.SelectionDependency.update(dependency.id, payload);
      else await base44.entities.SelectionDependency.create(payload);
      onSaved();
      onClose();
    } catch (e) { alert("Save failed"); }
    setSaving(false);
  }

  const showItemLimits = depType === "Limits available catalogue items";
  const showOptionLimits = depType === "Limits available option values";

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{dependency ? "Edit Dependency" : "Add Dependency"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Parent Selection (prerequisite) *</Label>
            <Select value={parentReqId} onValueChange={setParentReqId}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Select parent requirement" /></SelectTrigger>
              <SelectContent>
                {requirements.filter(r => r.id !== dependentReqId).map(r => (
                  <SelectItem key={r.id} value={r.id}>{r.name} ({areas.find(a => a.id === r.area_id)?.name || "—"})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Dependent Selection *</Label>
            <Select value={dependentReqId} onValueChange={setDependentReqId}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Select dependent requirement" /></SelectTrigger>
              <SelectContent>
                {requirements.filter(r => r.id !== parentReqId).map(r => (
                  <SelectItem key={r.id} value={r.id}>{r.name} ({areas.find(a => a.id === r.area_id)?.name || "—"})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Dependency Type</Label>
            <Select value={depType} onValueChange={setDepType}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>{DEPENDENCY_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Rule / Note</Label><Input value={ruleNote} onChange={e => setRuleNote(e.target.value)} placeholder="Internal description of the rule" /></div>
          <div><Label>Warning Message (shown to customer)</Label><Textarea value={warningMessage} onChange={e => setWarningMessage(e.target.value)} rows={2} placeholder="e.g. Please choose your sink before finalizing your faucet." /></div>
          <div className="flex flex-col gap-3">
            <label className="flex items-center justify-between text-sm">
              <span>Blocks customer submission until parent is selected</span>
              <Switch checked={blocksSubmission} onCheckedChange={setBlocksSubmission} />
            </label>
            <label className="flex items-center justify-between text-sm">
              <span>Blocks staff approval until parent is approved</span>
              <Switch checked={blocksApproval} onCheckedChange={setBlocksApproval} />
            </label>
          </div>

          {showItemLimits && (
            <div>
              <Label>Allowed Catalogue Items ({allowedItemIds.length} selected)</Label>
              <div className="mt-1 max-h-48 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-50">
                {catalogueItems.length === 0 && <p className="p-3 text-sm text-gray-400">No items in this category</p>}
                {catalogueItems.map(item => (
                  <label key={item.id} className="flex items-center gap-2 p-2 text-sm hover:bg-gray-50 cursor-pointer">
                    <input type="checkbox" checked={allowedItemIds.includes(item.id)} onChange={() => toggleItemId(item.id)} className="rounded border-gray-300" />
                    <span>{item.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {showOptionLimits && (
            <div>
              <Label>Allowed Option Values ({allowedOptionIds.length} selected)</Label>
              <div className="mt-1 max-h-64 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-50">
                {catalogueItems.length === 0 && <p className="p-3 text-sm text-gray-400">No items in this category</p>}
                {catalogueItems.map(item => {
                  const groups = optionGroups.filter(g => g.catalogue_item_id === item.id);
                  if (groups.length === 0) return null;
                  return (
                    <div key={item.id} className="p-2">
                      <p className="text-xs font-semibold text-gray-700 mb-1">{item.name}</p>
                      {groups.map(g => (
                        <div key={g.id} className="ml-2 mb-1">
                          <p className="text-[11px] text-gray-500">{g.name}</p>
                          {optionValues.filter(v => v.option_group_id === g.id).map(v => (
                            <label key={v.id} className="flex items-center gap-2 ml-2 py-0.5 text-sm hover:bg-gray-50 cursor-pointer">
                              <input type="checkbox" checked={allowedOptionIds.includes(v.id)} onChange={() => toggleOptionId(v.id)} className="rounded border-gray-300" />
                              <span>{v.name}</span>
                            </label>
                          ))}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <Button onClick={handleSave} disabled={saving} className="w-full">{saving ? "Saving..." : "Save Dependency"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}