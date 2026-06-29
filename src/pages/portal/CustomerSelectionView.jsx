import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Check, Package, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import StatusBadge from "@/components/ui/StatusBadge";

export default function CustomerSelectionView() {
  const { projectId, areaId, requirementId } = useParams();
  const navigate = useNavigate();
  const [requirement, setRequirement] = useState(null);
  const [project, setProject] = useState(null);
  const [catalogueItems, setCatalogueItems] = useState([]);
  const [existingSelection, setExistingSelection] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedOptions, setSelectedOptions] = useState({});
  const [customerNotes, setCustomerNotes] = useState("");
  const [step, setStep] = useState("browse");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function load() {
      const [req, proj, sels] = await Promise.all([
        base44.entities.SelectionRequirement.get(requirementId),
        base44.entities.Project.get(projectId),
        base44.entities.CustomerSelection.filter({ requirement_id: requirementId })
      ]);
      setRequirement(req);
      setProject(proj);
      const current = sels.find(s => s.is_current);
      setExistingSelection(current || null);

      const items = await base44.entities.CatalogueItem.filter(
        req.category ? { category: req.category, is_active: true } : { is_active: true },
        "name", 100
      );
      setCatalogueItems(items);

      if (current && ["Revision Requested", "Rejected"].includes(current.status)) {
        const item = items.find(i => i.id === current.catalogue_item_id);
        if (item) {
          setSelectedItem(item);
          const opts = {};
          (current.selected_options || []).forEach(o => { opts[o.group_id] = o.option_id; });
          setSelectedOptions(opts);
          setCustomerNotes(current.customer_notes || "");
          setStep("configure");
        }
      }
      setLoading(false);
    }
    load();
  }, [requirementId]);

  function getAvailableOptions(item, groupId) {
    if (!item?.option_groups || !item?.option_rules) return null;
    const group = item.option_groups.find(g => g.id === groupId);
    if (!group) return [];

    let available = group.options.filter(o => o.is_active !== false);
    const rules = item.option_rules || [];

    for (const rule of rules) {
      if (rule.target_group_id !== groupId) continue;
      const conditionMet = selectedOptions[rule.condition_group_id] === rule.condition_option_id;
      if (!conditionMet) continue;

      if (rule.action === "hide" && rule.target_option_id) {
        available = available.filter(o => o.id !== rule.target_option_id);
      } else if (rule.action === "show" && rule.target_option_id) {
        // show-only rule: keep only shown options that match
      }
    }
    return available;
  }

  const calculatedPrice = useMemo(() => {
    if (!selectedItem) return 0;
    let total = selectedItem.base_price || 0;
    (selectedItem.option_groups || []).forEach(group => {
      const selOptId = selectedOptions[group.id];
      if (selOptId) {
        const opt = group.options.find(o => o.id === selOptId);
        if (opt) total += opt.price_modifier || 0;
      }
    });
    return total;
  }, [selectedItem, selectedOptions]);

  const allowance = requirement?.allowance_amount || 0;
  const overAllowance = calculatedPrice > allowance ? calculatedPrice - allowance : 0;
  const underAllowance = calculatedPrice < allowance ? allowance - calculatedPrice : 0;
  const showPricing = project?.pricing_visibility !== "hidden";

  async function handleSubmit() {
    setSubmitting(true);
    const optionsArray = Object.entries(selectedOptions).map(([groupId, optionId]) => {
      const group = selectedItem.option_groups.find(g => g.id === groupId);
      const option = group?.options.find(o => o.id === optionId);
      return {
        group_id: groupId, group_name: group?.name || "",
        option_id: optionId, option_name: option?.name || "",
        price_modifier: option?.price_modifier || 0
      };
    });

    if (existingSelection && ["Pending", "Revision Requested", "Rejected"].includes(existingSelection.status)) {
      await base44.entities.CustomerSelection.update(existingSelection.id, {
        catalogue_item_id: selectedItem.id, selected_options: optionsArray,
        calculated_price: calculatedPrice, allowance_amount: allowance,
        over_allowance: overAllowance, under_allowance: underAllowance,
        customer_notes: customerNotes, status: "Pending",
        submitted_date: new Date().toISOString()
      });
    } else {
      if (existingSelection) {
        await base44.entities.CustomerSelection.update(existingSelection.id, { is_current: false, status: "Superseded" });
      }
      await base44.entities.CustomerSelection.create({
        project_id: projectId, area_id: areaId, requirement_id: requirementId,
        catalogue_item_id: selectedItem.id, selected_options: optionsArray,
        calculated_price: calculatedPrice, allowance_amount: allowance,
        over_allowance: overAllowance, under_allowance: underAllowance,
        customer_notes: customerNotes, status: "Pending", is_current: true,
        submitted_date: new Date().toISOString(),
        version: (existingSelection?.version || 0) + 1
      });
    }

    await base44.entities.SelectionRequirement.update(requirementId, { status: "Submitted" });
    setSubmitting(false);
    navigate(`/portal/project/${projectId}/area/${areaId}`);
  }

  if (loading) return <div className="flex items-center justify-center h-96"><div className="w-8 h-8 border-4 border-gray-200 border-t-gray-800 rounded-full animate-spin" /></div>;
  if (!requirement) return <div className="text-center py-20 text-gray-400">Selection not found</div>;

  const isApproved = existingSelection?.status === "Approved" || requirement.status === "Approved";
  const isLocked = requirement.status === "Locked";
  const canEdit = !isLocked && (!isApproved || requirement.can_request_change_after_approval);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to={`/portal/project/${projectId}/area/${areaId}`} className="p-2 rounded-lg hover:bg-gray-100"><ArrowLeft size={18} /></Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">{requirement.name}</h1>
          <p className="text-sm text-gray-500">{requirement.category}{requirement.is_required ? " • Required" : ""}</p>
        </div>
        <StatusBadge status={requirement.status} />
      </div>

      {requirement.customer_instructions && (
        <div className="bg-blue-50 rounded-xl p-4 text-sm text-blue-800">{requirement.customer_instructions}</div>
      )}

      {existingSelection?.staff_comments && (
        <div className="bg-amber-50 rounded-xl p-4 text-sm text-amber-800">
          <span className="font-medium">Staff feedback:</span> {existingSelection.staff_comments}
        </div>
      )}

      {isApproved && existingSelection && (
        <ApprovedSelectionView selection={existingSelection} items={catalogueItems} showPricing={showPricing} />
      )}

      {step === "browse" && canEdit && !isApproved && (
        <div>
          <h2 className="font-semibold text-gray-900 mb-4">Choose an Option</h2>
          {catalogueItems.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl border text-gray-400 text-sm">No catalogue items available for this category</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {catalogueItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => { setSelectedItem(item); setSelectedOptions({}); setStep("configure"); }}
                  className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow text-left"
                >
                  <div className="aspect-video bg-gray-100 relative">
                    {item.default_image ? (
                      <img src={item.default_image} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><Package size={32} className="text-gray-300" /></div>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-900">{item.name}</h3>
                    {item.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{item.description}</p>}
                    <div className="flex items-center justify-between mt-3">
                      {showPricing && <p className="font-bold text-gray-900">${(item.base_price || 0).toLocaleString()}</p>}
                      {item.option_groups?.length > 0 && (
                        <span className="text-xs text-blue-600">{item.option_groups.length} customization{item.option_groups.length > 1 ? "s" : ""}</span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {step === "configure" && selectedItem && canEdit && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex gap-4 mb-4">
              {selectedItem.default_image && (
                <img src={selectedItem.default_image} alt={selectedItem.name} className="w-20 h-20 object-cover rounded-lg" />
              )}
              <div>
                <h2 className="font-bold text-gray-900">{selectedItem.name}</h2>
                <p className="text-sm text-gray-500">{selectedItem.category}</p>
                {showPricing && <p className="text-lg font-bold mt-1">From ${(selectedItem.base_price || 0).toLocaleString()}</p>}
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => { setStep("browse"); setSelectedItem(null); setSelectedOptions({}); }}>
              Choose Different Item
            </Button>
          </div>

          {(selectedItem.option_groups || []).map(group => {
            const availableOpts = getAvailableOptions(selectedItem, group.id);
            return (
              <div key={group.id} className="space-y-3">
                <h3 className="font-semibold text-gray-900 text-sm">
                  {group.name} {group.is_required && <span className="text-red-500">*</span>}
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {(availableOpts || []).map(opt => {
                    const isSelected = selectedOptions[group.id] === opt.id;
                    return (
                      <button
                        key={opt.id}
                        onClick={() => setSelectedOptions(prev => ({ ...prev, [group.id]: opt.id }))}
                        className={`rounded-xl border-2 p-3 text-left transition-all ${
                          isSelected ? "border-gray-900 bg-gray-50 ring-1 ring-gray-900" : "border-gray-200 hover:border-gray-400"
                        }`}
                      >
                        {opt.image && <img src={opt.image} alt={opt.name} className="w-full aspect-square object-cover rounded-lg mb-2" />}
                        <p className="font-medium text-sm text-gray-900">{opt.name}</p>
                        {showPricing && opt.price_modifier !== 0 && (
                          <p className={`text-xs mt-0.5 ${opt.price_modifier > 0 ? "text-red-600" : "text-green-600"}`}>
                            {opt.price_modifier > 0 ? "+" : ""}${opt.price_modifier.toLocaleString()}
                          </p>
                        )}
                        {opt.customer_note && <p className="text-[10px] text-gray-400 mt-1">{opt.customer_note}</p>}
                        {isSelected && (
                          <div className="flex justify-end mt-1"><Check size={16} className="text-gray-900" /></div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <div>
            <h3 className="font-semibold text-gray-900 text-sm mb-2">Notes for Staff</h3>
            <Textarea value={customerNotes} onChange={e => setCustomerNotes(e.target.value)} placeholder="Any preferences, questions, or notes..." rows={3} />
          </div>

          {showPricing && (
            <div className="bg-gray-50 rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Base Price</span>
                <span className="font-medium">${(selectedItem.base_price || 0).toLocaleString()}</span>
              </div>
              {Object.entries(selectedOptions).map(([gId, oId]) => {
                const group = selectedItem.option_groups.find(g => g.id === gId);
                const opt = group?.options.find(o => o.id === oId);
                if (!opt || !opt.price_modifier) return null;
                return (
                  <div key={gId} className="flex justify-between text-sm">
                    <span className="text-gray-500">{group.name}: {opt.name}</span>
                    <span className={opt.price_modifier > 0 ? "text-red-600" : "text-green-600"}>
                      {opt.price_modifier > 0 ? "+" : ""}${opt.price_modifier.toLocaleString()}
                    </span>
                  </div>
                );
              })}
              <div className="flex justify-between text-sm font-bold border-t border-gray-200 pt-2">
                <span>Total</span>
                <span>${calculatedPrice.toLocaleString()}</span>
              </div>
              {allowance > 0 && (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Allowance</span>
                    <span>${allowance.toLocaleString()}</span>
                  </div>
                  {overAllowance > 0 && (
                    <div className="flex justify-between text-sm text-red-600 font-medium">
                      <span>Over Allowance</span>
                      <span>+${overAllowance.toLocaleString()}</span>
                    </div>
                  )}
                  {underAllowance > 0 && (
                    <div className="flex justify-between text-sm text-green-600 font-medium">
                      <span>Under Allowance</span>
                      <span>-${underAllowance.toLocaleString()}</span>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <Button onClick={handleSubmit} disabled={submitting} className="w-full h-12 text-base" size="lg">
            {submitting ? "Submitting..." : "Submit Selection"}
          </Button>
        </div>
      )}
    </div>
  );
}

function ApprovedSelectionView({ selection, items, showPricing }) {
  const item = items.find(i => i.id === selection.catalogue_item_id);
  return (
    <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-5">
      <div className="flex items-center gap-2 mb-3">
        <CheckCircle size={18} className="text-emerald-600" />
        <h3 className="font-semibold text-emerald-800">Approved Selection</h3>
      </div>
      {item && (
        <div className="flex gap-4">
          {item.default_image && <img src={item.default_image} alt={item.name} className="w-16 h-16 object-cover rounded-lg" />}
          <div>
            <p className="font-medium text-gray-900">{item.name}</p>
            <div className="space-y-0.5 mt-1">
              {(selection.selected_options || []).map((o, i) => (
                <p key={i} className="text-xs text-gray-500"><span className="text-gray-400">{o.group_name}:</span> {o.option_name}</p>
              ))}
            </div>
            {showPricing && <p className="text-sm font-bold mt-2">${(selection.calculated_price || 0).toLocaleString()}</p>}
          </div>
        </div>
      )}
    </div>
  );
}