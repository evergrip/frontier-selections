/**
 * Shared selection truth helper - single source of truth for selection status across all portals
 * Returns consistent status, completion, and action state for any requirement/selection pair
 */

const CUSTOMER_COMPLETE_STATUSES = [
  "Approved", "Locked", "Ready to Order", "Ordered", 
  "Received", "Delivered to Site", "Installed"
];

// Used in finalization logic - a selection is final when it reaches any of these states
const FINAL_STATUSES = ["Locked", "Ready to Order", "Ordered", "Received", "Delivered to Site", "Installed"];

export function getSelectionTruthState({ requirement, currentSelection, changeRequests = [], procurementItem = null }) {
  const reqStatus = requirement?.status || "Not Started";
  const selStatus = currentSelection?.status || null;
  const isSignedOff = currentSelection?.signed_off === true;
  const isLocked = currentSelection?.locked === true;
  
  // Determine if selection counts as complete
  let countsAsComplete = false;
  if (currentSelection) {
    if (selStatus === "Approved") countsAsComplete = true;
    if (isSignedOff) countsAsComplete = true;
    if (isLocked) countsAsComplete = true;
    if (CUSTOMER_COMPLETE_STATUSES.includes(selStatus)) countsAsComplete = true;
  }
  if (CUSTOMER_COMPLETE_STATUSES.includes(reqStatus)) countsAsComplete = true;
  
  // Check for open change requests
  const hasOpenChangeRequest = changeRequests.some(cr => 
    ["Requested", "Under Review", "More Information Needed", "Price Adjustment Required"].includes(cr.status)
  );
  
  // Determine customer status
  let customerStatusLabel = "Not Started";
  let needsCustomerAction = false;
  let canCustomerEdit = false;
  let canCustomerRequestChange = false;
  
  if (currentSelection) {
    if (selStatus === "Pending" || selStatus === "Submitted") {
      customerStatusLabel = "Waiting for Frontier Review";
    } else if (selStatus === "Approved") {
      customerStatusLabel = "Approved";
    } else if (selStatus === "Rejected" || selStatus === "Revision Requested") {
      customerStatusLabel = "Action Needed";
      needsCustomerAction = true;
      canCustomerEdit = true;
    } else if (selStatus === "Superseded") {
      customerStatusLabel = "Replaced";
    } else if (selStatus === "Change Requested") {
      customerStatusLabel = "Change Request Sent";
    } else if (selStatus === "Locked") {
      customerStatusLabel = "Finalized";
    } else if (["Ready to Order", "Ordered", "Received", "Delivered to Site", "Installed"].includes(selStatus)) {
      customerStatusLabel = selStatus;
    }
  } else {
    if (reqStatus === "Not Started" || reqStatus === "Viewed" || reqStatus === "In Progress") {
      customerStatusLabel = "Select Item";
      needsCustomerAction = requirement?.is_required !== false;
      canCustomerEdit = true;
    } else if (CUSTOMER_COMPLETE_STATUSES.includes(reqStatus)) {
      customerStatusLabel = reqStatus;
    }
  }
  
  // Override if signed off or locked
  if (isSignedOff && customerStatusLabel !== "Finalized") {
    customerStatusLabel = "Signed Off";
  }
  if (isLocked) {
    customerStatusLabel = "Finalized";
    canCustomerEdit = false;
    canCustomerRequestChange = requirement?.can_request_change_after_approval !== false;
  } else if (countsAsComplete && !isLocked) {
    canCustomerRequestChange = requirement?.can_request_change_after_approval !== false;
  }
  
  // Determine staff status
  let staffStatusLabel = reqStatus;
  let needsStaffAction = false;
  let canStaffApprove = false;
  let canStaffRequestSignOff = false;
  let canStaffLock = false;
  
  if (currentSelection) {
    if (selStatus === "Pending" || selStatus === "Submitted") {
      staffStatusLabel = "Awaiting Review";
      needsStaffAction = true;
      canStaffApprove = true;
    } else if (selStatus === "Approved" && reqStatus === "Changed After Approval") {
      if (hasOpenChangeRequest) {
        staffStatusLabel = "Changed After Approval";
        needsStaffAction = true;
      } else {
        staffStatusLabel = "Approved with Change History";
        needsStaffAction = false;
      }
      if (!isSignedOff && !isLocked) {
        canStaffRequestSignOff = true;
        canStaffLock = requirement?.lock_after_approval !== false;
      }
    } else if (selStatus === "Approved") {
      staffStatusLabel = "Approved";
      if (!isSignedOff && !isLocked) {
        canStaffRequestSignOff = true;
        canStaffLock = requirement?.lock_after_approval !== false;
      }
    } else if (selStatus === "Rejected" || selStatus === "Revision Requested") {
      staffStatusLabel = "Waiting on Customer";
    } else if (selStatus === "Locked") {
      staffStatusLabel = "Finalized";
    } else if (["Ready to Order", "Ordered", "Received", "Delivered to Site", "Installed"].includes(selStatus)) {
      staffStatusLabel = selStatus;
    }
  }
  
  // Check procurement status
  const isReadyToOrder = procurementItem?.status === "Ready to Order";
  const isOrdered = procurementItem?.status === "Ordered";
  const isReceived = procurementItem?.status === "Received" || procurementItem?.status === "Delivered to Site";
  const isInstalled = procurementItem?.status === "Installed";
  
  if (isInstalled) {
    staffStatusLabel = "Installed";
    customerStatusLabel = "Installed";
  } else if (isReceived) {
    staffStatusLabel = "Received";
    customerStatusLabel = "Received";
  } else if (isOrdered) {
    staffStatusLabel = "Ordered";
    customerStatusLabel = "Ordered";
  } else if (isReadyToOrder && countsAsComplete) {
    staffStatusLabel = "Ready to Order";
    customerStatusLabel = "Ready to Order";
  }
  
  // Determine if waiting for Frontier
  const isWaitingForFrontier = !needsCustomerAction && !countsAsComplete && currentSelection && 
    ["Pending", "Submitted", "Under Review"].includes(selStatus);
  
  // Determine finalization state
  const isFinalized = isLocked || isInstalled;
  
  // Next action labels
  let nextCustomerActionLabel = null;
  let nextStaffActionLabel = null;
  
  if (needsCustomerAction) {
    if (selStatus === "Revision Requested" || selStatus === "Rejected") {
      nextCustomerActionLabel = "Revise selection";
    } else if (!currentSelection && requirement?.is_required !== false) {
      nextCustomerActionLabel = "Choose selection";
    } else if (!currentSelection) {
      nextCustomerActionLabel = "Optional selection";
    }
  } else if (isWaitingForFrontier) {
    nextCustomerActionLabel = "Waiting for review";
  } else if (countsAsComplete && !isFinalized) {
    nextCustomerActionLabel = "Awaiting finalization";
  }
  
  if (needsStaffAction) {
    if (selStatus === "Pending" || selStatus === "Submitted") {
      nextStaffActionLabel = "Review selection";
    } else if (selStatus === "Approved" && reqStatus === "Changed After Approval") {
      nextStaffActionLabel = "Review change";
    }
  } else if (canStaffRequestSignOff && !needsCustomerAction) {
    nextStaffActionLabel = "Request sign-off";
  } else if (canStaffLock && !needsCustomerAction) {
    nextStaffActionLabel = "Lock selection";
  }
  
  // Warning if requirement and selection disagree
  let warningMessage = null;
  if (currentSelection && reqStatus === "Changed After Approval" && selStatus === "Approved") {
    warningMessage = "Requirement marked as changed, but current selection is approved and counts as complete.";
  } else if (currentSelection && countsAsComplete && !CUSTOMER_COMPLETE_STATUSES.includes(reqStatus) && reqStatus !== "Changed After Approval") {
    warningMessage = "Selection is complete but requirement status is not updated.";
  } else if (!currentSelection && CUSTOMER_COMPLETE_STATUSES.includes(reqStatus)) {
    warningMessage = "Requirement marked complete but no current selection exists.";
  }
  
  return {
    requirementId: requirement?.id,
    selectionId: currentSelection?.id || null,
    staffStatusLabel,
    customerStatusLabel,
    countsAsComplete,
    needsCustomerAction,
    needsStaffAction,
    isWaitingForFrontier,
    isApproved: selStatus === "Approved" || isSignedOff,
    isSignedOff,
    isLocked,
    isFinalized,
    isReadyToOrder,
    isOrdered,
    isReceived,
    isInstalled,
    hasOpenChangeRequest,
    canCustomerEdit,
    canCustomerRequestChange,
    canStaffApprove,
    canStaffRequestSignOff,
    canStaffLock,
    nextCustomerActionLabel,
    nextStaffActionLabel,
    warningMessage
  };
}

