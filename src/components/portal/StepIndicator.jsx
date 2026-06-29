import React from "react";
import { Check } from "lucide-react";

const STEPS = [
  "Choose Room",
  "Choose Selection",
  "Pick Product",
  "Customize",
  "Review Allowance",
  "Submit",
  "Wait for Approval"
];

export default function StepIndicator({ currentStep }) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1 -mx-1 px-1">
      {STEPS.map((step, idx) => {
        const stepNum = idx + 1;
        const isDone = stepNum < currentStep;
        const isActive = stepNum === currentStep;
        return (
          <React.Fragment key={idx}>
            <div className="flex items-center gap-1.5 shrink-0">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                isDone ? "bg-emerald-500 text-white" :
                isActive ? "bg-gray-900 text-white" :
                "bg-gray-100 text-gray-400"
              }`}>
                {isDone ? <Check size={12} /> : stepNum}
              </div>
              <span className={`text-xs whitespace-nowrap ${isActive ? "font-semibold text-gray-900" : isDone ? "text-emerald-600" : "text-gray-400"}`}>
                {step}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div className={`h-px w-3 sm:w-6 shrink-0 ${isDone ? "bg-emerald-300" : "bg-gray-200"}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}