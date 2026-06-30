import React from "react";
import { AlertTriangle } from "lucide-react";

export default function MissingDataBadges({ item }) {
  const warnings = [];
  if (!item.base_price && item.base_price !== 0) warnings.push("Unit Cost");
  if (!item.unit_of_measure) warnings.push("Unit");
  if (!item.line_item_type) warnings.push("Line Item Type");
  if (!item.tax_status) warnings.push("Tax Status");
  if (!item.parent_group) warnings.push("Parent Group");
  if (!item.subgroup) warnings.push("Subgroup");
  if (!item.cost_code) warnings.push("Cost Code");
  if (!item.default_quantity && item.default_quantity !== 0) warnings.push("Quantity");
  if (!item.customer_description && !item.customer_notes) warnings.push("Description");
  if (!item.default_image) warnings.push("Image");

  if (warnings.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {warnings.slice(0, 3).map(w => (
        <span key={w} className="inline-flex items-center gap-0.5 text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
          <AlertTriangle size={8} /> {w}
        </span>
      ))}
      {warnings.length > 3 && (
        <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">+{warnings.length - 3} more</span>
      )}
    </div>
  );
}