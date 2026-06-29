import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { FileSignature, Lock, Unlock, ShieldCheck, AlertTriangle, Truck, Wrench, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function SignOffControls({ selection, procurement, audit, onDone }) {
  const [busy, setBusy] = useState(false);
  const [showUnlock, setShowUnlock] = useState(false);
  const [reason, setReason] = useState("");

  if (!selection || selection.status !== "Approved") return null;

  async function call(payload) {
    setBusy(true);
    try { await base44.functions.invoke("selectionWorkflow", payload); await onDone(); }
    catch (e) { alert("Action failed"); }
    setBusy(false);
  }

  const ordered = procurement && ["Ordered", "Backordered", "Delayed", "Received", "Delivered to Site", "Installed"].includes(procurement.status);
  const installed = procurement && procurement.status === "Installed";

  const staffWarnings = [];
  if (selection.signed_off) staffWarnings.push({ icon: ShieldCheck, text: `Signed off by customer${selection.signed_off_by ? ` (${selection.signed_off_by})` : ""}${selection.signed_off_date ? ` on ${new Date(selection.signed_off_date).toLocaleDateString()}` : ""}` });
  if (selection.locked) staffWarnings.push({ icon: Lock, text: `Selection locked${selection.locked_reason ? `: ${selection.locked_reason}` : ""}` });
  if (ordered) staffWarnings.push({ icon: Truck, text: "Selection already ordered" });
  if (installed) staffWarnings.push({ icon: Wrench, text: "Selection already installed" });
  if (selection.signed_off || selection.locked) staffWarnings.push({ icon: AlertTriangle, text: "Change may affect budget or schedule" });

  const auditEvents = (audit || [])
    .filter(a => ["signed_off", "sign_off_requested", "locked", "unlocked"].includes(a.action))
    .sort((a, b) => (b.created_date || "").localeCompare(a.created_date || ""));

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <div className="flex items-center gap-2"><FileSignature size={16} className="text-gray-500" /><h2 className="font-semibold text-gray-900 text-sm">Sign-off & Locking</h2></div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div><span className="text-gray-500">Sign-off requested:</span> <span className="ml-1">{selection.sign_off_requested ? "Yes" : "No"}</span></div>
        <div><span className="text-gray-500">Signed off:</span> <span className="ml-1">{selection.signed_off ? "Yes" : "No"}</span></div>
        {selection.signed_off_by && <div><span className="text-gray-500">Signed by:</span> <span className="ml-1">{selection.signed_off_by}</span></div>}
        {selection.signed_off_date && <div><span className="text-gray-500">Signed date:</span> <span className="ml-1">{new Date(selection.signed_off_date).toLocaleDateString()}</span></div>}
        {selection.locked && <div><span className="text-gray-500">Locked by:</span> <span className="ml-1">{selection.locked_by || "—"}</span></div>}
        {selection.locked_date && <div><span className="text-gray-500">Locked date:</span> <span className="ml-1">{new Date(selection.locked_date).toLocaleDateString()}</span></div>}
      </div>
      {selection.sign_off_note && <div className="bg-violet-50 rounded-lg p-3 text-sm text-violet-800"><span className="font-medium">Sign-off note:</span> {selection.sign_off_note}</div>}

      {staffWarnings.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1.5">
          {staffWarnings.map((w, i) => { const Icon = w.icon; return <div key={i} className="flex items-start gap-2 text-sm text-amber-800"><Icon size={14} className="mt-0.5 shrink-0" /> {w.text}</div>; })}
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
        {!selection.sign_off_requested && !selection.signed_off && (
          <Button size="sm" variant="outline" className="gap-1" disabled={busy} onClick={() => call({ action: "request_signoff", selection_id: selection.id, project_id: selection.project_id })}><FileSignature size={14} /> Request Sign-off</Button>
        )}
        {selection.signed_off && !selection.locked && (
          <Button size="sm" className="gap-1 bg-gray-800 hover:bg-gray-900" disabled={busy} onClick={() => call({ action: "lock", selection_id: selection.id, project_id: selection.project_id })}><Lock size={14} /> Lock Selection</Button>
        )}
        {selection.locked && (
          <Button size="sm" variant="outline" className="gap-1 text-red-600" disabled={busy} onClick={() => setShowUnlock(true)}><Unlock size={14} /> Unlock</Button>
        )}
      </div>

      {auditEvents.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2"><History size={14} className="text-gray-500" /><p className="text-xs font-medium text-gray-500">Lock & Sign-off History</p></div>
          <div className="space-y-1.5">
            {auditEvents.map(a => (
              <div key={a.id} className="text-xs text-gray-600 border-b border-gray-50 pb-1.5 last:border-0">
                <span className="font-medium capitalize">{a.action.replace(/_/g, " ")}</span> by {a.changed_by || "—"} {a.created_date ? `on ${new Date(a.created_date).toLocaleDateString()}` : ""}
                {a.reason && <span className="text-gray-400"> — {a.reason}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      <Dialog open={showUnlock} onOpenChange={setShowUnlock}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Unlock Selection</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-gray-500">Unlocking allows the customer to edit this selection again. An internal reason is required and will be recorded in the audit history.</p>
            <div><Label>Internal Reason *</Label><Textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} placeholder="Why is this selection being unlocked?" /></div>
            <Button className="w-full" disabled={!reason.trim() || busy} onClick={async () => { setShowUnlock(false); await call({ action: "unlock", selection_id: selection.id, reason }); setReason(""); }}>Unlock Selection</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}