export function getCustomerSelectionDisplayState({ requirement, currentSelection, changeRequests = [], currentStepMode = "browse" }) {
  const truth = getSelectionTruthState({ requirement, currentSelection, changeRequests });
  
  // Customer-friendly status labels
  const displayStatus = truth.customerStatusLabel;
  
  // Calculate step number based on state
  let stepNumber = 3;
  if (!currentSelection && requirement?.status === "Not Started") {
    stepNumber = currentStepMode === "configure" ? 4 : 3;
  } else if (currentSelection) {
    const selStatus = currentSelection.status;
    if (selStatus === "Pending" || selStatus === "Submitted") {
      stepNumber = 7;
    } else if (selStatus === "Approved" || truth.isSignedOff || truth.isLocked || truth.isFinalized) {
      stepNumber = 7;
    } else if (selStatus === "Revision Requested" || selStatus === "Rejected") {
      stepNumber = currentSelection?.catalogue_item_id ? 6 : 4;
    } else if (selStatus === "Change Requested") {
      stepNumber = 7;
    } else {
      stepNumber = 5;
    }
  }
  
  // Stepper labels - must match badge
  let finalStepLabel = "Review Selections";
  if (truth.countsAsComplete) {
    if (truth.isInstalled) {
      finalStepLabel = "Installed";
    } else if (truth.isReceived) {
      finalStepLabel = "Received";
    } else if (truth.isOrdered) {
      finalStepLabel = "Ordered";
    } else if (truth.isReadyToOrder) {
      finalStepLabel = "Ready to Order";
    } else if (truth.isFinalized || truth.isLocked) {
      finalStepLabel = "Finalized";
    } else if (truth.isSignedOff) {
      finalStepLabel = "Signed Off";
    } else if (truth.isApproved) {
      finalStepLabel = "Approved";
    }
  } else if (truth.isWaitingForFrontier) {
    finalStepLabel = "Under Review";
  } else if (truth.needsCustomerAction) {
    finalStepLabel = "Action Needed";
  } else if (currentSelection) {
    finalStepLabel = "In Progress";
  }
  
  // showSignOffPrompt: true when sign_off_requested and not signed_off and selection is approved
  const showSignOffPrompt = currentSelection?.sign_off_requested === true && 
                              currentSelection?.signed_off !== true && 
                              (truth.isApproved || truth.countsAsComplete);
  
  // isReadOnly: true when signed off, locked, finalized, ordered, received, delivered, or installed
  const isReadOnly = truth.isSignedOff || truth.isLocked || truth.isFinalized || 
                     truth.isOrdered || truth.isReceived || truth.isInstalled ||
                     truth.isWaitingForFrontier;
  
  // canRequestChange: only when approved and not finalized
  const canRequestChange = truth.countsAsComplete && !truth.isFinalized && !truth.isWaitingForFrontier && 
                           requirement?.can_request_change_after_approval !== false;
  
  // canEdit: only when revision requested, rejected, or not started (no selection)
  const canEdit = (!currentSelection && requirement?.status === "Not Started") ||
                  truth.customerStatusLabel === "Action Needed";
  
  // Action message - always return a useful default
  let actionMessage = "Please choose a product to continue.";
  if (truth.needsCustomerAction) {
    if (truth.customerStatusLabel === "Action Needed") {
      actionMessage = "Frontier has requested changes to your selection. Please review the feedback and make updates.";
    } else {
      actionMessage = "This selection needs your attention.";
    }
  } else if (truth.isWaitingForFrontier) {
    actionMessage = "Your selection has been submitted and is being reviewed by Frontier. You'll be notified once approved.";
  } else if (truth.isSignedOff) {
    actionMessage = "You have signed off on this selection.";
  } else if (truth.isFinalized || truth.isLocked) {
    actionMessage = "This selection is finalized.";
  } else if (truth.isApproved && showSignOffPrompt) {
    actionMessage = "Please review and sign off on this approved selection.";
  } else if (truth.isApproved) {
    actionMessage = "Frontier has approved this selection.";
  } else if (currentSelection && !truth.countsAsComplete) {
    actionMessage = "Your selection is being prepared.";
  }
  
  return {
    ...truth,
    displayStatus,
    finalStepLabel,
    actionMessage,
    stepNumber,
    showSignOffPrompt,
    isReadOnly,
    canRequestChange,
    canEdit,
    customerStatusLabel: truth.customerStatusLabel
  };
}

export function getStaffSelectionDisplayState({ requirement, currentSelection, changeRequests = [], procurementItem = null }) {
  const truth = getSelectionTruthState({ requirement, currentSelection, changeRequests, procurementItem });
  
  return {
    ...truth,
    displayStatus: truth.staffStatusLabel
  };
}