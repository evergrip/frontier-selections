import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Check, X, RotateCcw, AlertTriangle, Clock, PackageX, Tag, Edit2, History, ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import StatusBadge from "@/components/ui/StatusBadge";
import CommentThread from "@/components/comments/CommentThread";
import SignOffControls from "@/components/selection/SignOffControls";
import { SELECTION_STATUSES, CATALOGUE_ACCESS_MODES, hasPermission } from "@/lib/constants";
import ContextualHelpLink from "@/components/training/ContextualHelpLink";
import SuggestedOptionsManager from "@/components/selection/SuggestedOptionsManager";

function assembleItem(item, groups, values, rules) {
  const itemGroups = (groups || [])
    .filter(g => g.catalogue_item_id === item.id)
    .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
    .map(g => ({
      id: g.id, name: g.name, is_required: g.is_required !== false,
      options: (values || []).filter(v => v.option_group_id === g.id)
        .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
    }));
  const itemRules = (rules || []).filter(r => r.catalogue_item_id === item.id).map(r => ({
    ...r, condition_option_id: r.condition_option_value_id, target_option_id: r.target_option_value_id
  }));
  return { ...item, option_groups: itemGroups, option_rules: itemRules };
}

function getAvailableOptions(item, groupId, selections) {
  const group = item?.option_groups?.find(g => g.id === groupId);
  if (!group) return [];
  let available = group.options.filter(o => o.is_active !== false);
  const rules = item.option_rules || [];
  for (const rule of rules) {
    if (rule.target_group_id !== groupId || rule.action !== "hide" || !rule.target_option_id) continue;
    if (selections[rule.condition_group_id] === rule.condition_option_id) {
      available = available.filter(o => o.id !== rule.target_option_id);
    }
  }
  const showRules = rules.filter(r => r.target_group_id === groupId && r.action === "show" && r.target_option_id && selections[r.condition_group_id] === r.condition_option_id);
  if (showRules.length > 0) {
    const shownIds = new Set(showRules.map(r => r.target_option_id));
    available = available.filter(o => shownIds.has(o.id));
  }
  return available;
}

