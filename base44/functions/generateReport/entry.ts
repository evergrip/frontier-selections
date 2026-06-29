import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { jsPDF } from 'npm:jspdf@4.2.1';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user || (user.role !== "admin" && user.role !== "staff")) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    const p = await req.json();
    const report = await buildReport(base44, p);
    const format = p.format || "json";

    if (format === "json") return Response.json(report);

    if (format === "csv") {
      const csv = toCSV(report.columns, report.rows);
      return Response.json({ file: bufToB64(new TextEncoder().encode(csv)), filename: `${p.report_type}_${todayStr()}.csv`, mime: "text/csv" });
    }

    if (format === "pdf") {
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      if (report.packageItems && report.packageItems.length >= 0 && (p.report_type === "final_customer" || p.report_type === "final_internal")) {
        await drawPackage(doc, report, p.report_type === "final_internal", p.include_price, p.include_allowance);
      } else {
        drawTable(doc, report);
      }
      const ab = doc.output("arraybuffer");
      return Response.json({ file: bufToB64(ab), filename: `${p.report_type}_${todayStr()}.pdf`, mime: "application/pdf" });
    }

    return Response.json({ error: "Unknown format" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function todayStr() { return new Date().toISOString().slice(0, 10); }
function bufToB64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
function fmt(d) { return d ? new Date(d).toLocaleDateString() : ""; }
function money(n) { return n != null ? `$${Number(n).toLocaleString()}` : ""; }

async function buildReport(base44, p) {
  const projectId = p.project_id || null;
  const fetchProj = (e) => projectId ? base44.asServiceRole.entities[e].filter({ project_id: projectId }, null, 1000) : base44.asServiceRole.entities[e].list(null, 1000);
  const [projects, areas, reqs, sels, procs, crs, items] = await Promise.all([
    base44.asServiceRole.entities.Project.list(null, 200),
    base44.asServiceRole.entities.ProjectArea.list(null, 1000),
    fetchProj("SelectionRequirement"),
    fetchProj("CustomerSelection"),
    fetchProj("ProcurementItem"),
    fetchProj("ChangeRequest"),
    base44.asServiceRole.entities.CatalogueItem.list(null, 1000)
  ]);
  const projectMap = {}; projects.forEach(x => projectMap[x.id] = x);
  const areaMap = {}; areas.forEach(x => areaMap[x.id] = x);
  const itemMap = {}; items.forEach(x => itemMap[x.id] = x);

  const enriched = reqs.map(req => {
    const sel = sels.find(s => s.requirement_id === req.id && s.is_current);
    const item = sel ? itemMap[sel.catalogue_item_id] : null;
    const proc = procs.find(x => x.requirement_id === req.id || (sel && x.selection_id === sel.id));
    return {
      req, area: areaMap[req.area_id], project: projectMap[req.project_id], sel, item, proc,
      options: sel ? (sel.selected_options || []).map(o => o.option_name).join(", ") : ""
    };
  });

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const DONE = ["Approved", "Locked", "Ready to Order", "Ordered", "Received", "Installed"];

  function passFilter(e) {
    if (p.area_id && e.req.area_id !== p.area_id) return false;
    if (p.category && e.req.category !== p.category) return false;
    if (p.status && e.req.status !== p.status) return false;
    if (p.supplier && (e.item?.supplier || e.proc?.supplier) !== p.supplier) return false;
    if (p.date_from && (!e.req.due_date || new Date(e.req.due_date + "T00:00:00") < new Date(p.date_from + "T00:00:00"))) return false;
    if (p.date_to && (!e.req.due_date || new Date(e.req.due_date + "T00:00:00") > new Date(p.date_to + "T00:00:00"))) return false;
    if (p.over_allowance_only && !((e.sel?.over_allowance || 0) > 0)) return false;
    if (p.procurement_status && (e.proc?.status || "") !== p.procurement_status) return false;
    return true;
  }

  const list = enriched.filter(passFilter);
  const rt = p.report_type;
  let title = "", columns = [], rows = [], packageItems = null;

  if (rt === "summary") {
    title = "Project Selection Summary";
    columns = ["Project", "Area", "Selection", "Category", "Status", "Selected Item", "Approval Date", "Overage"];
    rows = list.map(e => [e.project?.name || "", e.area?.name || "", e.req.name, e.req.category || "", e.req.status, e.item?.name || "", fmt(e.sel?.reviewed_date), money(e.sel?.over_allowance)]);
  } else if (rt === "approved_by_room") {
    title = "Approved Selections by Room";
    columns = ["Project", "Area", "Selection", "Selected Item", "Options", "Approval Date", "Price"];
    rows = list.filter(e => e.sel?.status === "Approved").map(e => [e.project?.name || "", e.area?.name || "", e.req.name, e.item?.name || "", e.options, fmt(e.sel?.reviewed_date), money(e.sel?.calculated_price)]);
  } else if (rt === "pending") {
    title = "Pending Selections Report";
    columns = ["Project", "Area", "Selection", "Status", "Due Date", "Submitted Date"];
    rows = list.filter(e => !DONE.includes(e.req.status)).map(e => [e.project?.name || "", e.area?.name || "", e.req.name, e.req.status, e.req.due_date || "", fmt(e.sel?.submitted_date)]);
  } else if (rt === "overdue") {
    title = "Overdue Selections Report";
    columns = ["Project", "Area", "Selection", "Due Date", "Status", "Days Overdue"];
    rows = list.filter(e => e.req.due_date && !DONE.includes(e.req.status) && new Date(e.req.due_date + "T00:00:00") < today)
      .map(e => [e.project?.name || "", e.area?.name || "", e.req.name, e.req.due_date, e.req.status, String(Math.round((today - new Date(e.req.due_date + "T00:00:00")) / 86400000))]);
  } else if (rt === "over_allowance") {
    title = "Selections Over Allowance Report";
    columns = ["Project", "Area", "Selection", "Selected Item", "Allowance", "Price", "Overage"];
    const over = list.filter(e => (e.sel?.over_allowance || 0) > 0);
    rows = over.map(e => [e.project?.name || "", e.area?.name || "", e.req.name, e.item?.name || "", money(e.req.allowance_amount), money(e.sel?.calculated_price), money(e.sel?.over_allowance)]);
    const byProj = {};
    over.forEach(e => { byProj[e.project?.id] = (byProj[e.project?.id] || 0) + (e.sel?.over_allowance || 0); });
    Object.entries(byProj).forEach(([pid, total]) => rows.push([projectMap[pid]?.name || "", "", "", "", "", "Total Overage", money(total)]));
  } else if (rt === "change_requests") {
    title = "Change Request Report";
    columns = ["Project", "Area", "Original", "Requested", "Status", "Price Impact", "Requested Date"];
    let crsF = crs;
    if (projectId) crsF = crsF.filter(c => c.project_id === projectId);
    rows = crsF.map(c => [projectMap[c.project_id]?.name || "", areaMap[c.area_id]?.name || "", c.original_item_name || "", c.requested_item_name || "", c.status, money(c.price_impact), fmt(c.created_date)]);
  } else if (rt === "procurement") {
    title = "Procurement Report";
    columns = ["Project", "Area", "Selection", "Item", "Supplier", "SKU", "Qty", "Status", "Order Date", "Expected Delivery", "Received", "Installed"];
    rows = list.filter(e => e.sel?.status === "Approved").map(e => [e.project?.name || "", e.area?.name || "", e.req.name, e.item?.name || "", e.proc?.supplier || e.item?.supplier || "", e.proc?.sku || e.item?.sku || "", e.proc?.quantity || 1, e.proc?.status || "Not Ready to Order", fmt(e.proc?.order_date), fmt(e.proc?.expected_delivery_date), fmt(e.proc?.actual_received_date), fmt(e.proc?.installed_date)]);
  } else if (rt === "supplier_orders") {
    title = "Supplier Order List";
    columns = ["Supplier", "Project", "Area", "Item", "SKU", "Qty", "Options", "Notes", "Image"];
    rows = list.filter(e => e.sel?.status === "Approved").map(e => [e.proc?.supplier || e.item?.supplier || "", e.project?.name || "", e.area?.name || "", e.item?.name || "", e.proc?.sku || e.item?.sku || "", e.proc?.quantity || 1, e.options, e.proc?.procurement_notes || "", e.item?.default_image || ""]);
  } else if (rt === "final_customer" || rt === "final_internal") {
    const internal = rt === "final_internal";
    title = internal ? "Internal Final Selections Package" : "Customer Final Selections Package";
    packageItems = list.filter(e => e.sel?.status === "Approved").map(e => ({
      project: e.project?.name || "", client: e.project?.client_name || "", address: e.project?.address || "",
      area: e.area?.name || "", requirement: e.req.name, item: e.item?.name || "", options: e.options,
      image: e.item?.default_image || "", supplier: e.item?.supplier || "", brand: e.item?.brand || "", sku: e.item?.sku || "",
      qty: e.proc?.quantity || 1, price: e.sel?.calculated_price || 0, allowanceImpact: (e.sel?.over_allowance || 0) - (e.sel?.under_allowance || 0),
      customerApprovalDate: fmt(e.sel?.submitted_date), staffApprovalDate: fmt(e.sel?.reviewed_date),
      notes: e.sel?.customer_notes || e.req.customer_instructions || "",
      internalNotes: e.sel?.internal_notes || e.req.staff_notes || "",
      procurementStatus: e.proc?.status || "", installNotes: e.item?.installation_notes || "", siteNotes: e.proc?.site_notes || ""
    }));
    if (internal) {
      columns = ["Area", "Selection", "Item", "Options", "Supplier", "Brand", "SKU", "Qty", "Price", "Allowance Impact", "Approval Date", "Notes", "Internal Notes", "Procurement", "Install Notes", "Site Notes"];
      rows = packageItems.map(i => [i.area, i.requirement, i.item, i.options, i.supplier, i.brand, i.sku, i.qty, money(i.price), money(i.allowanceImpact), i.staffApprovalDate, i.notes, i.internalNotes, i.procurementStatus, i.installNotes, i.siteNotes]);
    } else {
      columns = ["Area", "Selection", "Item", "Options", "Supplier", "Brand", "SKU", "Qty", "Approval Date", "Notes"];
      if (p.include_price) columns.push("Price");
      if (p.include_allowance) columns.push("Allowance Impact");
      rows = packageItems.map(i => {
        const r = [i.area, i.requirement, i.item, i.options, i.supplier, i.brand, i.sku, i.qty, i.customerApprovalDate, i.notes];
        if (p.include_price) r.push(money(i.price));
        if (p.include_allowance) r.push(money(i.allowanceImpact));
        return r;
      });
    }
  }

  return { title, columns, rows, packageItems };
}

function toCSV(columns, rows) {
  const esc = (v) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [columns.map(esc).join(","), ...rows.map(r => r.map(esc).join(","))].join("\n");
}

function drawTable(doc, report) {
  const margin = 14;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const colW = (pageW - margin * 2) / report.columns.length;
  doc.setFontSize(14); doc.setFont("helvetica", "bold"); doc.text(report.title, margin, 20);
  doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.text("Generated " + new Date().toLocaleString(), margin, 26);
  let y = 34;
  doc.setFillColor(230, 230, 230); doc.rect(margin, y - 4, pageW - margin * 2, 6, "F");
  doc.setFontSize(6.5); doc.setFont("helvetica", "bold");
  report.columns.forEach((c, i) => doc.text(String(c), margin + i * colW + 1, y, { maxWidth: colW - 2 }));
  y += 7;
  doc.setFont("helvetica", "normal");
  for (const row of report.rows) {
    if (y > pageH - 16) { doc.addPage(); y = 20; }
    row.forEach((cell, i) => doc.text(String(cell ?? ""), margin + i * colW + 1, y, { maxWidth: colW - 2 }));
    y += 6;
  }
}

async function loadImage(url) {
  try {
    const res = await fetch(url);
    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let bin = ""; for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    const fmt = (url.match(/\.(png|jpg|jpeg)/i)?.[1] || "jpeg").toUpperCase();
    return { data: btoa(bin), format: fmt === "JPG" ? "JPEG" : fmt };
  } catch { return null; }
}

async function drawPackage(doc, report, internal, includePrice, includeAllowance) {
  const margin = 14;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const first = report.packageItems[0];
  doc.setFontSize(20); doc.setFont("helvetica", "bold"); doc.text(first?.project || "Project", margin, 24);
  doc.setFontSize(11); doc.setFont("helvetica", "normal");
  doc.text(`Client: ${first?.client || ""}`, margin, 32);
  doc.text(`Address: ${first?.address || ""}`, margin, 38);
  doc.text(internal ? "Internal Final Selections Package" : "Final Selections Package", margin, 44);
  let y = 54;
  let lastArea = "";
  for (const it of report.packageItems) {
    if (y > pageH - 50) { doc.addPage(); y = 20; }
    if (it.area !== lastArea) {
      doc.setFontSize(13); doc.setFont("helvetica", "bold"); doc.text(it.area || "—", margin, y); y += 7;
      lastArea = it.area;
    }
    doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.text(`${it.requirement}: ${it.item}`, margin, y); y += 5;
    doc.setFontSize(8); doc.setFont("helvetica", "normal");
    if (it.image) {
      const img = await loadImage(it.image);
      if (img) {
        try { doc.addImage(img.data, img.format, margin, y, 35, 26); } catch {}
      }
    }
    let tx = margin + (it.image ? 40 : 0);
    const lines = [
      `Options: ${it.options || "—"}`,
      `Supplier: ${it.supplier || "—"}  Brand: ${it.brand || "—"}  SKU: ${it.sku || "—"}`,
      `Qty: ${it.qty || 1}`,
      `Customer Approval: ${it.customerApprovalDate || "—"}  Staff Approval: ${it.staffApprovalDate || "—"}`,
    ];
    if (!internal && includePrice) lines.push(`Price: ${money(it.price)}`);
    if (!internal && includeAllowance) lines.push(`Allowance Impact: ${money(it.allowanceImpact)}`);
    if (internal) {
      lines.push(`Price: ${money(it.price)}  Allowance Impact: ${money(it.allowanceImpact)}`);
      lines.push(`Procurement: ${it.procurementStatus || "—"}`);
      lines.push(`Install Notes: ${it.installNotes || "—"}`);
      lines.push(`Site Notes: ${it.siteNotes || "—"}`);
      lines.push(`Internal Notes: ${it.internalNotes || "—"}`);
    }
    lines.forEach((l, i) => { doc.text(l, tx, y + i * 5, { maxWidth: pageW - tx - margin }); });
    if (it.notes) doc.text(`Notes: ${it.notes}`, margin, y + lines.length * 5 + 2, { maxWidth: pageW - margin * 2 });
    y += Math.max(30, lines.length * 5 + 8);
    doc.setDrawColor(220, 220, 220); doc.line(margin, y, pageW - margin, y); y += 6;
  }
}