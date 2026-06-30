import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useParams, Link } from "react-router-dom";
import { toast } from "@/components/ui/use-toast";
import { ArrowLeft, AlertTriangle, Upload, X, Save, ExternalLink, FolderKanban, ClipboardCheck, Package, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import StatusBadge from "@/components/ui/StatusBadge";
import CommentThread from "@/components/comments/CommentThread";
import NextActionPanel from "@/components/staff/NextActionPanel";
import { PROCUREMENT_STATUSES } from "@/lib/constants";
import ContextualHelpLink from "@/components/training/ContextualHelpLink";

const today = new Date().toISOString().slice(0, 10);
const DONE_STATUSES = ["Received", "Delivered to Site", "Installed", "Cancelled", "Returned"];

export default function ProcurementDetail() {
  const { procurementId } = useParams();
  const [item, setItem] = useState(null);
  const [catItem, setCatItem] = useState(null);
  const [project, setProject] = useState(null);
  const [area, setArea] = useState(null);
  const [requirement, setRequirement] = useState(null);
  const [selection, setSelection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({});

  useEffect(() => { load(); }, [procurementId]);

  async function load() {
    setLoading(true);
    const p = await base44.entities.ProcurementItem.get(procurementId);
    setItem(p);
    setForm({
      supplier: p.supplier || "", brand: p.brand || "", sku: p.sku || "",
      quantity: p.quantity ?? 1, unit_of_measure: p.unit_of_measure || "",
      status: p.status || "Not Ready to Order",
      purchase_order_number: p.purchase_order_number || "",
      supplier_order_number: p.supplier_order_number || "",
      order_date: p.order_date || "", expected_delivery_date: p.expected_delivery_date || "",
      actual_received_date: p.actual_received_date || "",
      delivered_to_site_date: p.delivered_to_site_date || "",
      installed_date: p.installed_date || "",
      procurement_notes: p.procurement_notes || "", site_notes: p.site_notes || "",
      internal_staff_notes: p.internal_staff_notes || "", attachments: p.attachments || []
    });
    const [proj, ar, req, sel] = await Promise.all([
      p.project_id ? base44.entities.Project.get(p.project_id).catch(() => null) : null,
      p.area_id ? base44.entities.ProjectArea.get(p.area_id).catch(() => null) : null,
      p.requirement_id ? base44.entities.SelectionRequirement.get(p.requirement_id).catch(() => null) : null,
      p.selection_id ? base44.entities.CustomerSelection.get(p.selection_id).catch(() => null) : null
    ]);
    setProject(proj); setArea(ar); setRequirement(req); setSelection(sel);
    if (p.catalogue_item_id) setCatItem(await base44.entities.CatalogueItem.get(p.catalogue_item_id).catch(() => null));
    setLoading(false);
  }

  function setField(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    try {
      await base44.entities.ProcurementItem.update(procurementId, {
        supplier: form.supplier, brand: form.brand, sku: form.sku,
        quantity: Number(form.quantity) || 0, unit_of_measure: form.unit_of_measure,
        status: form.status, purchase_order_number: form.purchase_order_number,
        supplier_order_number: form.supplier_order_number,
        order_date: form.order_date || null, expected_delivery_date: form.expected_delivery_date || null,
        actual_received_date: form.actual_received_date || null,
        delivered_to_site_date: form.delivered_to_site_date || null,
        installed_date: form.installed_date || null,
        procurement_notes: form.procurement_notes, site_notes: form.site_notes,
        internal_staff_notes: form.internal_staff_notes, attachments: form.attachments
      });
      toast({ title: "Procurement item saved", description: "Changes have been saved successfully." });
      window.dispatchEvent(new Event("frontier:data-updated"));
    } catch (e) {
      toast({ title: "Failed to save", description: e.message || "Unknown error", variant: "destructive" });
    }
    setSaving(false);
    load();
  }

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file || uploading) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setField("attachments", [...(form.attachments || []), file_url]);
    setUploading(false);
  }

  function removeAttachment(url) {
    setField("attachments", (form.attachments || []).filter(a => a !== url));
  }

  if (loading) return <div className="flex items-center justify-center h-96"><div className="w-8 h-8 border-4 border-gray-200 border-t-gray-800 rounded-full animate-spin" /></div>;
  if (!item) return <div className="p-8 text-center text-gray-400">Procurement item not found</div>;

  const warnings = [];
  if (item.status === "Backordered") warnings.push("Item is backordered");
  if (item.status === "Delayed") warnings.push("Item is delayed");
  if (!item.sku) warnings.push("Missing SKU / supplier reference");
  if (!item.supplier) warnings.push("Missing supplier");
  if (!item.quantity) warnings.push("Missing quantity");
  if (item.expected_delivery_date && item.expected_delivery_date < today && !DONE_STATUSES.includes(item.status)) warnings.push("Expected delivery date has passed");
  if (catItem?.status && catItem.status !== "Active") warnings.push(`Catalogue item is ${catItem.status}`);
  if (item.status === "Not Ready to Order") warnings.push("Approved selection not yet ready to order");

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link to="/procurement" className="p-2 rounded-lg hover:bg-gray-100" title="Back to Procurement"><ArrowLeft size={18} /></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{item.item_name}</h1>
          <p className="text-sm text-gray-500">{project?.name || ""} {area ? `• ${area.name}` : ""}</p>
        </div>
        <div className="flex items-center gap-2">
          {project && <Link to={`/projects/${project.id}`} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50"><FolderKanban size={12} /> Project</Link>}
          {requirement && <Link to={`/projects/${item.project_id}/area/${item.area_id}/requirement/${requirement.id}`} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50"><ClipboardCheck size={12} /> Requirement</Link>}
          {catItem && <Link to={`/catalogue/${catItem.id}`} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50"><Package size={12} /> Catalogue Item</Link>}
          <button onClick={() => window.print()} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50"><Download size={12} /> Print</button>
        </div>
        <StatusBadge status={item.status} />
        <ContextualHelpLink category="Procurement" label="How to track ordered and received items" />
      </div>

      {warnings.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-1.5">
          {warnings.map((w, i) => <div key={i} className="flex items-start gap-2 text-sm text-red-700"><AlertTriangle size={14} className="mt-0.5 shrink-0" /> {w}</div>)}
        </div>
      )}

      {(() => {
        const procActions = [];
        if (item.status === "Ready to Order") procActions.push({ label: "Mark as Ordered", onClick: () => { setForm(f => ({ ...f, status: "Ordered", order_date: new Date().toISOString().slice(0, 10) })); }, priority: "urgent", buttonLabel: "Set Ordered", description: "Place the order with the supplier and record the PO number" });
        if (item.status === "Ordered") procActions.push({ label: "Mark as Received", onClick: () => { setForm(f => ({ ...f, status: "Received", actual_received_date: new Date().toISOString().slice(0, 10) })); }, priority: "high", buttonLabel: "Set Received" });
        if (item.status === "Received") procActions.push({ label: "Mark Delivered to Site", onClick: () => { setForm(f => ({ ...f, status: "Delivered to Site", delivered_to_site_date: new Date().toISOString().slice(0, 10) })); }, priority: "high", buttonLabel: "Set Delivered" });
        if (item.status === "Delivered to Site") procActions.push({ label: "Mark as Installed", onClick: () => { setForm(f => ({ ...f, status: "Installed", installed_date: new Date().toISOString().slice(0, 10) })); }, priority: "medium", buttonLabel: "Set Installed" });
        if (!item.supplier) procActions.push({ label: "Add supplier information", to: "#", priority: "high", buttonLabel: "Below", description: "Supplier is required before ordering" });
        return procActions.length > 0 ? <NextActionPanel actions={procActions} /> : null;
      })()}

      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2 text-sm">
        <div className="grid grid-cols-2 gap-3">
          <div><span className="text-gray-500">Project:</span> {project ? <Link to={`/projects/${project.id}`} className="ml-1 text-blue-600 hover:underline">{project.name}</Link> : <span className="ml-1">—</span>}</div>
          <div><span className="text-gray-500">Area/Room:</span> {area ? <Link to={`/projects/${item.project_id}/areas/${area.id}`} className="ml-1 text-blue-600 hover:underline">{area.name}</Link> : <span className="ml-1">—</span>}</div>
          <div><span className="text-gray-500">Requirement:</span> {requirement ? <Link to={`/projects/${item.project_id}/area/${item.area_id}/requirement/${requirement.id}`} className="ml-1 text-blue-600 hover:underline">{requirement.name}</Link> : <span className="ml-1">—</span>}</div>
          <div><span className="text-gray-500">Catalogue Item:</span> {catItem ? <Link to={`/catalogue/${catItem.id}`} className="ml-1 text-blue-600 hover:underline">{catItem.name}</Link> : <span className="ml-1">—</span>}</div>
          <div><span className="text-gray-500">Category:</span> <span className="ml-1">{item.category || catItem?.category || "—"}</span></div>
        </div>
        {selection?.selected_options?.length > 0 && (
          <div className="pt-2 border-t border-gray-50">
            <p className="text-xs font-medium text-gray-500 mb-1">Approved Selection Options</p>
            {selection.selected_options.map((o, i) => <p key={i} className="text-xs text-gray-600">{o.group_name}: {o.option_name}</p>)}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h2 className="font-semibold text-gray-900 text-sm">Procurement Details</h2>
        <div className="grid grid-cols-2 gap-4">
          <div><Label>Supplier</Label><Input value={form.supplier} onChange={e => setField("supplier", e.target.value)} /></div>
          <div><Label>Brand</Label><Input value={form.brand} onChange={e => setField("brand", e.target.value)} /></div>
          <div><Label>SKU / Supplier Reference</Label><Input value={form.sku} onChange={e => setField("sku", e.target.value)} /></div>
          <div><Label>Quantity</Label><Input type="number" value={form.quantity} onChange={e => setField("quantity", e.target.value)} /></div>
          <div><Label>Unit of Measure</Label><Input value={form.unit_of_measure} onChange={e => setField("unit_of_measure", e.target.value)} /></div>
          <div><Label>Order Status</Label>
            <Select value={form.status} onValueChange={v => setField("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{PROCUREMENT_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Purchase Order #</Label><Input value={form.purchase_order_number} onChange={e => setField("purchase_order_number", e.target.value)} /></div>
          <div><Label>Supplier Order #</Label><Input value={form.supplier_order_number} onChange={e => setField("supplier_order_number", e.target.value)} /></div>
          <div><Label>Order Date</Label><Input type="date" value={form.order_date} onChange={e => setField("order_date", e.target.value)} /></div>
          <div><Label>Expected Delivery</Label><Input type="date" value={form.expected_delivery_date} onChange={e => setField("expected_delivery_date", e.target.value)} /></div>
          <div><Label>Actual Received Date</Label><Input type="date" value={form.actual_received_date} onChange={e => setField("actual_received_date", e.target.value)} /></div>
          <div><Label>Delivered to Site</Label><Input type="date" value={form.delivered_to_site_date} onChange={e => setField("delivered_to_site_date", e.target.value)} /></div>
          <div><Label>Installed Date</Label><Input type="date" value={form.installed_date} onChange={e => setField("installed_date", e.target.value)} /></div>
        </div>
        <div><Label>Procurement Notes</Label><Textarea value={form.procurement_notes} onChange={e => setField("procurement_notes", e.target.value)} rows={2} /></div>
        <div><Label>Site Notes</Label><Textarea value={form.site_notes} onChange={e => setField("site_notes", e.target.value)} rows={2} /></div>
        <div><Label>Internal Staff Notes</Label><Textarea value={form.internal_staff_notes} onChange={e => setField("internal_staff_notes", e.target.value)} rows={2} /></div>

        <div>
          <Label>Attachments (quotes, invoices, confirmations)</Label>
          <div className="space-y-2 mt-2">
            {(form.attachments || []).map((url, i) => (
              <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-sm">
                <a href={url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline truncate">{url.split("/").pop() || `Attachment ${i + 1}`}</a>
                <button onClick={() => removeAttachment(url)} className="text-red-500 hover:text-red-700"><X size={14} /></button>
              </div>
            ))}
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <Upload size={14} /> {uploading ? "Uploading..." : "Upload file"}
              <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
            </label>
          </div>
        </div>

        <Button onClick={handleSave} disabled={saving} className="gap-2"><Save size={14} /> {saving ? "Saving..." : "Save Changes"}</Button>
      </div>

      <CommentThread projectId={item.project_id} targetType="procurement" targetId={item.id} staff={true} title="Procurement Comments" />
    </div>
  );
}