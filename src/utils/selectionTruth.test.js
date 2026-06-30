/**
 * Test harness for selection truth helper
 * Run in browser console or add to a test page to validate truth logic
 */

import { getSelectionTruthState, getCustomerSelectionDisplayState } from './selectionTruth';

const TEST_CASES = [
  {
    name: "Not Started, no selection, required",
    input: {
      requirement: { id: "r1", status: "Not Started", is_required: true },
      currentSelection: null,
      changeRequests: []
    },
    expected: {
      countsAsComplete: false,
      needsCustomerAction: true,
      customerStatusLabel: "Select Item"
    }
  },
  {
    name: "Not Started, no selection, optional",
    input: {
      requirement: { id: "r1", status: "Not Started", is_required: false },
      currentSelection: null,
      changeRequests: []
    },
    expected: {
      countsAsComplete: false,
      needsCustomerAction: false,
      customerStatusLabel: "Select Item"
    }
  },
  {
    name: "Pending current selection",
    input: {
      requirement: { id: "r1", status: "Submitted", is_required: true },
      currentSelection: { id: "s1", status: "Pending", is_current: true },
      changeRequests: []
    },
    expected: {
      countsAsComplete: false,
      isWaitingForFrontier: true,
      customerStatusLabel: "Waiting for Frontier Review"
    }
  },
  {
    name: "Approved current selection",
    input: {
      requirement: { id: "r1", status: "Approved", is_required: true },
      currentSelection: { id: "s1", status: "Approved", is_current: true },
      changeRequests: []
    },
    expected: {
      countsAsComplete: true,
      customerStatusLabel: "Approved",
      isApproved: true
    }
  },
  {
    name: "Changed After Approval + selection Approved",
    input: {
      requirement: { id: "r1", status: "Changed After Approval", is_required: true },
      currentSelection: { id: "s1", status: "Approved", is_current: true },
      changeRequests: []
    },
    expected: {
      countsAsComplete: true,
      customerStatusLabel: "Approved",
      staffStatusLabel: "Changed After Approval",
      warningMessage: "Requirement marked as changed, but current selection is approved and counts as complete."
    }
  },
  {
    name: "Signed off selection",
    input: {
      requirement: { id: "r1", status: "Approved", is_required: true },
      currentSelection: { id: "s1", status: "Approved", is_current: true, signed_off: true },
      changeRequests: []
    },
    expected: {
      countsAsComplete: true,
      customerStatusLabel: "Signed Off",
      isSignedOff: true
    }
  },
  {
    name: "Locked selection",
    input: {
      requirement: { id: "r1", status: "Locked", is_required: true },
      currentSelection: { id: "s1", status: "Approved", is_current: true, locked: true },
      changeRequests: []
    },
    expected: {
      countsAsComplete: true,
      customerStatusLabel: "Finalized",
      isLocked: true,
      isFinalized: true
    }
  },
  {
    name: "Revision Requested",
    input: {
      requirement: { id: "r1", status: "Revision Requested", is_required: true },
      currentSelection: { id: "s1", status: "Revision Requested", is_current: true },
      changeRequests: []
    },
    expected: {
      countsAsComplete: false,
      needsCustomerAction: true,
      customerStatusLabel: "Action Needed"
    }
  },
  {
    name: "Rejected",
    input: {
      requirement: { id: "r1", status: "Rejected", is_required: true },
      currentSelection: { id: "s1", status: "Rejected", is_current: true },
      changeRequests: []
    },
    expected: {
      countsAsComplete: false,
      needsCustomerAction: true,
      customerStatusLabel: "Action Needed"
    }
  },
  {
    name: "Ready to Order",
    input: {
      requirement: { id: "r1", status: "Ready to Order", is_required: true },
      currentSelection: { id: "s1", status: "Approved", is_current: true },
      changeRequests: [],
      procurementItem: { status: "Ready to Order" }
    },
    expected: {
      countsAsComplete: true,
      customerStatusLabel: "Ready to Order",
      isReadyToOrder: true
    }
  },
  {
    name: "Ordered",
    input: {
      requirement: { id: "r1", status: "Ordered", is_required: true },
      currentSelection: { id: "s1", status: "Approved", is_current: true },
      changeRequests: [],
      procurementItem: { status: "Ordered" }
    },
    expected: {
      countsAsComplete: true,
      customerStatusLabel: "Ordered",
      isOrdered: true
    }
  },
  {
    name: "Received",
    input: {
      requirement: { id: "r1", status: "Received", is_required: true },
      currentSelection: { id: "s1", status: "Approved", is_current: true },
      changeRequests: [],
      procurementItem: { status: "Received" }
    },
    expected: {
      countsAsComplete: true,
      customerStatusLabel: "Received",
      isReceived: true
    }
  },
  {
    name: "Installed",
    input: {
      requirement: { id: "r1", status: "Installed", is_required: true },
      currentSelection: { id: "s1", status: "Approved", is_current: true },
      changeRequests: [],
      procurementItem: { status: "Installed" }
    },
    expected: {
      countsAsComplete: true,
      customerStatusLabel: "Installed",
      isInstalled: true
    }
  }
];

