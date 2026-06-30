import React from "react";
import { Star, Package, AlertTriangle, Clock, X, Check } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export default function CompareItems({ open, onOpenChange, items, suggestedOptions, showPricing, onSelect, onClear }) {
  if (!items || items.length === 0) return null;

  const fields = [
    { key: "image", label: "" },
    { key: "name", label: "Name" },
    { key: "brand", label: "Brand" },
    { key: "description", label: "Description" },
    { key: "recommended", label: "Recommended" },
    { key: "staffNote", label: "Staff Note" },
    { key: "price", label: "Price", showIf: showPricing },
    { key: "leadTime", label: "Lead Time" },
    { key: "approval", label: "Approval" },
  ];

  function getRowData(item) {
    const suggested = (suggestedOptions || []).find(s => s.catalogue_item_id === item.id);
    return {
      image: item.default_image,
      name: item.name,
      brand: item.brand || "—",
      description: item.description || item.customer_description || "—",
      recommended: suggested?.is_recommended ? "Yes" : "No",
      staffNote: suggested?.customer_note || "—",
      price: showPricing ? `$${(item.base_price || 0).toLocaleString()}` : null,
      leadTime: item.lead_time || "—",
      approval: item.option_groups?.some(g => g.options?.some(o => o.requires_approval)) ? "Some options require approval" : "Standard",
    };
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Compare Items ({items.length})</DialogTitle>
        </DialogHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <tbody>
              {fields.filter(f => f.showIf !== false).map((field) => (
                <tr key={field.key} className="border-b border-gray-100">
                  {field.key !== "image" && (
                    <td className="py-2 pr-3 font-medium text-gray-500 text-xs whitespace-nowrap align-top">{field.label}</td>
                  )}
                  {items.map(item => {
                    const data = getRowData(item);
                    const val = data[field.key];
                    if (field.key === "image") {
                      return (
                        <td key={item.id} className="py-2 px-1 align-top">
                          <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden w-full max-w-[140px]">
                            {val ? <img src={val} alt={item.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Package size={24} className="text-gray-300" /></div>}
                          </div>
                        </td>
                      );
                    }
                    if (field.key === "recommended") {
                      return (
                        <td key={item.id} className="py-2 px-2 align-top">
                          {val === "Yes" ? <span className="inline-flex items-center gap-1 text-amber-600 text-xs font-medium"><Star size={12} /> Recommended</span> : <span className="text-gray-300 text-xs">—</span>}
                        </td>
                      );
                    }
                    if (field.key === "approval") {
                      return (
                        <td key={item.id} className="py-2 px-2 align-top">
                          {val !== "Standard" ? <span className="inline-flex items-center gap-1 text-amber-600 text-xs"><AlertTriangle size={12} /> {val}</span> : <span className="text-gray-400 text-xs">Standard</span>}
                        </td>
                      );
                    }
                    if (field.key === "leadTime") {
                      return (
                        <td key={item.id} className="py-2 px-2 align-top">
                          {val !== "—" ? <span className="inline-flex items-center gap-1 text-gray-600 text-xs"><Clock size={12} /> {val}</span> : <span className="text-gray-300 text-xs">—</span>}
                        </td>
                      );
                    }
                    if (field.key === "price") {
                      return <td key={item.id} className="py-2 px-2 align-top font-bold text-gray-900">{val}</td>;
                    }
                    return <td key={item.id} className="py-2 px-2 align-top text-gray-700">{val}</td>;
                  })}
                </tr>
              ))}
              <tr>
                {fields[0].key === "image" && <td></td>}
                {items.map(item => (
                  <td key={item.id} className="py-3 px-2">
                    <Button size="sm" className="w-full" onClick={() => { onSelect(item); onOpenChange(false); }}>Select This</Button>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <div className="flex justify-between pt-2">
          <Button variant="ghost" size="sm" onClick={onClear}><X size={14} /> Clear Comparison</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}