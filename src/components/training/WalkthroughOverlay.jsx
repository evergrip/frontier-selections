import React, { useState, useEffect, useRef } from "react";
import { X, ChevronLeft, ChevronRight, Check, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function WalkthroughOverlay({ tutorial, currentStep, onNext, onPrev, onSkip, onComplete, onRestart }) {
  const [elementRect, setElementRect] = useState(null);
  const tooltipRef = useRef(null);
  const [tooltipPos, setTooltipPos] = useState({ top: 100, left: 100 });

  const step = tutorial?.steps?.[currentStep];
  const isLastStep = currentStep === (tutorial?.steps?.length || 0) - 1;

  useEffect(() => {
    if (!step?.target_element) {
      setElementRect(null);
      return;
    }
    let attempts = 0;
    const findElement = () => {
      let el;
      try { el = document.querySelector(step.target_element); } catch (e) { el = null; }
      if (el) {
        const rect = el.getBoundingClientRect();
        setElementRect(rect);
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("walkthrough-highlight");
        return el;
      }
      attempts++;
      if (attempts < 10) setTimeout(findElement, 300);
      return null;
    };
    const el = findElement();
    return () => {
      if (el) el.classList.remove("walkthrough-highlight");
    };
  }, [currentStep, step?.target_element]);

  useEffect(() => {
    if (elementRect && tooltipRef.current) {
      const tooltipHeight = tooltipRef.current.offsetHeight || 200;
      const tooltipWidth = tooltipRef.current.offsetWidth || 320;
      let top = elementRect.bottom + 12;
      let left = elementRect.left + elementRect.width / 2 - tooltipWidth / 2;
      if (top + tooltipHeight > window.innerHeight - 20) {
        top = elementRect.top - tooltipHeight - 12;
      }
      if (left < 12) left = 12;
      if (left + tooltipWidth > window.innerWidth - 12) left = window.innerWidth - tooltipWidth - 12;
      setTooltipPos({ top: Math.max(12, top), left });
    } else if (!elementRect) {
      setTooltipPos({
        top: window.innerHeight / 2 - 100,
        left: window.innerWidth / 2 - 180
      });
    }
  }, [elementRect]);

  if (!step) return null;

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none">
      {/* Backdrop with cutout */}
      {elementRect && (
        <div
          className="absolute pointer-events-auto"
          style={{
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)",
            borderRadius: 8,
            top: elementRect.top - 4,
            left: elementRect.left - 4,
            width: elementRect.width + 8,
            height: elementRect.height + 8,
            border: "2px solid #3b82f6",
          }}
        />
      )}
      {!elementRect && (
        <div className="absolute inset-0 bg-black/45 pointer-events-auto" />
      )}

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className="absolute pointer-events-auto bg-white rounded-xl shadow-2xl border border-gray-200 w-[360px] max-w-[calc(100vw-24px)]"
        style={{ top: tooltipPos.top, left: tooltipPos.left }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
              Step {currentStep + 1} of {tutorial.steps.length}
            </span>
            <span className="text-xs text-gray-400">{tutorial.title}</span>
          </div>
          <button onClick={onSkip} className="text-gray-400 hover:text-gray-600">
            <X size={16} />
          </button>
        </div>

        <div className="px-4 py-4">
          <h3 className="font-semibold text-gray-900 text-sm mb-2">{step.title}</h3>
          <p className="text-sm text-gray-600 leading-relaxed">{step.instruction}</p>
          {step.completion_trigger && (
            <p className="text-xs text-gray-400 mt-3 italic">
              ✓ {step.completion_trigger}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50 rounded-b-xl">
          <div className="flex items-center gap-1">
            <button onClick={onRestart} className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-200" title="Restart">
              <RotateCcw size={14} />
            </button>
            <Button variant="ghost" size="sm" onClick={onSkip}>
              Skip
            </Button>
          </div>
          <div className="flex items-center gap-2">
            {currentStep > 0 && (
              <Button variant="outline" size="sm" onClick={onPrev}>
                <ChevronLeft size={14} /> Back
              </Button>
            )}
            {isLastStep ? (
              <Button size="sm" onClick={onComplete} className="bg-green-600 hover:bg-green-700">
                <Check size={14} /> Complete
              </Button>
            ) : (
              <Button size="sm" onClick={onNext}>
                Next <ChevronRight size={14} />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}