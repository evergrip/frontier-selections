/**
 * Shared allowance display helper - ensures consistent allowance visibility across all customer-facing views
 * Respects project.pricing_visibility settings and provides customer-friendly wording
 */

export function getCustomerAllowanceDisplay({ project, selectionSummary, context = 'project' }) {
  const pricingVisibility = project?.pricing_visibility || 'hidden';
  const totalAllowance = selectionSummary?.totalAllowance || project?.total_allowance || 0;
  const selectedTotal = selectionSummary?.selectedTotal || 0;
  const approvedTotal = selectionSummary?.approvedTotal || 0;
  const pendingTotal = selectionSummary?.pendingTotal || 0;
  const remainingAllowance = selectionSummary?.remainingAllowance || (totalAllowance - selectedTotal);
  const totalOverAllowance = selectionSummary?.totalOverAllowance || 0;
  const totalUnderAllowance = selectionSummary?.totalUnderAllowance || 0;
  
  const isOver = remainingAllowance < 0;
  const overAmount = Math.abs(remainingAllowance);
  
  // Helper to format currency
  const formatCurrency = (amount) => {
    if (amount === null || amount === undefined) return '$0';
    return '$' + Math.abs(amount).toLocaleString();
  };
  
  // Determine what to show based on pricing_visibility
  let showSelectedTotal = false;
  let showApprovedTotal = false;
  let showPendingTotal = false;
  let showBasePrice = false;
  let showOptionModifiers = false;
  let showItemAllowance = false;
  let showAreaAllowance = false;
  let showRemaining = false;
  let showOverage = false;
  let showOnlyRemaining = false;
  let showOnlyOverage = false;
  
  switch (pricingVisibility) {
    case 'hidden':
      // Show nothing
      break;
      
    case 'show_item_prices':
      showBasePrice = true;
      showOptionModifiers = true;
      showSelectedTotal = true;
      showApprovedTotal = true;
      showPendingTotal = true;
      showRemaining = true;
      showOverage = true;
      break;
      
    case 'show_item_allowance':
      showSelectedTotal = true;
      showItemAllowance = true;
      showRemaining = true;
      showOverage = true;
      break;
      
    case 'show_remaining_only':
      showOnlyRemaining = true;
      break;
      
    case 'show_overage_only':
      showOnlyOverage = true;
      break;
      
    case 'show_area_allowance':
      showAreaAllowance = true;
      showRemaining = true;
      showOverage = true;
      break;
      
    case 'show_total_allowance':
      showSelectedTotal = true;
      showApprovedTotal = true;
      showPendingTotal = true;
      showRemaining = true;
      showOverage = true;
      break;
      
    default:
      break;
  }
  
  // Build display object
  const display = {
    showAllowance: pricingVisibility !== 'hidden',
    pricingVisibility,
    totalAllowance: formatCurrency(totalAllowance),
    selectedTotal: showSelectedTotal ? formatCurrency(selectedTotal) : null,
    approvedTotal: showApprovedTotal ? formatCurrency(approvedTotal) : null,
    pendingTotal: showPendingTotal ? formatCurrency(pendingTotal) : null,
    basePrice: showBasePrice ? true : false,
    optionModifiers: showOptionModifiers ? true : false,
    remainingLabel: null,
    remainingValue: null,
    overageLabel: null,
    overageValue: null,
    withinAllowance: null
  };
  
  // Handle remaining/overage display with correct wording
  if (showOnlyRemaining) {
    if (isOver) {
      display.remainingLabel = 'Over Allowance';
      display.remainingValue = '+' + formatCurrency(overAmount);
    } else {
      display.remainingLabel = 'Remaining Allowance';
      display.remainingValue = formatCurrency(remainingAllowance);
    }
  } else if (showOnlyOverage) {
    if (isOver) {
      display.overageLabel = 'Over Allowance';
      display.overageValue = '+' + formatCurrency(overAmount);
    } else {
      display.withinAllowance = '✓ Within Allowance';
    }
  } else if (showRemaining || showOverage) {
    if (isOver) {
      display.overageLabel = 'Over Allowance';
      display.overageValue = '+' + formatCurrency(overAmount);
    } else {
      display.remainingLabel = 'Remaining Allowance';
      display.remainingValue = formatCurrency(remainingAllowance);
    }
  }
  
  return display;
}

export function formatAllowanceValue({ amount, isOver, context = 'summary' }) {
  const formatCurrency = (amt) => '$' + Math.abs(amt).toLocaleString();
  
  if (context === 'summary') {
    if (isOver) {
      return { label: 'Over Allowance', value: '+' + formatCurrency(amount), variant: 'over' };
    } else if (amount === 0) {
      return { label: 'Within Allowance', value: '✓', variant: 'within' };
    } else {
      return { label: 'Remaining Allowance', value: formatCurrency(amount), variant: 'remaining' };
    }
  }
  
  return { label: 'Remaining', value: formatCurrency(amount), variant: isOver ? 'over' : 'remaining' };
}