export default function RequirementDetail() {
  const { projectId, areaId, requirementId } = useParams();
  const [requirement, setRequirement] = useState(null);
  const [selection, setSelection] = useState(null);
  const [catalogueItem, setCatalogueItem] = useState(null);
  const [assembledItem, setAssembledItem] = useState(null);
  const [ledger, setLedger] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showReview, setShowReview] = useState(false);
  const [reviewAction, setReviewAction] = useState("Approved");
  const [showEditAllowance, setShowEditAllowance] = useState(false);
  const [linkedMb, setLinkedMb] = useState([]);
  const [linking, setLinking] = useState(false);
  const [projectMb, setProjectMb] = useState([]);
  const [proc, setProc] = useState(null);
  const [audit, setAudit] = useState([]);
  const [substitutions, setSubstitutions] = useState([]);
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [requirementId]);

  const selfApprovalWarning = selection && user && selection.created_by_id === user.id && selection.status === "Pending";

  async function load() {
    setLoading(true);
    const [req, sels, ledgerEntries] = await Promise.all([
      base44.entities.SelectionRequirement.get(requirementId),
      base44.entities.CustomerSelection.filter({ requirement_id: requirementId }),
      base44.entities.AllowanceLedger.filter({ requirement_id: requirementId })
    ]);
    setRequirement(req);
    setLedger(ledgerEntries.sort((a, b) => (b.created_date || "").localeCompare(a.created_date || "")));
    const current = sels.find(s => s.is_current);
    setSelection(current || null);
    if (current?.catalogue_item_id) {
      const item = await base44.entities.CatalogueItem.get(current.catalogue_item_id);
      setCatalogueItem(item);
      const [groups, values, rules] = await Promise.all([
        base44.entities.CatalogueOptionGroup.filter({ catalogue_item_id: item.id }, null, 500),
        base44.entities.CatalogueOptionValue.filter({ catalogue_item_id: item.id }, null, 500),
        base44.entities.CatalogueOptionRule.filter({ catalogue_item_id: item.id }, null, 500)
      ]);
      setAssembledItem(assembleItem(item, groups, values, rules));
    } else {
      setAssembledItem(null);
    }
    if (current) {
      const [procItems, auditEntries, subs] = await Promise.all([
        base44.entities.ProcurementItem.filter({ selection_id: current.id }),
        base44.entities.AuditLog.filter({ target_type: "selection", target_id: current.id }),
        base44.entities.SubstitutionRecommendation.filter({ selection_id: current.id })
      ]);
      setProc(procItems[0] || null);
      setAudit(auditEntries);
      setSubstitutions(subs);
    } else { setProc(null); setAudit([]); setSubstitutions([]); }
    const linkedMbItems = await base44.entities.MoodBoardItem.filter({ linked_requirement_id: requirementId });
    setLinkedMb(linkedMbItems);
    setLoading(false);
  }

  async function handleToggleLink() {
    if (linking) { setLinking(false); return; }
    const mb = await base44.entities.MoodBoardItem.filter({ project_id: projectId }, "-created_date", 300);
    setProjectMb(mb.filter(m => !m.linked_requirement_id));
    setLinking(true);
  }

  async function handleLinkItem(mbId) {
    await base44.entities.MoodBoardItem.update(mbId, { linked_requirement_id: requirementId });
    setLinking(false);
    load();
  }

  const allowance = requirement?.allowance_amount || 0;

  const warnings = useMemo(() => {
    const list = [];
    if (!selection || !catalogueItem) return list;
    const selMap = {};
    (selection.selected_options || []).forEach(o => { selMap[o.group_id] = o.option_id; });
    if ((selection.over_allowance || 0) > 0) {
      list.push({ icon: AlertTriangle, tone: "red", text: `Over allowance by $${selection.over_allowance.toLocaleString()}` });
    }
    if (assembledItem) {
      (assembledItem.option_groups || []).forEach(g => {
        if (g.is_required && !selMap[g.id]) {
          list.push({ icon: AlertTriangle, tone: "red", text: `Missing required option: ${g.name}` });
        }
      });
      (selection.selected_options || []).forEach(o => {
        const avail = getAvailableOptions(assembledItem, o.group_id, selMap);
        if (!avail.some(opt => opt.id === o.option_id)) {
          list.push({ icon: PackageX, tone: "red", text: `"${o.option_name}" is no longer available for this combination` });
        }
      });
      (selection.selected_options || []).forEach(o => {
        const group = assembledItem.option_groups.find(g => g.id === o.group_id);
        const opt = group?.options.find(opt => opt.id === o.option_id);
        if (opt?.requires_approval) {
          list.push({ icon: Tag, tone: "amber", text: `"${o.option_name}" is a special-order item requiring approval` });
        }
      });
    }
    const itemStatus = catalogueItem.status;
    if (["Discontinued", "Inactive", "Temporarily Unavailable"].includes(itemStatus)) {
      list.push({ icon: PackageX, tone: "red", text: `Catalogue item is ${itemStatus} — substitution recommended` });
    } else if (["Backordered", "Special Order Only", "Substitution Recommended"].includes(itemStatus)) {
      list.push({ icon: AlertTriangle, tone: "amber", text: `Catalogue item is ${itemStatus}` });
    }
    (selection.selected_options || []).forEach(o => {
      const group = assembledItem.option_groups.find(g => g.id === o.group_id);
      const opt = group?.options.find(opt => opt.id === o.option_id);
      const os = opt?.status;
      if (os && ["Discontinued", "Inactive", "Temporarily Unavailable"].includes(os)) {
        list.push({ icon: PackageX, tone: "red", text: `Option "${o.option_name}" is ${os}` });
      } else if (os && ["Backordered", "Special Order Only", "Substitution Recommended"].includes(os)) {
        list.push({ icon: AlertTriangle, tone: "amber", text: `Option "${o.option_name}" is ${os}` });
      }
    });
    if (catalogueItem.lead_time) {
      list.push({ icon: Clock, tone: "amber", text: `Lead time: ${catalogueItem.lead_time}` });
    }
    return list;
  }, [selection, catalogueItem, assembledItem]);

  async function handleReview(action, data) {
    if (!selection) return;
    try {
      await base44.functions.invoke("selectionWorkflow", {
        action: "review",
        selection_id: selection.id,
        review_action: action,
        staff_price_override: data.staffPriceOverride,
        allowance_impact: data.allowanceImpact,
        customer_comments: data.customerComments,
        internal_notes: data.internalNotes
      });
    } catch (e) { alert("Review failed"); }
    load();
  }

  async function handleRequirementStatusChange(newStatus) {
    try {
      await base44.functions.invoke("selectionWorkflow", {
        action: "change_requirement_status",
        requirement_id: requirementId,
        new_status: newStatus
      });
    } catch (e) { alert("Status change failed"); }
    load();
  }

  async function handleAccessModeChange(newMode) {
    const oldMode = requirement.customer_catalogue_access_mode || "suggested_only";
    try {
      await base44.entities.SelectionRequirement.update(requirementId, { customer_catalogue_access_mode: newMode });
      await base44.entities.AuditLog.create({
        target_type: "requirement",
        target_id: requirementId,
        action: "catalogue_access_mode_changed",
        description: "Customer catalogue access mode changed",
        actor_user_id: user?.id,
        actor_name: user?.full_name || user?.email,
        project_id: projectId,
        field: "customer_catalogue_access_mode",
        old_value: oldMode,
        new_value: newMode,
        severity: "medium"
      });
    } catch (e) { alert("Failed to change access mode"); }
    load();
  }

  if (loading) return <div className="flex items-center justify-center h-96"><div className="w-8 h-8 border-4 border-gray-200 border-t-gray-800 rounded-full animate-spin" /></div>;
  if (!requirement) return <div className="p-8 text-center text-gray-400">Requirement not found</div>;

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link to={`/projects/${projectId}`} className="p-2 rounded-lg hover:bg-gray-100"><ArrowLeft size={18} /></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{requirement.name}</h1>
          <p className="text-sm text-gray-500">{requirement.category}{requirement.is_required ? " • Required" : " • Optional"}</p>
        </div>
        <StatusBadge status={requirement.status} />
        <ContextualHelpLink category="Approvals" relatedModule="Selections" label="How to approve or reject selections" />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 text-sm">Requirement Details</h2>
          <Button variant="outline" size="sm" onClick={() => setShowEditAllowance(true)} className="gap-2"><Edit2 size={12} /> Edit Allowance</Button>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><span className="text-gray-500">Allowance:</span> <span className="ml-1">{allowance ? `$${allowance.toLocaleString()}` : "None"}</span></div>
          <div><span className="text-gray-500">Due Date:</span> <span className="ml-1">{requirement.due_date || "Not set"}</span></div>
          <div><span className="text-gray-500">Approval Required:</span> <span className="ml-1">{requirement.approval_required ? "Yes" : "No"}</span></div>
          <div><span className="text-gray-500">Locked After Approval:</span> <span className="ml-1">{requirement.lock_after_approval ? "Yes" : "No"}</span></div>
        </div>
        {requirement.customer_instructions && (
          <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-800">{requirement.customer_instructions}</div>
        )}
        {requirement.staff_notes && (
          <div className="bg-yellow-50 rounded-lg p-3 text-sm text-yellow-800">{requirement.staff_notes}</div>
        )}
        <div className="flex items-center gap-2 pt-2">
          <Label className="text-xs text-gray-500">Status:</Label>
          <Select value={requirement.status} onValueChange={handleRequirementStatusChange}>
            <SelectTrigger className="w-48 text-xs h-8"><SelectValue /></SelectTrigger>
            <SelectContent>{SELECTION_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>

        <div className="border-t border-gray-100 pt-3">
          <Label className="text-xs text-gray-500">Customer Catalogue Access Mode:</Label>
          <Select
            value={requirement.customer_catalogue_access_mode || "suggested_only"}
            onValueChange={handleAccessModeChange}
            disabled={!hasPermission(user, "set_catalogue_access_mode")}
          >
            <SelectTrigger className="w-full mt-1 text-xs h-8"><SelectValue /></SelectTrigger>
            <SelectContent>{CATALOGUE_ACCESS_MODES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      {hasPermission(user, "manage_suggested_options") || hasPermission(user, "preview_customer_view") ? (
        <SuggestedOptionsManager requirement={requirement} projectId={projectId} areaId={areaId} user={user} onUpdated={load} />
      ) : null}

      {selection ? (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Customer Selection</h2>
            <StatusBadge status={selection.status} />
          </div>
          <div className="p-5 space-y-4">
            {catalogueItem && (
              <div className="flex gap-4">
                {catalogueItem.default_image && (
                  <img src={catalogueItem.default_image} alt={catalogueItem.name} className="w-24 h-24 object-cover rounded-lg border" />
                )}
                <div>
                  <h3 className="font-medium text-gray-900">{catalogueItem.name}</h3>
                  <p className="text-xs text-gray-500">{catalogueItem.category} • {catalogueItem.supplier}</p>
                  <p className="text-sm font-semibold mt-1">${(selection.calculated_price || 0).toLocaleString()}</p>
                </div>
              </div>
            )}

            {selection.selected_options?.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">Selected Options</p>
                <div className="space-y-1">
                  {selection.selected_options.map((opt, i) => (
                    <div key={i} className="flex items-center justify-between text-sm bg-gray-50 rounded-lg px-3 py-2">
                      <span><span className="text-gray-500">{opt.group_name}:</span> <span className="font-medium">{opt.option_name}</span></span>
                      {opt.price_modifier !== 0 && (
                        <span className={opt.price_modifier > 0 ? "text-red-600" : "text-green-600"}>
                          {opt.price_modifier > 0 ? "+" : ""}${opt.price_modifier.toLocaleString()}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-500">Total Price:</span> <span className="ml-1 font-semibold">${(selection.calculated_price || 0).toLocaleString()}</span></div>
              <div><span className="text-gray-500">Allowance:</span> <span className="ml-1">${(selection.allowance_amount || 0).toLocaleString()}</span></div>
              {selection.over_allowance > 0 && (
                <div className="col-span-2 text-red-600 flex items-center gap-1">
                  <AlertTriangle size={14} /> Over allowance by ${selection.over_allowance.toLocaleString()}
                </div>
              )}
              {selection.under_allowance > 0 && (
                <div className="col-span-2 text-green-600 flex items-center gap-1">
                  Under allowance by ${selection.under_allowance.toLocaleString()}
                </div>
              )}
            </div>

            {selection.customer_notes && (
              <div className="bg-blue-50 rounded-lg p-3 text-sm"><span className="font-medium text-blue-800">Customer Notes:</span> {selection.customer_notes}</div>
            )}

            {warnings.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1.5">
                <p className="text-xs font-semibold text-amber-800">Review Warnings</p>
                {warnings.map((w, i) => {
                  const Icon = w.icon;
                  return (
                    <div key={i} className={`flex items-start gap-2 text-sm ${w.tone === "red" ? "text-red-700" : "text-amber-700"}`}>
                      <Icon size={14} className="mt-0.5 shrink-0" /> {w.text}
                    </div>
                  );
                })}
              </div>
            )}

            {selfApprovalWarning && (
              <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 flex items-start gap-2">
                <AlertTriangle size={16} className="text-amber-600 mt-0.5 shrink-0" />
                <p className="text-sm text-amber-800">
                  You submitted this selection on behalf of the customer. Approval by another staff member is recommended.
                </p>
              </div>
            )}

            {selection.status === "Pending" && (
              <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                <Button size="sm" className="gap-1 bg-emerald-600 hover:bg-emerald-700" onClick={() => { setReviewAction("Approved"); setShowReview(true); }}>
                  <Check size={14} /> Approve
                </Button>
                <Button size="sm" variant="outline" className="gap-1" onClick={() => { setReviewAction("Revision Requested"); setShowReview(true); }}>
                  <RotateCcw size={14} /> Request Revision
                </Button>
                <Button size="sm" variant="outline" className="gap-1 text-red-600 hover:text-red-700" onClick={() => { setReviewAction("Rejected"); setShowReview(true); }}>
                  <X size={14} /> Reject
                </Button>
              </div>
            )}

            {selection.staff_comments && (
              <div className="bg-blue-50 rounded-lg p-3 text-sm"><span className="font-medium">Customer-Facing Comments:</span> {selection.staff_comments}</div>
            )}
            {selection.internal_notes && (
              <div className="bg-yellow-50 rounded-lg p-3 text-sm"><span className="font-medium">Internal Notes:</span> {selection.internal_notes}</div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-400 text-sm">No selection submitted yet</p>
        </div>
      )}

      <SignOffControls selection={selection} procurement={proc} audit={audit} onDone={load} />

      {selection && selection.status === "Approved" && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 text-sm">Substitutions</h2>
            <Button size="sm" variant="outline" asChild><Link to={`/substitution/new?selection=${selection.id}`} className="gap-2"><ArrowLeftRight size={14} /> Recommend Substitution</Link></Button>
          </div>
          {substitutions.length === 0 ? (
            <p className="text-sm text-gray-400">No substitution recommendations.</p>
          ) : (
            <div className="space-y-2">
              {substitutions.map(s => (
                <Link key={s.id} to={`/substitution/${s.id}`} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 hover:bg-gray-100">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{s.original_item_name} → {s.recommended_item_name}</p>
                    <p className="text-xs text-gray-500">{s.reason}</p>
                  </div>
                  <StatusBadge status={s.status} />
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {ledger.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <History size={16} className="text-gray-500" />
            <h2 className="font-semibold text-gray-900 text-sm">Allowance Ledger</h2>
          </div>
          <div className="space-y-2">
            {ledger.map(e => (
              <div key={e.id} className="flex items-center justify-between text-sm border-b border-gray-50 pb-2 last:border-0">
                <div>
                  <p className="font-medium text-gray-900">{e.event_type}</p>
                  <p className="text-xs text-gray-400">{e.description || ""}</p>
                </div>
                <div className="text-right">
                  <p className="font-medium">${(e.amount || 0).toLocaleString()}</p>
                  <p className="text-xs text-gray-400">{e.performed_by || ""}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900 text-sm">Mood Board References</h2>
          <Button variant="outline" size="sm" onClick={handleToggleLink}>{linking ? "Cancel" : "Link Item"}</Button>
        </div>
        {linkedMb.length > 0 ? (
          <div className="flex gap-3 flex-wrap">
            {linkedMb.map(m => (
              <div key={m.id} className="w-20">
                {m.image_url ? <img src={m.image_url} alt="" className="w-20 h-20 object-cover rounded-lg border" /> : <div className="w-20 h-20 bg-gray-100 rounded-lg border flex items-center justify-center text-gray-400 text-[10px] p-1 text-center">{m.notes || "No image"}</div>}
                <p className="text-[10px] text-gray-500 mt-1 truncate">{(m.tags || []).join(", ")}</p>
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-gray-400">No mood board items linked to this requirement.</p>}
        {linking && (
          <div className="mt-3">
            <Select onValueChange={handleLinkItem}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Select a mood board item to link" /></SelectTrigger>
              <SelectContent>
                {projectMb.length === 0 && <SelectItem value={null} disabled>No unlinked items</SelectItem>}
                {projectMb.map(m => <SelectItem key={m.id} value={m.id}>{m.notes || (m.tags || []).join(", ") || "Item"}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <CommentThread projectId={projectId} targetType="requirement" targetId={requirementId} staff={true} title="Requirement Comments" />
      {selection && (
        <CommentThread projectId={projectId} targetType="selection" targetId={selection.id} staff={true} title="Selection Comments" />
      )}

      <ReviewDialog open={showReview} onClose={() => setShowReview(false)} initialAction={reviewAction} selection={selection} allowance={allowance} onSubmit={handleReview} />
      <EditAllowanceDialog open={showEditAllowance} onClose={() => setShowEditAllowance(false)} requirement={requirement} onUpdated={load} />
    </div>
  );
}

function ReviewDialog({ open, onClose, initialAction, selection, allowance, onSubmit }) {
  const [action, setAction] = useState("Approved");
  const [staffPriceOverride, setStaffPriceOverride] = useState("");
  const [allowanceImpact, setAllowanceImpact] = useState("");
  const [customerComments, setCustomerComments] = useState("");
  const [internalNotes, setInternalNotes] = useState("");

  useEffect(() => {
    if (open) {
      setAction(initialAction || "Approved");
      setStaffPriceOverride(""); setAllowanceImpact(""); setCustomerComments(""); setInternalNotes("");
    }
  }, [open, initialAction]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Review Selection</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div><Label>Action</Label>
            <Select value={action} onValueChange={setAction}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Approved">Approve</SelectItem>
                <SelectItem value="Revision Requested">Request Revision</SelectItem>
                <SelectItem value="Rejected">Reject</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {action === "Approved" && (
            <>
              <div><Label>Adjust Final Price ($)</Label>
                <Input type="number" value={staffPriceOverride} onChange={e => setStaffPriceOverride(e.target.value)} placeholder={`Default: $${(selection?.calculated_price || 0).toLocaleString()}`} />
              </div>
              <div><Label>Adjust Allowance Impact ($)</Label>
                <Input type="number" value={allowanceImpact} onChange={e => setAllowanceImpact(e.target.value)} placeholder="Positive = overage, negative = credit" />
              </div>
            </>
          )}
          <div><Label>Customer-Facing Comments</Label><Textarea value={customerComments} onChange={e => setCustomerComments(e.target.value)} placeholder="Shown to the customer..." rows={2} /></div>
          <div><Label>Internal Notes (staff only)</Label><Textarea value={internalNotes} onChange={e => setInternalNotes(e.target.value)} placeholder="Visible to staff only..." rows={2} /></div>
          <Button onClick={() => { onSubmit(action, { staffPriceOverride, allowanceImpact, customerComments, internalNotes }); onClose(); }} className="w-full">Submit Review</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditAllowanceDialog({ open, onClose, requirement, onUpdated }) {
  const [allowance, setAllowance] = useState(0);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (requirement) setAllowance(requirement.allowance_amount || 0); }, [requirement]);
  async function handleSave() {
    setSaving(true);
    await base44.entities.SelectionRequirement.update(requirement.id, { allowance_amount: Number(allowance) || 0 });
    setSaving(false);
    onUpdated();
    onClose();
  }
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>Edit Requirement Allowance</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div><Label>Allowance ($)</Label><Input type="number" value={allowance} onChange={e => setAllowance(e.target.value)} /></div>
          <Button onClick={handleSave} disabled={saving} className="w-full">{saving ? "Saving..." : "Save"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}