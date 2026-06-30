import React from "react";

/**
 * Reusable customer-facing allowance/financial summary component.
 */
export default function SelectionAllowanceSummary({
  item,
  selection,
  selectedOptions,
  requirement,
  area,
  project,
  mode = "configuring",
  pricingVisibility: explicitPricingVisibility
}) {
  const pricingVisibility = explicitPricingVisibility || project?.pricing_visibility || "hidden";
  if (pricingVisibility === "hidden") return null;

  const summary = buildSummary();
  if (!summary.showAnyPricing) return null;

  function buildSummary() {
    const showAnyPricing = pricingVisibility !== "hidden";
    if (!showAnyPricing) return { showAnyPricing: false };

    // Approved/readonly mode: use stored values
    if (selection) {
      const storedPrice = selection.calculated_price != null ? selection.calculated_price : 0;
      const storedOptions = selection.selected_options || [];
      const itemAllowance = selection.allowance_amount != null ? selection.allowance_amount : (requirement?.allowance_amount || 0);
      const overAllowance = selection.over_allowance != null ? selection.over_allowance : Math.max(0, storedPrice - itemAllowance);
      const underAllowance = selection.under_allowance != null ? selection.under_allowance : Math.max(0, itemAllowance - storedPrice);

      return {
        showAnyPricing: true,
        basePrice: item?.base_price || 0,
        selectedOptionRows: storedOptions.map(o => ({
          groupName: o.group_name,
          optionName: o.option_name,
          priceModifier: o.price_modifier || 0
        })),
        selectedTotal: storedPrice,
        itemAllowance,
        areaAllowance: area?.allowance || 0,
        projectAllowance: project?.total_allowance || 0,
        remainingAgainstItemAllowance: itemAllowance - storedPrice,
        overAllowance,
        underAllowance,
        isOverAllowance: overAllowance > 0,
        isWithinAllowance: overAllowance === 0
      };
    }

    // Configure mode: calculate from catalogue
    let total = item?.base_price || 0;
    const optionRows = [];
    (item?.option_groups || []).forEach(group => {
      const optId = selectedOptions?.[group.id];
      if (optId) {
        const opt = group.options?.find(o => o.id === optId);
        if (opt && opt.price_modifier) {
          total += opt.price_modifier;
          optionRows.push({
            groupName: group.name,
            optionName: opt.name,
            priceModifier: opt.price_modifier
          });
        }
      }
    });

    const itemAllowance = requirement?.allowance_amount || 0;
    const overAllowance = Math.max(0, total - itemAllowance);
    const underAllowance = Math.max(0, itemAllowance - total);

    return {
      showAnyPricing: true,
      basePrice: item?.base_price || 0,
      selectedOptionRows: optionRows,
      selectedTotal: total,
      itemAllowance,
      areaAllowance: area?.allowance || 0,
      projectAllowance: project?.total_allowance || 0,
      remainingAgainstItemAllowance: itemAllowance - total,
      overAllowance,
      underAllowance,
      isOverAllowance: overAllowance > 0,
      isWithinAllowance: overAllowance === 0
    };
  }

  // Pricing visibility modes
  const showItemPrices = pricingVisibility === "show_item_prices";
  const showItemAllowance = pricingVisibility === "show_item_allowance";
  const showTotalAllowance = pricingVisibility === "show_total_allowance";
  const showAreaAllowance = pricingVisibility === "show_area_allowance";
  const showRemainingOnly = pricingVisibility === "show_remaining_only";
  const showOverageOnly = pricingVisibility === "show_overage_only";

  return (
    <div className="bg-gray-50 rounded-xl p-4 space-y-3">
      {/* Base price and option modifiers - only for show_item_prices */}
      {showItemPrices && (
        <>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Base Price</span>
            <span className="font-medium">${summary.basePrice.toLocaleString()}</span>
          </div>
          {summary.selectedOptionRows.map((opt, idx) => (
            <div key={idx} className="flex justify-between text-sm">
              <span className="text-gray-500">{opt.groupName}: {opt.optionName}</span>
              <span className={opt.priceModifier > 0 ? "text-red-600" : "text-green-600"}>
                {opt.priceModifier > 0 ? "+" : ""}${opt.priceModifier.toLocaleString()}
              </span>
            </div>
          ))}
          <div className="flex justify-between text-sm font-bold border-t border-gray-200 pt-2">
            <span>Selected Total</span>
            <span>${summary.selectedTotal.toLocaleString()}</span>
          </div>
        </>
      )}

      {/* Item allowance context */}
      {(showItemAllowance || showItemPrices) && summary.itemAllowance > 0 && (
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Your Allowance</span>
          <span>${summary.itemAllowance.toLocaleString()}</span>
        </div>
      )}

      {/* Remaining or overage */}
      {showRemainingOnly && summary.itemAllowance > 0 && (
        <div className="flex justify-between text-sm font-bold">
          <span>{summary.isOverAllowance ? "Over Allowance" : "Remaining Allowance"}</span>
          <span className={summary.isOverAllowance ? "text-red-600" : "text-green-600"}>
            {summary.isOverAllowance ? '+' : ''}${summary.isOverAllowance ? summary.overAllowance.toLocaleString() : summary.underAllowance.toLocaleString()}
          </span>
        </div>
      )}

      {showOverageOnly && summary.itemAllowance > 0 && (
        <div className={`flex justify-between text-sm font-bold ${summary.isOverAllowance ? "text-red-600" : "text-green-600"}`}>
          <span>{summary.isOverAllowance ? "Over Allowance" : "Within Allowance"}</span>
          <span>
            {summary.isOverAllowance ? `+$${summary.overAllowance.toLocaleString()}` : "✓"}
          </span>
        </div>
      )}

      {/* Show remaining/overage for show_item_allowance and show_item_prices */}
      {(showItemAllowance || showItemPrices) && summary.itemAllowance > 0 && !showRemainingOnly && !showOverageOnly && (
        <div className={`flex justify-between text-sm font-bold border-t border-gray-200 pt-2 ${summary.isOverAllowance ? "text-red-600" : "text-green-600"}`}>
          <span>{summary.isOverAllowance ? "Over Allowance" : "Remaining Allowance"}</span>
          <span>
            {summary.isOverAllowance ? `+$${summary.overAllowance.toLocaleString()}` : `$${summary.underAllowance.toLocaleString()}`}
          </span>
        </div>
      )}

      {/* Area allowance context */}
      {showAreaAllowance && summary.areaAllowance > 0 && (
        <div className="flex justify-between text-sm text-gray-500">
          <span>Area Allowance</span>
          <span>${summary.areaAllowance.toLocaleString()}</span>
        </div>
      )}

      {/* Project allowance context */}
      {showTotalAllowance && summary.projectAllowance > 0 && (
        <div className="flex justify-between text-sm text-gray-500">
          <span>Project Allowance</span>
          <span>${summary.projectAllowance.toLocaleString()}</span>
        </div>
      )}
    </div>
  );
}