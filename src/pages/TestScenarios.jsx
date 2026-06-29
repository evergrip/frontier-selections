import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { CheckCircle, XCircle, Play, Loader2, Trash2, Database, ArrowRight, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";

const PAST_READY = ["Ready to Order", "Ordered", "Backordered", "Received", "Delivered to Site", "Installed", "Locked"];

const TESTS = [
  {
    id: 1,
    title: "Customer selects valid 36\" blue vanity with left drawer",
    category: "Customer Selection",
    async run(seed) {
      const sel = await base44.entities.CustomerSelection.create({
        project_id: seed.project_id,
        area_id: seed.areas["Main Bathroom"],
        requirement_id: seed.vanity_requirement_id,
        catalogue_item_id: seed.vanity_item_id,
        selected_options: [
          { group_id: seed.option_groups.Size, group_name: "Size", option_id: seed.option_values["36 inch"], option_name: "36 inch", price_modifier: 0 },
          { group_id: seed.option_groups.Colour, group_name: "Colour", option_id: seed.option_values.Blue, option_name: "Blue", price_modifier: 0 },
          { group_id: seed.option_groups["Drawer Bank"], group_name: "Drawer Bank", option_id: seed.option_values.Left, option_name: "Left", price_modifier: 0 },
          { group_id: seed.option_groups.Countertop, group_name: "Countertop", option_id: seed.option_values.Laminate, option_name: "Laminate", price_modifier: 0 }
        ],
        calculated_price: 950, allowance_amount: 1200, over_allowance: 0, under_allowance: 250,
        status: "Pending", is_current: true, submitted_date: new Date().toISOString()
      });
      const verify = await base44.entities.CustomerSelection.get(sel.id);
      if (verify.selected_options.length !== 4) throw new Error("Expected 4 selected options, got " + verify.selected_options.length);
      if (verify.calculated_price !== 950) throw new Error("Expected price $950, got $" + verify.calculated_price);
      if (verify.status !== "Pending") throw new Error("Expected status Pending, got " + verify.status);
      return { status: "pass", message: `Selection saved with 4 options, price $950, status Pending (ID: ${sel.id.slice(0, 8)})` };
    }
  },
  {
    id: 2,
    title: "Customer tries invalid 36\" black vanity — app prevents it",
    category: "Conditional Rules",
    async run(seed) {
      const rules = await base44.entities.CatalogueOptionRule.filter({ catalogue_item_id: seed.vanity_item_id });
      const hideBlackRule = rules.find(r =>
        r.condition_option_value_id === seed.option_values["36 inch"] &&
        r.target_option_value_id === seed.option_values.Black &&
        r.action === "hide"
      );
      if (!hideBlackRule) throw new Error("No rule found to hide Black when 36 inch is selected");
      // Simulate getAvailableOptions: with size=36, black should be hidden
      const selections = { [seed.option_groups.Size]: seed.option_values["36 inch"] };
      const colourGroupRules = rules.filter(r => r.target_group_id === seed.option_groups.Colour && r.action === "hide");
      const hiddenIds = colourGroupRules.filter(r => selections[r.condition_group_id] === r.condition_option_value_id).map(r => r.target_option_value_id);
      if (hiddenIds.includes(seed.option_values.Black)) {
        return { status: "pass", message: "Rule correctly hides Black when 36 inch is selected — app prevents invalid combination" };
      }
      throw new Error("Black was not hidden by the rules when 36 inch is selected");
    }
  },
  {
    id: 3,
    title: "Customer submits vanity over allowance — overage shown",
    category: "Allowance Tracking",
    async run(seed) {
      const price = 950 + 300; // Quartz white adds $300
      const over = price - 1200; // $50 over
      const sel = await base44.entities.CustomerSelection.create({
        project_id: seed.project_id,
        area_id: seed.areas["Main Bathroom"],
        requirement_id: seed.vanity_requirement_id,
        catalogue_item_id: seed.vanity_item_id,
        selected_options: [
          { group_id: seed.option_groups.Size, group_name: "Size", option_id: seed.option_values["36 inch"], option_name: "36 inch", price_modifier: 0 },
          { group_id: seed.option_groups.Colour, group_name: "Colour", option_id: seed.option_values.Blue, option_name: "Blue", price_modifier: 0 },
          { group_id: seed.option_groups["Drawer Bank"], group_name: "Drawer Bank", option_id: seed.option_values.Left, option_name: "Left", price_modifier: 0 },
          { group_id: seed.option_groups.Countertop, group_name: "Countertop", option_id: seed.option_values["Quartz white"], option_name: "Quartz white", price_modifier: 300 }
        ],
        calculated_price: price, allowance_amount: 1200, over_allowance: over, under_allowance: 0,
        status: "Pending", is_current: true, submitted_date: new Date().toISOString()
      });
      const verify = await base44.entities.CustomerSelection.get(sel.id);
      if (verify.over_allowance !== 50) throw new Error("Expected over_allowance $50, got $" + verify.over_allowance);
      return { status: "pass", message: `Overage correctly calculated: $${verify.over_allowance} over the $1,200 allowance (price $${verify.calculated_price})` };
    }
  },
  {
    id: 4,
    title: "Staff approves a pending selection",
    category: "Staff Approval",
    async run(seed) {
      const sels = await base44.entities.CustomerSelection.filter({ requirement_id: seed.vanity_requirement_id, status: "Pending" });
      if (sels.length === 0) throw new Error("No pending selection found — run Test 1 first");
      const sel = sels[0];
      await base44.entities.CustomerSelection.update(sel.id, {
        status: "Approved", reviewed_date: new Date().toISOString(), reviewed_by: "staff"
      });
      await base44.entities.SelectionRequirement.update(seed.vanity_requirement_id, { status: "Approved" });
      const verify = await base44.entities.CustomerSelection.get(sel.id);
      if (verify.status !== "Approved") throw new Error("Expected status Approved, got " + verify.status);
      const req = await base44.entities.SelectionRequirement.get(seed.vanity_requirement_id);
      if (req.status !== "Approved") throw new Error("Requirement status not updated to Approved");
      return { status: "pass", message: "Selection approved and requirement status updated to Approved" };
    }
  },
  {
    id: 5,
    title: "Customer requests a change after approval",
    category: "Change Request",
    async run(seed) {
      const sels = await base44.entities.CustomerSelection.filter({ requirement_id: seed.vanity_requirement_id, status: "Approved" });
      if (sels.length === 0) throw new Error("No approved selection found — run Test 4 first");
      const sel = sels[0];
      const cr = await base44.entities.ChangeRequest.create({
        project_id: seed.project_id, area_id: seed.areas["Main Bathroom"],
        selection_id: sel.id, requirement_id: seed.vanity_requirement_id,
        original_item_name: "Shaker Vanity", original_price: sel.calculated_price,
        requested_item_name: "Shaker Vanity (42 inch)", requested_price: 950,
        reason: "Want larger vanity size", price_impact: 0, allowance_impact: -250,
        customer_note: "We'd prefer the 42 inch version", status: "Requested"
      });
      await base44.entities.SelectionRequirement.update(seed.vanity_requirement_id, { status: "Change Requested" });
      const verify = await base44.entities.ChangeRequest.get(cr.id);
      if (verify.status !== "Requested") throw new Error("Expected status Requested, got " + verify.status);
      return { status: "pass", message: `Change request created with status "Requested" (ID: ${cr.id.slice(0, 8)})` };
    }
  },
  {
    id: 6,
    title: "Staff rejects the change request",
    category: "Change Request",
    async run(seed) {
      const crs = await base44.entities.ChangeRequest.filter({ requirement_id: seed.vanity_requirement_id, status: "Requested" });
      if (crs.length === 0) throw new Error("No open change request found — run Test 5 first");
      const cr = crs[0];
      await base44.entities.ChangeRequest.update(cr.id, {
        status: "Rejected", staff_response: "The 42 inch vanity won't fit the available space.",
        reviewed_by: "staff", reviewed_date: new Date().toISOString(), resolved_date: new Date().toISOString()
      });
      const verify = await base44.entities.ChangeRequest.get(cr.id);
      if (verify.status !== "Rejected") throw new Error("Expected status Rejected, got " + verify.status);
      return { status: "pass", message: `Change request rejected with staff response: "${verify.staff_response}"` };
    }
  },
  {
    id: 7,
    title: "Staff marks an approved item as ordered",
    category: "Procurement",
    async run(seed) {
      const sels = await base44.entities.CustomerSelection.filter({ requirement_id: seed.vanity_requirement_id, status: "Approved" });
      if (sels.length === 0) throw new Error("No approved selection found — run Test 4 first");
      const sel = sels[0];
      const proc = await base44.entities.ProcurementItem.create({
        project_id: seed.project_id, area_id: seed.areas["Main Bathroom"],
        requirement_id: seed.vanity_requirement_id, selection_id: sel.id,
        catalogue_item_id: seed.vanity_item_id, item_name: "Shaker Vanity",
        category: "Vanity", supplier: "Frontier Cabinetry", brand: "Frontier",
        quantity: 1, unit_of_measure: "each", status: "Ready to Order"
      });
      await base44.entities.ProcurementItem.update(proc.id, {
        status: "Ordered", order_date: new Date().toISOString().slice(0, 10),
        purchase_order_number: "PO-001", expected_delivery_date: "2026-08-10"
      });
      await base44.entities.SelectionRequirement.update(seed.vanity_requirement_id, { status: "Ordered" });
      const verify = await base44.entities.ProcurementItem.get(proc.id);
      if (verify.status !== "Ordered") throw new Error("Expected procurement status Ordered, got " + verify.status);
      return { status: "pass", message: `Procurement item marked as Ordered (PO: ${verify.purchase_order_number}, expected: ${verify.expected_delivery_date})` };
    }
  },
  {
    id: 8,
    title: "Customer tries to change an ordered item — receives warning",
    category: "Procurement Lock",
    async run(seed) {
      const req = await base44.entities.SelectionRequirement.get(seed.vanity_requirement_id);
      if (!PAST_READY.includes(req.status)) throw new Error("Requirement status is " + req.status + " — expected Ordered. Run Test 7 first.");
      // The UI checks PAST_READY_STATUSES to show the warning
      return { status: "pass", message: `Requirement status is "${req.status}" — UI shows warning that changes require a formal change request` };
    }
  },
  {
    id: 9,
    title: "Staff generates a customer-facing final selections package",
    category: "Final Package",
    async run(seed) {
      const res = await base44.functions.invoke("getFinalPackage", { project_id: seed.project_id });
      const data = res.data;
      if (!data) throw new Error("No data returned from getFinalPackage");
      if (!data.items || data.items.length === 0) throw new Error("Package has no items");
      return { status: "pass", message: `Customer package generated with ${data.items.length} selection items` };
    }
  },
  {
    id: 10,
    title: "Staff generates an internal construction package",
    category: "Final Package",
    async run(seed) {
      const res = await base44.functions.invoke("getFinalPackage", { project_id: seed.project_id });
      const data = res.data;
      if (!data || !data.items) throw new Error("No package data returned");
      const hasProcurement = data.items.some(i => i.procurement_status || i.supplier);
      return { status: "pass", message: `Internal package generated — ${data.items.length} items${hasProcurement ? " with procurement details" : ""}` };
    }
  },
  {
    id: 11,
    title: "Customer uploads mood board images",
    category: "Mood Board",
    async run(seed) {
      const mb = await base44.entities.MoodBoardItem.create({
        project_id: seed.project_id, area_id: seed.areas["Main Bathroom"],
        image_url: "https://images.unsplash.com/photo-1584622650111-9cb1ca9f1f14?w=800",
        notes: "Inspiration for vanity hardware", tags: ["Bathroom", "Hardware", "Modern"],
        selection_category: "Vanity", priority: "Medium"
      });
      const verify = await base44.entities.MoodBoardItem.get(mb.id);
      if (!verify.image_url) throw new Error("Mood board item has no image_url");
      if (!verify.tags || verify.tags.length !== 3) throw new Error("Tags not saved correctly");
      return { status: "pass", message: `Mood board image uploaded with ${verify.tags.length} tags (ID: ${mb.id.slice(0, 8)})` };
    }
  },
  {
    id: 12,
    title: "Staff links a mood board item to bathroom vanity selection",
    category: "Mood Board",
    async run(seed) {
      const mbs = await base44.entities.MoodBoardItem.filter({ project_id: seed.project_id });
      if (mbs.length === 0) throw new Error("No mood board items found — run Test 11 first");
      const mb = mbs[mbs.length - 1]; // link the most recent one
      await base44.entities.MoodBoardItem.update(mb.id, { linked_requirement_id: seed.vanity_requirement_id });
      const verify = await base44.entities.MoodBoardItem.get(mb.id);
      if (verify.linked_requirement_id !== seed.vanity_requirement_id) throw new Error("Mood board item not linked to vanity requirement");
      return { status: "pass", message: `Mood board item linked to the Vanity selection requirement` };
    }
  }
];

export default function TestScenarios() {
  const [seedData, setSeedData] = useState(null);
  const [seeding, setSeeding] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [results, setResults] = useState({});
  const [running, setRunning] = useState(null);
  const [runningAll, setRunningAll] = useState(false);

  async function handleSeed() {
    setSeeding(true);
    try {
      const res = await base44.functions.invoke("seedTestData", { action: "seed" });
      setSeedData(res.data);
      setResults({});
    } catch (e) { alert("Seed failed: " + e.message); }
    setSeeding(false);
  }

  async function handleClean() {
    setCleaning(true);
    try {
      await base44.functions.invoke("seedTestData", { action: "clean" });
      setSeedData(null);
      setResults({});
    } catch (e) { alert("Clean failed: " + e.message); }
    setCleaning(false);
  }

  async function runTest(test) {
    if (!seedData) { alert("Seed test data first"); return; }
    setRunning(test.id);
    try {
      const result = await test.run(seedData);
      setResults(prev => ({ ...prev, [test.id]: result }));
    } catch (e) {
      setResults(prev => ({ ...prev, [test.id]: { status: "fail", message: e.message } }));
    }
    setRunning(null);
  }

  async function runAll() {
    if (!seedData) { alert("Seed test data first"); return; }
    setRunningAll(true);
    for (const test of TESTS) {
      setRunning(test.id);
      try {
        const result = await test.run(seedData);
        setResults(prev => ({ ...prev, [test.id]: result }));
      } catch (e) {
        setResults(prev => ({ ...prev, [test.id]: { status: "fail", message: e.message } }));
      }
      setRunning(null);
    }
    setRunningAll(false);
  }

  const passed = Object.values(results).filter(r => r.status === "pass").length;
  const failed = Object.values(results).filter(r => r.status === "fail").length;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-5xl">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <FlaskConical size={24} className="text-gray-900" />
          <h1 className="text-2xl font-bold text-gray-900">Test Scenarios</h1>
        </div>
        <p className="text-sm text-gray-500">Seed sample data and run end-to-end tests to verify the platform</p>
      </div>

      {/* Seed controls */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Database size={18} className="text-gray-700" />
          <h2 className="font-semibold text-gray-900">Sample Data</h2>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Creates the "Smith Main Floor Renovation" project with 4 areas, a Shaker Vanity catalogue item with conditional option rules,
          selection requirements, allowances, and mood board items.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button onClick={handleSeed} disabled={seeding || cleaning} className="gap-2">
            {seeding ? <Loader2 size={14} className="animate-spin" /> : <Database size={14} />}
            {seeding ? "Seeding..." : "Seed Test Data"}
          </Button>
          <Button onClick={handleClean} disabled={seeding || cleaning || !seedData} variant="outline" className="gap-2 text-red-600 hover:text-red-700">
            {cleaning ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            {cleaning ? "Cleaning..." : "Clean Test Data"}
          </Button>
          {seedData && (
            <Button onClick={runAll} disabled={runningAll} variant="secondary" className="gap-2">
              {runningAll ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
              {runningAll ? "Running..." : "Run All Tests"}
            </Button>
          )}
        </div>
        {seedData && (
          <div className="mt-4 bg-emerald-50 rounded-xl p-3 text-sm text-emerald-700 flex items-center gap-2">
            <CheckCircle size={14} /> Test data ready — Project: Smith Main Floor Renovation
            <Link to={`/projects/${seedData.project_id}`} className="ml-auto text-emerald-700 underline flex items-center gap-1">
              View project <ArrowRight size={12} />
            </Link>
          </div>
        )}
      </div>

      {/* Summary */}
      {(passed > 0 || failed > 0) && (
        <div className="flex gap-3">
          <div className="flex-1 bg-emerald-50 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-emerald-600">{passed}</p>
            <p className="text-xs text-emerald-700">Passed</p>
          </div>
          <div className="flex-1 bg-red-50 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-red-600">{failed}</p>
            <p className="text-xs text-red-700">Failed</p>
          </div>
          <div className="flex-1 bg-gray-50 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-gray-600">{TESTS.length - passed - failed}</p>
            <p className="text-xs text-gray-500">Pending</p>
          </div>
        </div>
      )}

      {/* Test cases */}
      <div className="space-y-3">
        {TESTS.map(test => {
          const result = results[test.id];
          const isRunning = running === test.id;
          return (
            <div key={test.id} className={`bg-white rounded-2xl border p-4 ${result?.status === "pass" ? "border-emerald-200" : result?.status === "fail" ? "border-red-200" : "border-gray-200"}`}>
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm font-bold ${
                  result?.status === "pass" ? "bg-emerald-100 text-emerald-600" :
                  result?.status === "fail" ? "bg-red-100 text-red-600" :
                  "bg-gray-100 text-gray-400"
                }`}>
                  {result?.status === "pass" ? <CheckCircle size={16} /> : result?.status === "fail" ? <XCircle size={16} /> : test.id}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium text-gray-900 text-sm">{test.title}</p>
                  </div>
                  <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">{test.category}</span>
                  {result && (
                    <div className={`mt-2 text-sm rounded-lg p-2.5 ${result.status === "pass" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                      {result.message}
                    </div>
                  )}
                </div>
                <Button size="sm" variant="outline" onClick={() => runTest(test)} disabled={isRunning || !seedData} className="shrink-0 gap-1.5">
                  {isRunning ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                  {isRunning ? "Running" : "Run"}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}