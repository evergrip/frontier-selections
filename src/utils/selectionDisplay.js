/**
 * Shared customer-facing selection display state helper.
 * Returns consistent status labels, stepper state, and action messages.
 */

export function getCustomerSelectionDisplayState({ requirement, selection, hasOpenChangeRequest, currentStepMode }) {
  const isLocked = selection?.locked === true || requirement?.status === "Locked";
  const isSignedOff = selection?.signed_off === true;
  const isSignOffRequested = selection?.sign_off_requested === true && !isSignedOff;
  const isApproved = selection?.status === "Approved" || requirement?.status === "Approved";
  const isPendingOrSubmitted = selection?.status === "Pending" || selection?.status === "Submitted";
  const isRevisionRequested = selection?.status === "Revision Requested" || requirement?.status === "Revision Requested";
  const isRejected = selection?.status === "Rejected";
  const reqStatus = requirement?.status || "";

  // A. Locked / finalized
  if (isLocked) {
    return {
      customerStatusLabel: "Finalized",
      stepNumber: 7,
      finalStepLabel: "Finalized",
      actionMessage: "This selection is finalized. Contact Frontier if you need help.",
      tone: "neutral",
      canEdit: false,
      canRequestChange: false,
      showSignOffPrompt: false,
      showChangeRequestMessage: false,
      isReadOnly: true
    };
  }

  // B. Signed off
  if (isSignedOff) {
    return {
      customerStatusLabel: "Signed Off",
      stepNumber: 7,
      finalStepLabel: "Signed Off",
      actionMessage: "You have signed off on this final choice.",
      tone: "success",
      canEdit: false,
      canRequestChange: false,
      showSignOffPrompt: false,
      showChangeRequestMessage: false,
      isReadOnly: true
    };
  }

  // C. Sign-off requested
  if (isSignOffRequested && isApproved) {
    return {
      customerStatusLabel: "Sign Off Requested",
      stepNumber: 7,
      finalStepLabel: "Sign Off Final Choice",
      actionMessage: "Please review and sign off on this approved selection to confirm your final choice.",
      tone: "action-required",
      canEdit: false,
      canRequestChange: false,
      showSignOffPrompt: true,
      showChangeRequestMessage: false,
      isReadOnly: false
    };
  }

  // D. Approved
  if (isApproved) {
    return {
      customerStatusLabel: "Approved",
      stepNumber: 7,
      finalStepLabel: "Approved",
      actionMessage: "Frontier has approved this selection.",
      tone: "success",
      canEdit: false,
      canRequestChange: true,
      showSignOffPrompt: false,
      showChangeRequestMessage: false,
      isReadOnly: true
    };
  }

  // H. Open change request
  if (hasOpenChangeRequest) {
    return {
      customerStatusLabel: "Change Request Sent",
      stepNumber: 7,
      finalStepLabel: "Change Request Sent",
      actionMessage: "Your change request has been sent to Frontier. We'll review it and let you know if anything else is needed.",
      tone: "waiting",
      canEdit: false,
      canRequestChange: false,
      showSignOffPrompt: false,
      showChangeRequestMessage: true,
      isReadOnly: true
    };
  }

  // E. Waiting for review
  if (isPendingOrSubmitted) {
    return {
      customerStatusLabel: "Waiting for Frontier Review",
      stepNumber: 7,
      finalStepLabel: "Waiting for Frontier Review",
      actionMessage: "Your selection has been sent to Frontier for review.",
      tone: "waiting",
      canEdit: false,
      canRequestChange: false,
      showSignOffPrompt: false,
      showChangeRequestMessage: false,
      isReadOnly: true
    };
  }

  // F. Revision requested
  if (isRevisionRequested) {
    return {
      customerStatusLabel: "Frontier Needs More Info",
      stepNumber: 6,
      finalStepLabel: "Frontier Needs More Info",
      actionMessage: "Please review Frontier's feedback and update your selection.",
      tone: "action-required",
      canEdit: true,
      canRequestChange: false,
      showSignOffPrompt: false,
      showChangeRequestMessage: false,
      isReadOnly: false
    };
  }

  // G. Rejected
  if (isRejected) {
    return {
      customerStatusLabel: "Please Choose Again",
      stepNumber: 3,
      finalStepLabel: "Please Choose Again",
      actionMessage: "Frontier could not approve this selection. Please choose again or contact your coordinator.",
      tone: "error",
      canEdit: true,
      canRequestChange: false,
      showSignOffPrompt: false,
      showChangeRequestMessage: false,
      isReadOnly: false
    };
  }

  // J. Ready/order states
  const orderStatuses = ["Ready to Order", "Ordered", "Received", "Delivered to Site", "Installed"];
  if (orderStatuses.includes(reqStatus)) {
    return {
      customerStatusLabel: reqStatus,
      stepNumber: 7,
      finalStepLabel: reqStatus,
      actionMessage: getOrderStatusMessage(reqStatus),
      tone: "success",
      canEdit: false,
      canRequestChange: false,
      showSignOffPrompt: false,
      showChangeRequestMessage: false,
      isReadOnly: true
    };
  }

  // K. No selection
  if (!selection) {
    const stepNum = currentStepMode === "browse" ? 3 : 4;
    return {
      customerStatusLabel: "Needs Your Choice",
      stepNumber: stepNum,
      finalStepLabel: "Waiting for Frontier Review",
      actionMessage: "Please select a product to continue.",
      tone: "neutral",
      canEdit: true,
      canRequestChange: false,
      showSignOffPrompt: false,
      showChangeRequestMessage: false,
      isReadOnly: false
    };
  }

  // Default: In progress
  return {
    customerStatusLabel: "In Progress",
    stepNumber: currentStepMode === "browse" ? 3 : 4,
    finalStepLabel: "Waiting for Frontier Review",
    actionMessage: "Please complete your selection and submit for review.",
    tone: "neutral",
    canEdit: true,
    canRequestChange: false,
    showSignOffPrompt: false,
    showChangeRequestMessage: false,
    isReadOnly: false
  };
}

