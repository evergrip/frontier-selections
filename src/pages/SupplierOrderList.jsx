import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SupplierOrderList() {
  const [items, setItems] = useState([]);
  const [projects, setProjects] = useState({});
  const [areas, setAreas] = useState({});
  const [catItems, setCatItems] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const ps = await base44.entities.ProcurementItem.list("-created_date", 500);
      const ordered = ps.filter(p => p.supplier);
      setItems(ordered);
      const pIds = [...new Set(ordered.map(p => p.project_id))];
      const aIds = [...new Set(ordered.map(p => p.area_id).filter(Boolean))];
      const cIds = [...new Set(ordered.map(p => p.catalogue_item_id).filter(Boolean))];
      const [pMap, aMap, cMap] = [{}, {}, {}];
      await Promise.all([
        ...pIds.map(async id => { try { pMap[id] = await base44.entities.Project.get(id); } catch {} }),
        ...aIds.map(async id => { try { aMap[id] = await base44.entities.ProjectArea.get(id); } catch {} }),
        ...cIds.map(async id => { try { cMap[id] = await base44.entities.CatalogueItem.get(id); } catch {} })
      ]);
      setProjects(pMap); setAreas(aMap); setCatItems(cMap);
      setLoading(false);
    })();
  }, []);

  const bySupplier = useMemo(() => {
    const groups = {};
    items.forEach(p => {
      const s = p.supplier || "Unknown Supplier";
      (groups[s] = groups[s] || []).push(p);
    });
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
  }, [items]);

  if (loading) return <div className="flex items-center justify-center h-96"><div className="w-8 h-8 border-4 border-gray-200 border-t-gray-800 rounded-full animate-spin" /></div>;

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Supplier Order List</h1>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => window.print()}><Printer size={14} /> Print</Button>
      </div>

      {bySupplier.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200 text-gray-400 text-sm">No approved selections with suppliers yet</div>
      ) : bySupplier.map(([supplier, group]) => (
        <div key={supplier} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">{supplier}</h2>
            <span className="text-sm text-gray-500">{group.length} item{group.length !== 1 ? "s" : ""}</span>
          </div>
          <div className="divide-y divide-gray-50">
            {group.map(p => {
              const cat = p.catalogue_item_id ? catItems[p.catalogue_item_id] : null;
              return (
                <div key={p.id} className="p-4 flex gap-4">
                  {(cat?.default_image || (cat?.gallery_images || [])[0]) && (
                    <img src={cat.default_image || cat.gallery_images[0]} alt={p.item_name} className="w-16 h-16 object-cover rounded-lg border shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <Link to={`/procurement/${p.id}`} className="font-medium text-gray-900 hover:underline">{p.item_name}</Link>
                        <p className="text-xs text-gray-500">{projects[p.project_id]?.name} {areas[p.area_id] ? `• ${areas[p.area_id].name}` : ""}</p>
                      </div>
                      <div className="text-right text-sm shrink-0">
                        <p className="font-medium">{p.quantity || 0} {p.unit_of_measure || ""}</p>
                        <p className="text-xs text-gray-500">Exp: {p.expected_delivery_date || "—"}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 mt-2 text-xs text-gray-600">
                      <div><span className="text-gray-400">SKU:</span> {p.sku || "—"}</div>
                      <div><span className="text-gray-400">Brand:</span> {p.brand || cat?.brand || "—"}</div>
                      <div><span className="text-gray-400">PO #:</span> {p.purchase_order_number || "—"}</div>
                      <div><span className="text-gray-400">Status:</span> {p.status}</div>
                    </div>
                    {p.procurement_notes && <p className="text-xs text-gray-500 mt-1">Notes: {p.procurement_notes}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}