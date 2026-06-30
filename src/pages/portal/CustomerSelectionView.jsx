import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import CommentThread from "@/components/comments/CommentThread";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Check, Package, CheckCircle, AlertTriangle, RefreshCw, History, FileSignature, Lock, Search, X, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import StatusBadge from "@/components/ui/StatusBadge";
import { customerDisplayStatus } from "@/lib/constants";
import CustomerSubstitution from "@/components/selection/CustomerSubstitution";
import StepIndicator from "@/components/portal/StepIndicator";
import PortalBreadcrumb from "@/components/portal/PortalBreadcrumb";
import { useProjectAccess } from "@/hooks/useProjectAccess";
import { useCustomerPortal } from "@/components/CustomerPortalContext";

function assembleItem(item, groups, values, rules) {
  const itemGroups = (groups || [])
    .filter(g => g.catalogue_item_id === item.id)
    .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
    .map(g => ({
      id: g.id, name: g.name, is_required: g.is_required !== false,
      options: (values || [])
        .filter(v => v.option_group_id === g.id)
        .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
    }));
  const itemRules = (rules || [])
    .filter(r => r.catalogue_item_id === item.id)
    .map(r => ({
      ...r,
      condition_option_id: r.condition_option_value_id,
      target_option_id: r.target_option_value_id
    }));
  return { ...item, option_groups: itemGroups, option_rules: itemRules };
}

const PAST_READY_STATUSES = ["Ready to Order", "Ordered", "Backordered", "Received", "Delivered to Site", "Installed", "Locked"];

