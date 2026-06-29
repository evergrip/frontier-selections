import React, { useState } from "react";
import { Check, X, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function KnowledgeCheckCard({ check, onAnswered }) {
  const [selected, setSelected] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  const isCorrect = selected === check.correct_answer;

  const handleSubmit = () => {
    setSubmitted(true);
    if (onAnswered) onAnswered(isCorrect);
  };

  const handleReset = () => {
    setSelected(null);
    setSubmitted(false);
  };

  return (
    <div className="border border-gray-200 rounded-xl p-5 bg-white">
      <div className="flex items-start gap-2 mb-4">
        <Lightbulb size={18} className="text-amber-500 mt-0.5 flex-shrink-0" />
        <h3 className="font-semibold text-gray-900 text-sm">{check.question}</h3>
      </div>

      <div className="space-y-2 mb-4">
        {check.answer_choices.map((choice, idx) => {
          const isSelected = selected === choice;
          const isCorrectChoice = choice === check.correct_answer;
          let style = "border-gray-200 hover:border-blue-300 hover:bg-blue-50";
          if (submitted) {
            if (isCorrectChoice) style = "border-green-500 bg-green-50";
            else if (isSelected) style = "border-red-500 bg-red-50";
            else style = "border-gray-200 opacity-60";
          } else if (isSelected) {
            style = "border-blue-500 bg-blue-50";
          }
          return (
            <button
              key={idx}
              onClick={() => !submitted && setSelected(choice)}
              disabled={submitted}
              className={`w-full text-left px-4 py-2.5 rounded-lg border-2 text-sm transition-colors ${style}`}
            >
              <div className="flex items-center justify-between">
                <span>{choice}</span>
                {submitted && isCorrectChoice && <Check size={16} className="text-green-600" />}
                {submitted && isSelected && !isCorrectChoice && <X size={16} className="text-red-600" />}
              </div>
            </button>
          );
        })}
      </div>

      {submitted && (
        <div className={`rounded-lg p-3 mb-4 text-sm ${isCorrect ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
          <p className="font-semibold mb-1">{isCorrect ? "✓ Correct!" : "✗ Not quite."}</p>
          <p className="text-gray-700">{check.explanation}</p>
        </div>
      )}

      <div className="flex justify-end">
        {!submitted ? (
          <Button size="sm" onClick={handleSubmit} disabled={!selected}>
            Check Answer
          </Button>
        ) : (
          <Button variant="outline" size="sm" onClick={handleReset}>
            Try Again
          </Button>
        )}
      </div>
    </div>
  );
}