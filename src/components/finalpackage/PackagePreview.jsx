import React from "react";

export default function PackagePreview({ project, items, internal, showPrice, showAllowance }) {
  if (!items || items.length === 0) {
    return <div className="text-center py-16 bg-white rounded-2xl border border-gray-200 text-gray-400">No approved selections yet</div>;
  }
  const byArea = {};
  items.forEach(it => { (byArea[it.area || "Unassigned"] = byArea[it.area || "Unassigned"] || []).push(it); });

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h1 className="text-2xl font-bold text-gray-900">{project?.name}</h1>
        <p className="text-sm text-gray-500 mt-1">Client: {project?.client_name || "—"}</p>
        {project?.address && <p className="text-sm text-gray-500">{project.address}</p>}
        <p className="text-xs text-gray-400 mt-2">{internal ? "Internal Construction Package" : "Final Selections Package"}</p>
      </div>
      {Object.entries(byArea).map(([area, areaItems]) => (
        <div key={area} className="bg-white rounded-2xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 text-lg mb-4 pb-2 border-b border-gray-100">{area}</h2>
          <div className="space-y-4">
            {areaItems.map((it, i) => <PackageCard key={i} it={it} internal={internal} showPrice={showPrice} showAllowance={showAllowance} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

function PackageCard({ it, internal, showPrice, showAllowance }) {
  return (
    <div className="flex gap-4 bg-gray-50 rounded-xl p-4">
      {it.image && <img src={it.image} alt="" className="w-28 h-28 object-cover rounded-lg border border-gray-200 shrink-0" />}
      <div className="flex-1 space-y-1.5">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">{it.requirement}</h3>
          <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Approved</span>
        </div>
        <p className="text-sm text-gray-800">{it.item}</p>
        {it.options && <p className="text-xs text-gray-500">Customizations: {it.options}</p>}
        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-gray-500">
          <p>Supplier: {it.supplier || "—"}</p>
          <p>Brand: {it.brand || "—"}</p>
          <p>SKU: {it.sku || "—"}</p>
          <p>Quantity: {it.qty || 1}</p>
          <p>Customer Approval: {it.customerApprovalDate || "—"}</p>
          {internal && <p>Staff Approval: {it.staffApprovalDate || "—"}</p>}
          {internal && <p>Procurement: {it.procurementStatus || "—"}</p>}
        </div>
        {internal && it.installNotes && <p className="text-xs text-gray-500">Install Notes: {it.installNotes}</p>}
        {it.notes && <p className="text-xs text-gray-600">Notes: {it.notes}</p>}
        {internal && it.siteNotes && <p className="text-xs text-gray-500">Site Notes: {it.siteNotes}</p>}
        {internal && it.internalNotes && <p className="text-xs text-yellow-700 bg-yellow-50 rounded px-2 py-1">Internal: {it.internalNotes}</p>}
        {showPrice && <p className="text-sm font-medium text-gray-900">Price: ${Number(it.price || 0).toLocaleString()}</p>}
        {showAllowance && <p className="text-xs text-gray-500">Allowance Impact: ${Number(it.allowanceImpact || 0).toLocaleString()}</p>}
      </div>
    </div>
  );
}