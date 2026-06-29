import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, AlertTriangle, Lock, Unlock, Check, X, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import StatusBadge from "@/components/ui/StatusBadge";
import CommentThread from "@/components/comments/CommentThread";

const PAST_READY = ["Ready to Order", "Ordered", "Backordered", "Received", "Delivered to Site", "Installed", "Locked"];

export default function ChangeRequestDetail() {
  const { changeRequestId } = useParams();
  const [cr, setCr] = useState(null);
  const [requirement, setRequirement] = useState(null);
  const [originalSelection, setOriginalSelection] = useState(null);
  const [audit, setAudit] = useState([]);
  const [loading, setLoading] = useState(true);
  const [staffResponse, setStaffResponse] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [priceImpact, setPriceImpact] = useState("");
  const [allowanceImpact, setAllowanceImpact] = useState("");
  const [dueDate, setDueDate] = useState("");

  useEffect(() => { load(); }, [changeRequestId]);

  async function load() {
    setLoading(true);
    const c = await base44.entities.ChangeRequest.get(changeRequestId);
    setCr(c);
    setStaffResponse(c.staff_response || "");
    setInternalNotes(c.internal_notes || "");
    setPriceImpact(c.price_impact != null ? String(c.price_impact) : "");
    setAllowanceImpact(c.allowance_impact != null ? String(c.allowance_impact) : "");
    setDueDate(c.due_date || "");
    const [req, auditEntries] = await Promise.all([
      base44.entities.SelectionRequirement.get(c.requirement_id),
      base44.entities.AuditLog.filter({ target_id: changeRequestId })
    ]);
    setRequirement(req);
    setAudit(auditEntries.sort((a, b) => (b.created_date || "").localeCompare(a.created_date || "")));
    if (c.selection_id) {
      try { setOriginalSelection(await base44.entities.CustomerSelection.get(c.selection_id)); } catch {}
    }
    setLoading(false);
  }

  const pastReady = PAST_READY.includes(requirement?.status);

  async function updateStatus(status) {
    const updates = {
      status,
      staff_response: staffResponse,
      internal_notes: internalNotes,
      price_impact: priceImpact !== "" ? Number(priceImpact) : (cr.price_impact || 0),
      allowance_impact: allowanceImpact !== "" ? Number(allowanceImpact) : (cr.allowance_impact || 0),
      due_date: dueDate || null,
      reviewed_by: "staff",
      reviewed_date: new Date().toISOString()
    };
    if (["Approved", "Rejected", "Cancelled"].includes(status)) updates.resolved_date = new Date().toISOString();
    await base44.entities.ChangeRequest.update(cr.id, updates);
    await base44.entities.AuditLog.create({
      target_type: "change_request", target_id: cr.id, action: `status_${status.toLowerCase().replace(/ /g, "_")}`,
      field: "status", old_value: cr.status, new_value: status, changed_by: "staff", reason: staffResponse
    });
    if (status === "Approved") {
      if (originalSelection) {
        await base44.entities.CustomerSelection.update(originalSelection.id, { is_current: false, status: "Superseded" });
      }
      const allowanceAmount = requirement?.allowance_amount || 0;
      const reqPrice = cr.requested_price || 0;
      const newSel = await base44.entities.CustomerSelection.create({
        project_id: cr.project_id, area_id: cr.area_id, requirement_id: cr.requirement_id,
        catalogue_item_id: cr.requested_item_id, selected_options: cr.requested_options || [],
        calculated_price: reqPrice, allowance_amount: allowanceAmount,
        over_allowance: Math.max(0, reqPrice - allowanceAmount),
        under_allowance: Math.max(0, allowanceAmount - reqPrice),
        status: "Approved", is_current: true, submitted_date: new Date().toISOString(),
        reviewed_date: new Date().toISOString(), reviewed_by: "staff",
        version: (originalSelection?.version || 0) + 1
      });
      await base44.entities.SelectionRequirement.update(cr.requirement_id, { status: "Changed After Approval" });
      await base44.entities.AllowanceLedger.create({
        project_id: cr.project_id, area_id: cr.area_id, requirement_id: cr.requirement_id,
        event_type: "Selection Changed", amount: reqPrice, running_balance: reqPrice - allowanceAmount,
        description: `Change request approved: ${cr.requested_item_name}`, performed_by: "staff"
      });
      let catItem = null;
      try { catItem = await base44.entities.CatalogueItem.get(cr.requested_item_id); } catch {}
      if (originalSelection) {
        const oldProcs = await base44.entities.ProcurementItem.filter({ selection_id: originalSelection.id });
        for (const op of oldProcs) {
          await base44.entities.ProcurementItem.update(op.id, {
            selection_id: newSel.id, catalogue_item_id: cr.requested_item_id,
            item_name: cr.requested_item_name || catItem?.name || "",
            supplier: catItem?.supplier || "", brand: catItem?.brand || "",
            sku: catItem?.sku || "", status: "Not Ready to Order"
          });
        }
      }
      const existingProc = await base44.entities.ProcurementItem.filter({ selection_id: newSel.id });
      if (existingProc.length === 0) {
        await base44.entities.ProcurementItem.create({
          project_id: cr.project_id, area_id: cr.area_id, requirement_id: cr.requirement_id,
          selection_id: newSel.id, catalogue_item_id: cr.requested_item_id,
          item_name: cr.requested_item_name || catItem?.name || "",
          category: catItem?.category || "", supplier: catItem?.supplier || "",
          brand: catItem?.brand || "", sku: catItem?.sku || "", quantity: 1,
          unit_of_measure: catItem?.unit_of_measure || "", status: "Not Ready to Order"
        });
      }
    }
    load();
  }

  async function toggleLock() {
    const next = !cr.is_locked;
    await base44.entities.ChangeRequest.update(cr.id, { is_locked: next });
    await base44.entities.AuditLog.create({
      target_type: "change_request", target_id: cr.id, action: next ? "locked" : "unlocked",
      field: "is_locked", old_value: String(!next), new_value: String(next), changed_by: "staff"
    });
    load();
  }

  if (loading) return <div className="flex items-center justify-center h-96"><div className="w-8 h-8 border-4 border-gray-200 border-t-gray-800 rounded-full animate-spin" /></div>;
  if (!cr) return <div className="p-8 text-center text-gray-400">Change request not found</div>;

  const resolved = ["Approved", "Rejected", "Cancelled"].includes(cr.status);

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link to="/change-requests" className="p-2 rounded-lg hover:bg-gray-100"><ArrowLeft size={18} /></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Change Request</h1>
          <p className="text-sm text-gray-500">{cr.original_item_name} → {cr.requested_item_name}</p>
        </div>
        <StatusBadge status={cr.status} />
        <Button variant="outline" size="sm" onClick={toggleLock} className="gap-2">{cr.is_locked ? <Lock size={14} /> : <Unlock size={14} />} {cr.is_locked ? "Locked" : "Lock"}</Button>
      </div>

      {pastReady && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 flex items-start gap-2">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" /> This selection has already reached "{requirement.status}" — changing it may affect procurement.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
          <h3 className="font-semibold text-gray-900 text-sm">Original Selection</h3>
          <p className="text-sm text-gray-600">{cr.original_item_name}</p>
          <p className="text-sm font-semibold">${(cr.original_price || 0).toLocaleString()}</p>
          {originalSelection?.selected_options?.map((o, i) => <p key={i} className="text-xs text-gray-500">{o.group_name}: {o.option_name}</p>)}
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
          <h3 className="font-semibold text-gray-900 text-sm">Requested Selection</h3>
          <p className="text-sm text-gray-600">{cr.requested_item_name}</p>
          <p className="text-sm font-semibold">${(cr.requested_price || 0).toLocaleString()}</p>
          {cr.requested_options?.map((o, i) => <p key={i} className="text-xs text-gray-500">{o.group_name}: {o.option_name}</p>)}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2 text-sm">
        <div className="grid grid-cols-2 gap-3">
          <div><span className="text-gray-500">Price Difference:</span> <span className={`ml-1 font-medium ${(cr.price_impact || 0) > 0 ? "text-red-600" : "text-green-600"}`}>{(cr.price_impact || 0) > 0 ? "+" : ""}${(cr.price_impact || 0).toLocaleString()}</span></div>
          <div><span className="text-gray-500">Allowance Impact:</span> <span className="ml-1 font-medium">${(cr.allowance_impact || 0).toLocaleString()}</span></div>
        </div>
        {cr.reason && <div><span className="text-gray-500">Reason:</span> <span className="ml-1">{cr.reason}</span></div>}
        {cr.customer_note && <div className="bg-blue-50 rounded-lg p-3"><span className="font-medium text-blue-800">Customer Note:</span> {cr.customer_note}</div>}
      </div>

      {!resolved && !cr.is_locked && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
          <h3 className="font-semibold text-gray-900 text-sm">Staff Review</h3>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Adjust Price Impact ($)</Label><Input type="number" value={priceImpact} onChange={e => setPriceImpact(e.target.value)} /></div>
            <div><Label>Adjust Allowance Impact ($)</Label><Input type="number" value={allowanceImpact} onChange={e => setAllowanceImpact(e.target.value)} /></div>
          </div>
          <div><Label>Due Date (optional)</Label><Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} /></div>
          <div><Label>Customer-Facing Response</Label><Textarea value={staffResponse} onChange={e => setStaffResponse(e.target.value)} rows={2} /></div>
          <div><Label>Internal Notes</Label><Textarea value={internalNotes} onChange={e => setInternalNotes(e.target.value)} rows={2} /></div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" className="gap-1 bg-emerald-600 hover:bg-emerald-700" onClick={() => updateStatus("Approved")}><Check size={14} /> Approve</Button>
            <Button size="sm" variant="outline" className="gap-1" onClick={() => updateStatus("More Information Needed")}><MessageCircle size={14} /> Request Info</Button>
            <Button size="sm" variant="outline" className="gap-1 text-red-600" onClick={() => updateStatus("Rejected")}><X size={14} /> Reject</Button>
            <Button size="sm" variant="outline" onClick={() => updateStatus("Under Review")}>Mark Under Review</Button>
          </div>
        </div>
      )}

      {cr.staff_response && (
        <div className="bg-blue-50 rounded-lg p-3 text-sm"><span className="font-medium">Staff Response:</span> {cr.staff_response}</div>
      )}
      {cr.internal_notes && (
        <div className="bg-yellow-50 rounded-lg p-3 text-sm"><span className="font-medium">Internal Notes:</span> {cr.internal_notes}</div>
      )}

      {audit.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-900 text-sm mb-3">Audit History</h3>
          <div className="space-y-2">
            {audit.map(a => (
              <div key={a.id} className="text-sm border-b border-gray-50 pb-2 last:border-0">
                <p className="font-medium text-gray-900">{a.action.replace(/_/g, " ")}</p>
                <p className="text-xs text-gray-400">{a.changed_by || ""} • {a.created_date ? new Date(a.created_date).toLocaleString() : ""}</p>
                {a.old_value && a.new_value && <p className="text-xs text-gray-500">{a.field}: "{a.old_value}" → "{a.new_value}"</p>}
                {a.reason && <p className="text-xs text-gray-500">Note: {a.reason}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      <CommentThread projectId={cr.project_id} targetType="change_request" targetId={cr.id} staff={true} title="Change Request Comments" />
    </div>
  );
}