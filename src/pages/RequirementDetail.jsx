import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Check, X, RotateCcw, Lock, ShoppingCart, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import StatusBadge from "@/components/ui/StatusBadge";
import { SELECTION_STATUSES } from "@/lib/constants";

export default function RequirementDetail() {
  const { projectId, areaId, requirementId } = useParams();
  const [requirement, setRequirement] = useState(null);
  const [selection, setSelection] = useState(null);
  const [catalogueItem, setCatalogueItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showReview, setShowReview] = useState(false);

  useEffect(() => { load(); }, [requirementId]);

  async function load() {
    setLoading(true);
    const [req, sels] = await Promise.all([
      base44.entities.SelectionRequirement.get(requirementId),
      base44.entities.CustomerSelection.filter({ requirement_id: requirementId })
    ]);
    setRequirement(req);
    const current = sels.find(s => s.is_current);
    setSelection(current || null);
    if (current?.catalogue_item_id) {
      const item = await base44.entities.CatalogueItem.get(current.catalogue_item_id);
      setCatalogueItem(item);
    }
    setLoading(false);
  }

  async function handleStatusChange(newStatus, comments = "") {
    if (!selection) return;
    await base44.entities.CustomerSelection.update(selection.id, {
      status: newStatus,
      reviewed_date: new Date().toISOString(),
      staff_comments: comments || selection.staff_comments
    });
    const reqStatus = {
      "Approved": "Approved", "Rejected": "Rejected", "Revision Requested": "Revision Requested"
    }[newStatus];
    if (reqStatus) {
      await base44.entities.SelectionRequirement.update(requirementId, { status: reqStatus });
    }
    load();
  }

  async function handleRequirementStatusChange(newStatus) {
    await base44.entities.SelectionRequirement.update(requirementId, { status: newStatus });
    load();
  }

  if (loading) return <div className="flex items-center justify-center h-96"><div className="w-8 h-8 border-4 border-gray-200 border-t-gray-800 rounded-full animate-spin" /></div>;
  if (!requirement) return <div className="p-8 text-center text-gray-400">Requirement not found</div>;

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link to={`/projects/${projectId}/area/${areaId}`} className="p-2 rounded-lg hover:bg-gray-100"><ArrowLeft size={18} /></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{requirement.name}</h1>
          <p className="text-sm text-gray-500">{requirement.category}{requirement.is_required ? " • Required" : " • Optional"}</p>
        </div>
        <StatusBadge status={requirement.status} />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
        <h2 className="font-semibold text-gray-900 text-sm">Requirement Details</h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><span className="text-gray-500">Allowance:</span> <span className="ml-1">{requirement.allowance_amount ? `$${requirement.allowance_amount.toLocaleString()}` : "None"}</span></div>
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
      </div>

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
            </div>

            {selection.customer_notes && (
              <div className="bg-blue-50 rounded-lg p-3 text-sm">{selection.customer_notes}</div>
            )}

            {selection.status === "Pending" && (
              <div className="flex gap-2 pt-2 border-t border-gray-100">
                <Button size="sm" className="gap-1 bg-emerald-600 hover:bg-emerald-700" onClick={() => handleStatusChange("Approved")}>
                  <Check size={14} /> Approve
                </Button>
                <Button size="sm" variant="outline" className="gap-1" onClick={() => setShowReview(true)}>
                  <RotateCcw size={14} /> Request Revision
                </Button>
                <Button size="sm" variant="outline" className="gap-1 text-red-600 hover:text-red-700" onClick={() => setShowReview(true)}>
                  <X size={14} /> Reject
                </Button>
              </div>
            )}

            {selection.staff_comments && (
              <div className="bg-yellow-50 rounded-lg p-3 text-sm"><span className="font-medium">Staff Comments:</span> {selection.staff_comments}</div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-400 text-sm">No selection submitted yet</p>
        </div>
      )}

      <ReviewDialog open={showReview} onClose={() => setShowReview(false)} onSubmit={handleStatusChange} />
    </div>
  );
}

function ReviewDialog({ open, onClose, onSubmit }) {
  const [action, setAction] = useState("Revision Requested");
  const [comments, setComments] = useState("");

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Review Selection</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div><Label>Action</Label>
            <Select value={action} onValueChange={setAction}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Revision Requested">Request Revision</SelectItem>
                <SelectItem value="Rejected">Reject</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Comments</Label><Textarea value={comments} onChange={e => setComments(e.target.value)} placeholder="Reason for revision or rejection..." rows={3} /></div>
          <Button onClick={() => { onSubmit(action, comments); onClose(); setComments(""); }} className="w-full">Submit Review</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}