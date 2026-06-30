import React from "react";
import { Check, ChevronRight } from "lucide-react";

const STEPS = [
  { num: 1, label: "Review Rooms", desc: "Explore your rooms and areas" },
  { num: 2, label: "Make Selections", desc: "Choose your finishes and fixtures" },
  { num: 3, label: "Frontier Reviews", desc: "We review your choices" },
  { num: 4, label: "Revise if Needed", desc: "Make changes based on feedback" },
  { num: 5, label: "Sign Off", desc: "Confirm your final choices" },
  { num: 6, label: "Materials Ordered", desc: "We handle procurement" },
  { num: 7, label: "Final Package", desc: "Your complete selections summary" },
];

export default function SelectionJourney({ requirements, selections, project }) {
  const DONE = ["Approved", "Locked", "Ready to Order", "Ordered", "Received", "Installed"];
  const totalReqs = (requirements || []).length;
  const completedReqs = (requirements || []).filter(r => DONE.includes(r.status)).length;
  const currentSels = (selections || []).filter(s => s.is_current);
  const hasAnySelection = currentSels.length > 0;
  const hasApproved = currentSels.some(s => s.status === "Approved");
  const hasRevision = currentSels.some(s => ["Revision Requested", "Rejected"].includes(s.status));
  const hasSignOffRequested = currentSels.some(s => s.sign_off_requested && !s.signed_off);
  const hasSignedOff = currentSels.some(s => s.signed_off);
  const hasLocked = currentSels.some(s => s.locked);
  const hasOrdered = (requirements || []).some(r => ["Ordered", "Received", "Installed"].includes(r.status));

  let currentStep = 1;
  if (totalReqs === 0) currentStep = 1;
  else if (!hasAnySelection) currentStep = 2;
  else if (hasRevision) currentStep = 4;
  else if (hasLocked || hasSignedOff) currentStep = hasOrdered ? 6 : 5;
  else if (hasSignOffRequested) currentStep = 5;
  else if (hasApproved) currentStep = 3;
  else currentStep = 2;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5">
      <h3 className="font-semibold text-gray-900 text-sm mb-3">Your Selection Journey</h3>
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {STEPS.map((step, i) => {
          const isDone = step.num < currentStep;
          const isCurrent = step.num === currentStep;
          return (
            <React.Fragment key={step.num}>
              <div className="flex flex-col items-center min-w-[80px] sm:min-w-[100px]">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  isDone ? "bg-emerald-500 text-white" :
                  isCurrent ? "bg-gray-900 text-white ring-4 ring-gray-100" :
                  "bg-gray-100 text-gray-400"
                }`}>
                  {isDone ? <Check size={14} /> : step.num}
                </div>
                <p className={`text-[10px] font-medium mt-1.5 text-center leading-tight ${
                  isCurrent ? "text-gray-900" : isDone ? "text-emerald-600" : "text-gray-400"
                }`}>{step.label}</p>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`h-0.5 flex-1 min-w-[12px] ${isDone ? "bg-emerald-400" : "bg-gray-100"}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>
      <p className="text-xs text-gray-500 mt-3">
        {currentStep === 1 && "Start by reviewing the rooms and areas in your project below."}
        {currentStep === 2 && "Browse your rooms and start choosing finishes and fixtures."}
        {currentStep === 3 && "Your selections are being reviewed by Frontier. We'll notify you when there's an update."}
        {currentStep === 4 && "Some selections need revision. Check the items marked \"Action Needed\" below."}
        {currentStep === 5 && "Please sign off on your approved selections to confirm your final choices."}
        {currentStep === 6 && "Your materials are being ordered. You'll be updated as items arrive."}
        {currentStep === 7 && "Your final selections package is ready!"}
      </p>
    </div>
  );
}