export function runTruthHelperTests() {
  console.log("=== Selection Truth Helper Tests ===\n");
  let passed = 0;
  let failed = 0;

  TEST_CASES.forEach((testCase, idx) => {
    const result = getSelectionTruthState(testCase.input);
    const displayState = getCustomerSelectionDisplayState(testCase.input);
    
    let testPassed = true;
    const failures = [];

    Object.entries(testCase.expected).forEach(([key, expectedValue]) => {
      const actualValue = result[key];
      if (actualValue !== expectedValue) {
        testPassed = false;
        failures.push(`  ❌ ${key}: expected ${JSON.stringify(expectedValue)}, got ${JSON.stringify(actualValue)}`);
      }
    });

    if (testPassed) {
      console.log(`✅ Test ${idx + 1}: ${testCase.name}`);
      passed++;
    } else {
      console.log(`❌ Test ${idx + 1}: ${testCase.name}`);
      failures.forEach(f => console.log(f));
      failed++;
    }
  });

  console.log(`\n=== Summary ===`);
  console.log(`Passed: ${passed}/${TEST_CASES.length}`);
  console.log(`Failed: ${failed}/${TEST_CASES.length}`);

  if (failed === 0) {
    console.log("\n🎉 All tests passed!");
  } else {
    console.log("\n⚠️  Some tests failed. Review the output above.");
  }

  return { passed, failed, total: TEST_CASES.length };
}

// Helper to test step numbers
export function testStepNumbers() {
  console.log("\n=== Step Number Tests ===\n");
  
  const stepTests = [
    {
      name: "No selection + browse mode",
      input: { requirement: { status: "Not Started" }, currentSelection: null, currentStepMode: "browse" },
      expectedStep: 3
    },
    {
      name: "No selection + configure mode",
      input: { requirement: { status: "Not Started" }, currentSelection: null, currentStepMode: "configure" },
      expectedStep: 4
    },
    {
      name: "Pending selection",
      input: { requirement: { status: "Submitted" }, currentSelection: { status: "Pending" }, currentStepMode: "browse" },
      expectedStep: 7
    },
    {
      name: "Approved selection",
      input: { requirement: { status: "Approved" }, currentSelection: { status: "Approved" }, currentStepMode: "browse" },
      expectedStep: 7
    },
    {
      name: "Signed off selection",
      input: { requirement: { status: "Approved" }, currentSelection: { status: "Approved", signed_off: true }, currentStepMode: "browse" },
      expectedStep: 7
    },
    {
      name: "Locked selection",
      input: { requirement: { status: "Locked" }, currentSelection: { status: "Approved", locked: true }, currentStepMode: "browse" },
      expectedStep: 7
    },
    {
      name: "Revision Requested (has item)",
      input: { requirement: { status: "Revision Requested" }, currentSelection: { status: "Revision Requested", catalogue_item_id: "c1" }, currentStepMode: "configure" },
      expectedStep: 6
    },
    {
      name: "Revision Requested (no item)",
      input: { requirement: { status: "Revision Requested" }, currentSelection: { status: "Revision Requested" }, currentStepMode: "browse" },
      expectedStep: 4
    },
    {
      name: "Rejected",
      input: { requirement: { status: "Rejected" }, currentSelection: { status: "Rejected" }, currentStepMode: "browse" },
      expectedStep: 3
    }
  ];

  let passed = 0;
  let failed = 0;

  stepTests.forEach((test, idx) => {
    const result = getCustomerSelectionDisplayState(test.input);
    if (result.stepNumber === test.expectedStep) {
      console.log(`✅ Step Test ${idx + 1}: ${test.name} (step ${result.stepNumber})`);
      passed++;
    } else {
      console.log(`❌ Step Test ${idx + 1}: ${test.name}`);
      console.log(`  Expected step ${test.expectedStep}, got ${result.stepNumber}`);
      failed++;
    }
  });

  console.log(`\nStep Tests: ${passed}/${stepTests.length} passed`);
  return { passed, failed, total: stepTests.length };
}

// Run tests when imported in browser
if (typeof window !== 'undefined') {
  console.log("Selection Truth Helper Test Harness loaded.");
  console.log("Call runTruthHelperTests() and testStepNumbers() in console to run tests.");
}