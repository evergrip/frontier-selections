import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Check, X, ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import StatusBadge from "@/components/ui/StatusBadge";
import CommentThread from "@/components/comments/CommentThread";

export default function CustomerSubstitution({ projectId, selectionId, showPricing, readOnly = false }) {
  const [recs, setRecs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    base44.entities.SubstitutionRecommendation.filter({ selection_id: selectionId })
      .then(r => setRecs(r.sort((a, b) => (b.created_date || "").localeCompare(a.created_date || ""))))
      .finally(() => setLoading(false));
  }, [selectionId]);

  async function decide(action) {
    setBusy(true);
    try {
      await base44.functions.invoke("substitutionWorkflow", { action, recommendation_id: active.id, note });
      const r = await base44.entities.SubstitutionRecommendation.filter({ selection_id: selectionId });
      setRecs(r.sort((a, b) => (b.created_date || "").localeCompare(a.created_date || "")));
      setNote("");
    } catch (e) { alert("Failed"); }
    setBusy(false);
  }

  if (loading) return null;
  const active = recs.find(r => ["Sent to customer", "Customer accepted", "Customer rejected"].includes(r.status));
  if (!active) return null;

  const canDecide = active.status === "Sent to customer";

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2"><ArrowLeftRight size={16} className="text-blue-500" /> Substitution Recommendation</h3>
          <StatusBadge status={active.status} />
        </div>
        {active.customer_explanation && <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-800">{active.customer_explanation}</div>}

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs font-medium text-gray-500 mb-2">Original</p>
            <p className="font-medium text-gray-900 text-sm">{active.original_item_name}</p>
            <div className="mt-1 space-y-0.5">
              {(active.original_selected_options || []).map((o, i) => <p key={i} className="text-xs text-gray-500"><span className="text-gray-400">{o.group_name}:</span> {o.option_name}</p>)}
            </div>
          </div>
          <div className="bg-emerald-50 rounded-lg p-3">
            <p className="text-xs font-medium text-emerald-600 mb-2">Recommended Substitute</p>
            <p className="font-medium text-gray-900 text-sm">{active.recommended_item_name}</p>
            <div className="mt-1 space-y-0.5">
              {(active.recommended_options || []).map((o, i) => <p key={i} className="text-xs text-gray-500"><span className="text-gray-400">{o.group_name}:</span> {o.option_name}</p>)}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
          {showPricing && <div><span className="text-gray-500">Price impact:</span> <span className={`ml-1 font-medium ${active.price_impact > 0 ? "text-red-600" : active.price_impact < 0 ? "text-green-600" : ""}`}>{active.price_impact > 0 ? "+" : ""}${(active.price_impact || 0).toLocaleString()}</span></div>}
          {showPricing && <div><span className="text-gray-500">Allowance impact:</span> <span className="ml-1 font-medium">${(active.allowance_impact || 0).toLocaleString()}</span></div>}
          {active.schedule_impact && <div><span className="text-gray-500">Schedule:</span> <span className="ml-1">{active.schedule_impact}</span></div>}
        </div>

        {active.reason && <p className="text-sm text-gray-600"><span className="font-medium">Reason:</span> {active.reason}</p>}

        {canDecide && !readOnly && (
          <div className="space-y-3 pt-2 border-t border-gray-100">
            <div><Label>Comment (optional)</Label><Textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="Any questions or comments..." /></div>
            <div className="flex gap-2">
              <Button onClick={() => decide("accept")} disabled={busy} className="gap-2 bg-emerald-600 hover:bg-emerald-700"><Check size={14} /> Accept Substitution</Button>
              <Button variant="outline" onClick={() => decide("reject")} disabled={busy} className="gap-2 text-red-600"><X size={14} /> Reject</Button>
            </div>
          </div>
        )}
        {canDecide && readOnly && <p className="text-xs text-gray-400 pt-2 border-t border-gray-100">Preview mode — substitution actions disabled.</p>}
        {active.status === "Customer accepted" && <p className="text-sm text-emerald-700">You accepted this substitution. Staff will review and apply it.</p>}
        {active.status === "Customer rejected" && <p className="text-sm text-gray-500">You rejected this substitution.</p>}
        {active.customer_note && <p className="text-xs text-gray-500">Your note: {active.customer_note}</p>}
      </div>

      <CommentThread projectId={projectId} targetType="substitution" targetId={active.id} staff={false} title="Comments" readOnly={readOnly} />
    </div>
  );
}