function getOrderStatusMessage(status) {
  const messages = {
    "Ready to Order": "This selection is approved and ready for Frontier to order.",
    "Ordered": "Frontier has ordered this item.",
    "Received": "This item has been received.",
    "Delivered to Site": "This item has been delivered to the site.",
    "Installed": "This item has been installed."
  };
  return messages[status] || "";
}

/**
 * Build financial summary for customer-facing display.
 * Uses stored selection values for approved/locked selections.
 * Calculates from catalogue for configure mode.
 */
export function buildSelectionFinancialSummary({ item, selection, selectedOptions, requirement, area, project, suggestedOptions, mode }) {
  const pricingVisibility = project?.pricing_visibility || "hidden";
  const showAnyPricing = pricingVisibility !== "hidden";

  // For approved/locked/signed-off selections, use stored values
  if (mode === "approved" || mode === "readonly" || selection) {
    const storedPrice = selection?.calculated_price != null ? selection.calculated_price : 0;
    const storedOptions = selection?.selected_options || [];
    const itemAllowance = selection?.allowance_amount != null ? selection.allowance_amount : (requirement?.allowance_amount || 0);
    const overAllowance = selection?.over_allowance != null ? selection.over_allowance : Math.max(0, storedPrice - itemAllowance);
    const underAllowance = selection?.under_allowance != null ? selection.under_allowance : Math.max(0, itemAllowance - storedPrice);

    return {
      pricingVisibility,
      showAnyPricing,
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
      isWithinAllowance: overAllowance === 0,
      source: "stored"
    };
  }

  // For configure mode, calculate from current catalogue
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
    pricingVisibility,
    showAnyPricing,
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
    isWithinAllowance: overAllowance === 0,
    source: "calculated"
  };
}

/**
 * Get customer-friendly message based on display state.
 */
export function getCustomerStatusMessage(displayState) {
  const messages = {
    "Finalized": "This selection is finalized and cannot be changed without Frontier's help.",
    "Signed Off": "You have signed off on this selection.",
    "Sign Off Requested": "Please review and sign off on this approved selection to confirm your final choice.",
    "Approved": "Frontier has approved this selection.",
    "Waiting for Frontier Review": "Your selection has been sent to Frontier for review. We'll let you know if anything else is needed.",
    "Frontier Needs More Info": "Please review Frontier's feedback and update your selection.",
    "Please Choose Again": "Frontier could not approve this selection. Please choose again or contact your coordinator.",
    "Change Request Sent": "Your change request has been sent to Frontier. We'll review it and let you know if anything else is needed.",
    "Ready to Order": "This selection is approved and ready for Frontier to order.",
    "Ordered": "Frontier has ordered this item.",
    "Received": "This item has been received.",
    "Delivered to Site": "This item has been delivered to the site.",
    "Installed": "This item has been installed.",
    "Needs Your Choice": "Please select a product to continue."
  };
  return messages[displayState.customerStatusLabel] || displayState.actionMessage || "";
}