export default function CustomerSelectionView() {
  const { projectId, areaId, requirementId } = useParams();
  const navigate = useNavigate();
  const [requirement, setRequirement] = useState(null);
  const [project, setProject] = useState(null);
  const [area, setArea] = useState(null);
  const [catalogueItems, setCatalogueItems] = useState([]);
  const [existingSelection, setExistingSelection] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedOptions, setSelectedOptions] = useState({});
  const [customerNotes, setCustomerNotes] = useState("");
  const [step, setStep] = useState("browse");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [changeMode, setChangeMode] = useState(false);
  const [changeReason, setChangeReason] = useState("");
  const [allSelections, setAllSelections] = useState([]);
  const [changeRequests, setChangeRequests] = useState([]);
  const [showSignOff, setShowSignOff] = useState(false);
  const [signOffNote, setSignOffNote] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterBrand, setFilterBrand] = useState("");
  const [suggestedOptions, setSuggestedOptions] = useState([]);
  const [loadError, setLoadError] = useState(null);
  const { loading: accessLoading, hasAccess } = useProjectAccess(projectId);
  const { isPreviewMode } = useCustomerPortal();

  useEffect(() => {
    if (accessLoading || !hasAccess) return;
    async function load() {
      try {
        const res = await base44.functions.invoke("customerPortal", {
          action: "get_selection_detail",
          project_id: projectId, area_id: areaId, requirement_id: requirementId
        });
        const data = res.data;
        if (data?.error) throw new Error(data.error);
        if (!data.requirement) { setRequirement(null); setLoading(false); return; }
        setRequirement(data.requirement);
        setProject(data.project);
        setArea(data.area);
        setAllSelections(data.selections || []);
        setChangeRequests(data.changeRequests || []);
        const current = (data.selections || []).find(s => s.is_current);
        setExistingSelection(current || null);

        const suggestedSorted = (data.suggestedOptions || []).sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
        setSuggestedOptions(suggestedSorted);
        setCatalogueItems(data.catalogueItems || []);

        if (current && ["Revision Requested", "Rejected"].includes(current.status)) {
          const item = (data.catalogueItems || []).find(i => i.id === current.catalogue_item_id);
          if (item) {
            setSelectedItem(item);
            const opts = {};
            (current.selected_options || []).forEach(o => { opts[o.group_id] = o.option_id; });
            setSelectedOptions(opts);
            setCustomerNotes(current.customer_notes || "");
            setStep("configure");
          }
        }
      } catch (err) {
        setLoadError(err.message || "Failed to load selection data");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [requirementId, accessLoading, hasAccess]);

  function getAvailableOptions(item, groupId, selections = selectedOptions) {
    const group = item?.option_groups?.find(g => g.id === groupId);
    if (!group) return [];
    let available = group.options.filter(o => o.is_active !== false);
    const rules = item.option_rules || [];
    for (const rule of rules) {
      if (rule.target_group_id !== groupId || rule.action !== "hide" || !rule.target_option_id) continue;
      if (selections[rule.condition_group_id] === rule.condition_option_id) {
        available = available.filter(o => o.id !== rule.target_option_id);
      }
    }
    const showRules = rules.filter(r => r.target_group_id === groupId && r.action === "show" && r.target_option_id && selections[r.condition_group_id] === r.condition_option_id);
    if (showRules.length > 0) {
      const shownIds = new Set(showRules.map(r => r.target_option_id));
      available = available.filter(o => shownIds.has(o.id));
    }
    return available;
  }

  function selectOption(groupId, optionId) {
    setSelectedOptions(prev => {
      const next = { ...prev, [groupId]: optionId };
      if (!selectedItem) return next;
      for (const g of selectedItem.option_groups || []) {
        if (g.id === groupId) continue;
        const sel = next[g.id];
        if (sel) {
          const avail = getAvailableOptions(selectedItem, g.id, next);
          if (!avail.some(o => o.id === sel)) delete next[g.id];
        }
      }
      return next;
    });
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

  const activeWarnings = useMemo(() => {
    if (!selectedItem) return [];
    const warnings = [];
    for (const [gId, oId] of Object.entries(selectedOptions)) {
      const group = selectedItem.option_groups.find(g => g.id === gId);
      const opt = group?.options.find(o => o.id === oId);
      if (opt?.warnings?.length) warnings.push(...opt.warnings);
    }
    for (const rule of selectedItem.option_rules || []) {
      if (rule.action !== "add_warning") continue;
      if (selectedOptions[rule.condition_group_id] === rule.condition_option_id && rule.value) {
        warnings.push(rule.value);
      }
    }
    return [...new Set(warnings)];
  }, [selectedItem, selectedOptions]);

  const missingRequired = (selectedItem?.option_groups || []).filter(g => g.is_required && !selectedOptions[g.id]);
  const invalidSelections = Object.entries(selectedOptions).filter(([gId]) => {
    const avail = getAvailableOptions(selectedItem, gId, selectedOptions);
    return !avail.some(o => o.id === selectedOptions[gId]);
  });
  const canSubmit = selectedItem && missingRequired.length === 0 && invalidSelections.length === 0;

  const allowance = requirement?.allowance_amount || 0;
  const areaAllowance = area?.allowance || 0;
  const totalAllowance = project?.total_allowance || 0;
  const overAllowance = calculatedPrice > allowance ? calculatedPrice - allowance : 0;
  const underAllowance = calculatedPrice < allowance ? allowance - calculatedPrice : 0;
  const pv = project?.pricing_visibility || "hidden";
  const showItemPrices = pv === "show_item_prices";
  const showTotalAllowance = pv === "show_total_allowance";
  const showAreaAllowance = pv === "show_area_allowance";
  const showItemAllowance = pv === "show_item_allowance";
  const showRemainingOnly = pv === "show_remaining_only";
  const showOverageOnly = pv === "show_overage_only";
  const showPricing = pv !== "hidden";
  const remaining = allowance - calculatedPrice;

  const brands = useMemo(() => [...new Set(catalogueItems.map(i => i.brand).filter(Boolean))], [catalogueItems]);
  const filteredItems = useMemo(() => {
    return catalogueItems.filter(item => {
      if (filterBrand && item.brand !== filterBrand) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return item.name.toLowerCase().includes(q) ||
          (item.description || "").toLowerCase().includes(q) ||
          (item.brand || "").toLowerCase().includes(q) ||
          (item.supplier || "").toLowerCase().includes(q);
      }
      return true;
    });
  }, [catalogueItems, searchQuery, filterBrand]);

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const optionsArray = Object.entries(selectedOptions).map(([groupId, optionId]) => {
        const group = selectedItem.option_groups.find(g => g.id === groupId);
        const option = group?.options.find(o => o.id === optionId);
        return {
          group_id: groupId, group_name: group?.name || "",
          option_id: optionId, option_name: option?.name || "",
          price_modifier: option?.price_modifier || 0
        };
      });

      const res = await base44.functions.invoke("selectionWorkflow", {
        action: "submit_selection",
        project_id: projectId, area_id: areaId, requirement_id: requirementId,
        catalogue_item_id: selectedItem.id, selected_options: optionsArray,
        customer_notes: customerNotes,
        existing_selection_id: existingSelection && ["Pending", "Revision Requested", "Rejected"].includes(existingSelection.status) ? existingSelection.id : null
      });

      if (res.data?.error) throw new Error(res.data.error);
      navigate(`/portal/project/${projectId}/area/${areaId}`);
    } catch (err) {
      alert("Failed to submit selection: " + (err.message || "Unknown error"));
    } finally {
      setSubmitting(false);
    }
  }

  function startChangeRequest() {
    const item = catalogueItems.find(i => i.id === existingSelection.catalogue_item_id);
    const opts = {};
    (existingSelection.selected_options || []).forEach(o => { opts[o.group_id] = o.option_id; });
    setSelectedItem(item || null);
    setSelectedOptions(opts);
    setChangeReason("");
    setCustomerNotes("");
    setChangeMode(true);
    setStep("configure");
  }

  async function handleRequestChange() {
    if (!selectedItem || !changeReason.trim()) return;
    setSubmitting(true);
    try {
      const optionsArray = Object.entries(selectedOptions).map(([groupId, optionId]) => {
        const group = selectedItem.option_groups.find(g => g.id === groupId);
        const option = group?.options.find(o => o.id === optionId);
        return { group_id: groupId, group_name: group?.name || "", option_id: optionId, option_name: option?.name || "", price_modifier: option?.price_modifier || 0 };
      });

      const res = await base44.functions.invoke("selectionWorkflow", {
        action: "request_change",
        project_id: projectId, area_id: areaId, requirement_id: requirementId,
        selection_id: existingSelection.id, catalogue_item_id: selectedItem.id,
        selected_options: optionsArray, reason: changeReason, customer_note: customerNotes
      });

      if (res.data?.error) throw new Error(res.data.error);
      navigate(`/portal/project/${projectId}/area/${areaId}`);
    } catch (err) {
      alert("Failed to submit change request: " + (err.message || "Unknown error"));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || accessLoading) return <div className="flex items-center justify-center h-96"><div className="w-8 h-8 border-4 border-gray-200 border-t-gray-800 rounded-full animate-spin" /></div>;
  if (!hasAccess) return <div className="text-center py-20 text-gray-400">You don't have access to this project.</div>;
  if (loadError) return (
    <div className="text-center py-20">
      <AlertTriangle size={32} className="mx-auto text-red-400 mb-2" />
      <p className="text-red-600 text-sm font-medium">Failed to load selection</p>
      <p className="text-gray-400 text-xs mt-1">{loadError}</p>
    </div>
  );
  if (!requirement) return <div className="text-center py-20 text-gray-400">Selection not found</div>;

  const isApproved = existingSelection?.status === "Approved" || requirement.status === "Approved";
  const isLocked = existingSelection?.locked || requirement.status === "Locked";
  const canEdit = !isLocked && (!isApproved || requirement.can_request_change_after_approval);
  const canRequestChange = isApproved && !!existingSelection && (canEdit || isLocked);
  const hasOpenChangeRequest = changeRequests.some(c => !["Approved", "Rejected", "Cancelled"].includes(c.status));
  const displayStatus = customerDisplayStatus(requirement, existingSelection, hasOpenChangeRequest);

  async function handleSignOff() {
    setSubmitting(true);
    try {
      await base44.functions.invoke("selectionWorkflow", { action: "sign_off", selection_id: existingSelection.id, note: signOffNote });
      const res = await base44.functions.invoke("customerPortal", {
        action: "get_selection_detail", project_id: projectId, area_id: areaId, requirement_id: requirementId
      });
      setAllSelections(res.data?.selections || []);
      setExistingSelection((res.data?.selections || []).find(s => s.is_current) || null);
      setShowSignOff(false);
      setSignOffNote("");
    } catch (e) { alert("Sign-off failed: " + (e.message || "Unknown error")); }
    setSubmitting(false);
  }

  return (
    <div className="space-y-6">
      <PortalBreadcrumb items={[
        { label: project?.name || "Project", to: `/portal/project/${projectId}` },
        { label: area?.name || "Area", to: `/portal/project/${projectId}/area/${areaId}` },
        { label: requirement.name }
      ]} />
      <div className="flex items-center gap-3">
        <Link to={`/portal/project/${projectId}/area/${areaId}`} className="p-2 rounded-lg hover:bg-gray-100"><ArrowLeft size={18} /></Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">{requirement.name}</h1>
          <p className="text-sm text-gray-500">{requirement.category}{requirement.is_required ? " • Required" : " • Optional"}</p>
        </div>
        <StatusBadge status={displayStatus} />
      </div>

      <StepIndicator currentStep={isApproved ? 7 : step === "browse" ? 3 : 4} />

      {existingSelection?.sign_off_requested && !existingSelection?.signed_off && !isLocked && isApproved && (
        <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-violet-800 font-medium text-sm"><FileSignature size={16} /> Sign-off Requested</div>
          <p className="text-sm text-violet-700">Please review and sign off on this approved selection to confirm your final choice.</p>
          <Button className="gap-2" onClick={() => setShowSignOff(true)} disabled={isPreviewMode}><Check size={14} /> {isPreviewMode ? "Preview mode" : "Sign Off Now"}</Button>
        </div>
      )}
      {existingSelection?.signed_off && (
        <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 text-sm text-violet-800 flex items-center gap-2">
          <CheckCircle size={16} /> Signed off by {existingSelection.signed_off_by || "customer"}{existingSelection.signed_off_date ? ` on ${new Date(existingSelection.signed_off_date).toLocaleDateString()}` : ""}
        </div>
      )}
      {isLocked && (
        <div className="bg-gray-100 border border-gray-300 rounded-xl p-4 text-sm text-gray-700 flex items-start gap-2">
          <Lock size={16} className="mt-0.5 shrink-0" /> This choice is finalized and cannot be changed without staff help. If you need to make a change, please contact your project coordinator.
        </div>
      )}

      {requirement.customer_instructions && (
        <div className="bg-blue-50 rounded-xl p-4 text-sm text-blue-800">{requirement.customer_instructions}</div>
      )}

      {existingSelection?.staff_comments && (
        <div className="bg-amber-50 rounded-xl p-4 text-sm text-amber-800">
          <span className="font-medium">Staff feedback:</span> {existingSelection.staff_comments}
        </div>
      )}

      {PAST_READY_STATUSES.includes(requirement.status) && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 flex items-start gap-2">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" /> This selection has already reached "{requirement.status}". Any changes require a formal change request and may affect procurement.
        </div>
      )}

      {isApproved && existingSelection && !changeMode && (
        <>
          <ApprovedSelectionView selection={existingSelection} items={catalogueItems} showItemPrices={showItemPrices} showItemAllowance={showItemAllowance} allowance={allowance} />
          {canRequestChange && !isPreviewMode && (
            <Button variant="outline" onClick={startChangeRequest} className="gap-2 w-fit"><RefreshCw size={14} /> Request a Change</Button>
          )}
          {canRequestChange && isPreviewMode && (
            <Button variant="outline" disabled className="gap-2 w-fit"><RefreshCw size={14} /> Request a Change (Preview)</Button>
          )}
          <RevisionHistory selections={allSelections} />
        </>
      )}

      {existingSelection && (
        <CustomerSubstitution projectId={projectId} selectionId={existingSelection.id} showPricing={showPricing} readOnly={isPreviewMode} />
      )}

      {existingSelection && (
        <CommentThread projectId={projectId} targetType="selection" targetId={existingSelection.id} staff={false} title="Comments" readOnly={isPreviewMode} />
      )}

      {step === "browse" && (changeMode || (canEdit && !isApproved)) && (
        <div>
          <h2 className="font-semibold text-gray-900 mb-4">Choose a Product</h2>
          {catalogueItems.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
              <Package size={32} className="mx-auto text-gray-300 mb-2" />
              <p className="text-gray-500 text-sm">
                {(requirement.customer_catalogue_access_mode || "suggested_only") === "staff_only"
                  ? "Your project coordinator will select this item for you. Please contact them if you have questions."
                  : "Frontier has not added options for this selection yet. Please check back or contact your project coordinator."}
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-col sm:flex-row gap-2 mb-4">
                <div className="relative flex-1">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search products..."
                    className="w-full h-10 pl-9 pr-9 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      <X size={16} />
                    </button>
                  )}
                </div>
                {brands.length > 1 && (
                  <select
                    value={filterBrand}
                    onChange={e => setFilterBrand(e.target.value)}
                    className="h-10 px-3 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  >
                    <option value="">All Brands</option>
                    {brands.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                )}
              </div>

              {filteredItems.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-xl border text-gray-400 text-sm">No products match your search</div>
              ) : (
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                  {filteredItems.map(item => {
                    const suggested = suggestedOptions.find(s => s.catalogue_item_id === item.id);
                    const isRecommended = suggested?.is_recommended;
                    const customerNote = suggested?.customer_note;
                    const priceOverride = suggested?.price_override;
                    const displayPrice = priceOverride != null ? priceOverride : (item.base_price || 0);
                    return (
                      <button
                        key={item.id}
                        onClick={() => { setSelectedItem(item); setSelectedOptions({}); setStep("configure"); }}
                        className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-lg hover:border-gray-300 transition-all text-left"
                      >
                        <div className="aspect-square bg-gray-100 relative">
                          {item.default_image ? (
                            <img src={item.default_image} alt={item.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center"><Package size={32} className="text-gray-300" /></div>
                          )}
                          {isRecommended && (
                            <span className="absolute top-2 right-2 inline-flex items-center gap-1 text-[10px] bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-medium shadow-sm">
                              <Star size={10} /> Recommended
                            </span>
                          )}
                        </div>
                        <div className="p-3">
                          <h3 className="font-semibold text-gray-900 text-sm line-clamp-1">{item.name}</h3>
                          {item.brand && <p className="text-xs text-gray-400 line-clamp-1">{item.brand}</p>}
                          {item.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{item.description}</p>}
                          {customerNote && <p className="text-xs text-blue-600 mt-1 line-clamp-2">📝 {customerNote}</p>}
                          <div className="flex items-center justify-between mt-2">
                            {showItemPrices && <p className="font-bold text-gray-900 text-sm">${displayPrice.toLocaleString()}</p>}
                            {item.option_groups?.length > 0 && (
                              <span className="text-[10px] text-blue-600 font-medium">{item.option_groups.length} option{item.option_groups.length > 1 ? "s" : ""}</span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {step === "configure" && selectedItem && (changeMode || (canEdit && !isApproved)) && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex gap-4 mb-4">
              {selectedItem.default_image && (
                <img src={selectedItem.default_image} alt={selectedItem.name} className="w-24 h-24 object-cover rounded-xl" />
              )}
              <div>
                <h2 className="font-bold text-gray-900">{selectedItem.name}</h2>
                <p className="text-sm text-gray-500">{selectedItem.category}</p>
                {showItemPrices && <p className="text-lg font-bold mt-1">From ${(selectedItem.base_price || 0).toLocaleString()}</p>}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => { setStep("browse"); setSelectedItem(null); setSelectedOptions({}); }}>
                Choose Different Item
              </Button>
              {changeMode && (
                <Button variant="ghost" size="sm" onClick={() => { setChangeMode(false); setSelectedItem(null); setSelectedOptions({}); setStep("browse"); }}>
                  Cancel Change Request
                </Button>
              )}
            </div>
          </div>

          {(selectedItem.option_groups || []).map(group => {
            const availableOpts = getAvailableOptions(selectedItem, group.id);
            return (
              <div key={group.id} className="space-y-3">
                <h3 className="font-semibold text-gray-900 text-sm">
                  {group.name} {group.is_required && <span className="text-red-500">*</span>}
                </h3>
                {availableOpts.length === 0 ? (
                  <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl p-4 text-sm text-gray-400">
                    No options available for this combination.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {availableOpts.map(opt => {
                      const isSelected = selectedOptions[group.id] === opt.id;
                      return (
                        <button
                          key={opt.id}
                          onClick={() => selectOption(group.id, opt.id)}
                          className={`rounded-xl border-2 p-3 text-left transition-all ${
                            isSelected ? "border-gray-900 bg-gray-50 ring-1 ring-gray-900" : "border-gray-200 hover:border-gray-400"
                          }`}
                        >
                          {opt.image && <img src={opt.image} alt={opt.name} className="w-full aspect-square object-cover rounded-lg mb-2" />}
                          <p className="font-medium text-sm text-gray-900">{opt.name}</p>
                          {showItemPrices && opt.price_modifier !== 0 && (
                            <p className={`text-xs mt-0.5 ${opt.price_modifier > 0 ? "text-red-600" : "text-green-600"}`}>
                              {opt.price_modifier > 0 ? "+" : ""}${opt.price_modifier.toLocaleString()}
                            </p>
                          )}
                          {opt.customer_note && <p className="text-[10px] text-gray-400 mt-1">{opt.customer_note}</p>}
                          {opt.requires_approval && (
                            <p className="text-[10px] text-amber-600 mt-1">Requires staff approval</p>
                          )}
                          {isSelected && (
                            <div className="flex justify-end mt-1"><Check size={16} className="text-gray-900" /></div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {activeWarnings.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-1">
              {activeWarnings.map((w, i) => (
                <p key={i} className="text-sm text-amber-800 flex items-start gap-2"><AlertTriangle size={14} className="mt-0.5 shrink-0" /> {w}</p>
              ))}
            </div>
          )}

          {missingRequired.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
              Please select: {missingRequired.map(g => g.name).join(", ")}
            </div>
          )}

          <div>
            <h3 className="font-semibold text-gray-900 text-sm mb-2">Notes for Staff</h3>
            <Textarea value={customerNotes} onChange={e => setCustomerNotes(e.target.value)} placeholder="Any preferences, questions, or notes..." rows={3} />
          </div>

          {showPricing && (
            <div className="bg-gray-50 rounded-xl p-4 space-y-2">
              {showItemPrices && (
                <>
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
                </>
              )}
              {showTotalAllowance && totalAllowance > 0 && (
                <div className="flex justify-between text-sm"><span className="text-gray-500">Project Allowance</span><span>${totalAllowance.toLocaleString()}</span></div>
              )}
              {showAreaAllowance && areaAllowance > 0 && (
                <div className="flex justify-between text-sm"><span className="text-gray-500">Area Allowance</span><span>${areaAllowance.toLocaleString()}</span></div>
              )}
              {showItemAllowance && allowance > 0 && (
                <div className="flex justify-between text-sm"><span className="text-gray-500">Item Allowance</span><span>${allowance.toLocaleString()}</span></div>
              )}
              {showRemainingOnly && allowance > 0 && (
                <div className="flex justify-between text-sm font-bold">
                  <span>Remaining Balance</span>
                  <span className={remaining >= 0 ? "text-green-600" : "text-red-600"}>${Math.abs(remaining).toLocaleString()}{remaining < 0 ? " over" : " left"}</span>
                </div>
              )}
              {showOverageOnly && (overAllowance > 0 || underAllowance > 0) && (
                <div className={`flex justify-between text-sm font-bold ${overAllowance > 0 ? "text-red-600" : "text-green-600"}`}>
                  <span>{overAllowance > 0 ? "Overage" : "Credit"}</span>
                  <span>{overAllowance > 0 ? `+$${overAllowance.toLocaleString()}` : `-$${underAllowance.toLocaleString()}`}</span>
                </div>
              )}
            </div>
          )}

          {changeMode && (
            <div>
              <h3 className="font-semibold text-gray-900 text-sm mb-2">Reason for Change <span className="text-red-500">*</span></h3>
              <Textarea value={changeReason} onChange={e => setChangeReason(e.target.value)} placeholder="Why are you requesting this change?" rows={2} />
            </div>
          )}

          <Button onClick={changeMode ? handleRequestChange : handleSubmit} disabled={(changeMode ? (!changeReason.trim() || !canSubmit) : !canSubmit) || submitting || isPreviewMode} className="w-full h-12 text-base" size="lg">
            {isPreviewMode ? "Preview mode - changes disabled" : submitting ? "Submitting..." : changeMode ? (canSubmit ? "Submit Change Request" : "Complete all required options") : canSubmit ? "Submit Selection" : "Complete all required options to submit"}
          </Button>
        </div>
      )}

      <Dialog open={showSignOff} onOpenChange={setShowSignOff}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Sign Off on Selection</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-gray-500">Confirm this approved selection as your final choice.</p>
            <div><Label>Sign-off Note (optional)</Label><Textarea value={signOffNote} onChange={e => setSignOffNote(e.target.value)} rows={3} placeholder="Any final comments..." /></div>
            <Button className="w-full" disabled={submitting || isPreviewMode} onClick={handleSignOff}>{isPreviewMode ? "Preview mode - changes disabled" : submitting ? "Signing off..." : "Confirm Sign-off"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ApprovedSelectionView({ selection, items, showItemPrices, showItemAllowance, allowance }) {
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
            {showItemPrices && <p className="text-sm font-bold mt-2">${(selection.calculated_price || 0).toLocaleString()}</p>}
            {showItemAllowance && allowance > 0 && <p className="text-xs text-gray-500 mt-1">Allowance: ${allowance.toLocaleString()}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

function RevisionHistory({ selections }) {
  if (!selections || selections.length <= 1) return null;
  const sorted = [...selections].sort((a, b) => (b.version || 0) - (a.version || 0));
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center gap-2 mb-3"><History size={16} className="text-gray-500" /><h3 className="font-semibold text-gray-900 text-sm">Revision History</h3></div>
      <div className="space-y-2">
        {sorted.map(s => (
          <div key={s.id} className="flex items-center justify-between text-sm border-b border-gray-50 pb-2 last:border-0">
            <div>
              <p className="font-medium text-gray-900">Version {s.version || 1}</p>
              <p className="text-xs text-gray-400">{s.submitted_date ? new Date(s.submitted_date).toLocaleString() : ""}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-gray-600">${(s.calculated_price || 0).toLocaleString()}</span>
              <StatusBadge status={s.status} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}