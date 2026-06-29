import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import WalkthroughOverlay from "./WalkthroughOverlay";

export default function WalkthroughManager() {
  const [tutorial, setTutorial] = useState(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const tutorialId = localStorage.getItem("activeWalkthrough");
    if (!tutorialId) return;
    let cancelled = false;
    base44.auth.me().then(user => {
      if (cancelled || !user) return;
      base44.entities.Tutorial.get(tutorialId).then(t => {
        if (cancelled) return;
        setTutorial(t);
        base44.entities.TrainingProgress.filter({
          user_id: user.id, item_type: "tutorial", item_id: tutorialId
        }).then(progs => {
          if (cancelled) return;
          if (progs.length > 0) {
            setProgress(progs[0]);
            setCurrentStep(progs[0].current_step || 0);
          } else {
            base44.entities.TrainingProgress.create({
              user_id: user.id, user_name: user.full_name || user.email,
              role: user.role, item_type: "tutorial", item_id: tutorialId,
              item_name: t.title, status: "In Progress", current_step: 0,
              last_activity: new Date().toISOString()
            }).then(p => { if (!cancelled) setProgress(p); });
          }
        });
      }).catch(() => {});
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const updateProgress = (step, status) => {
    if (!progress) return;
    base44.entities.TrainingProgress.update(progress.id, {
      current_step: step,
      status: status || progress.status,
      last_activity: new Date().toISOString()
    });
  };

  const handleNext = () => {
    const next = currentStep + 1;
    setCurrentStep(next);
    updateProgress(next);
  };

  const handlePrev = () => {
    const prev = Math.max(0, currentStep - 1);
    setCurrentStep(prev);
    updateProgress(prev);
  };

  const handleSkip = () => {
    if (progress) updateProgress(currentStep, "Skipped");
    localStorage.removeItem("activeWalkthrough");
    setTutorial(null);
  };

  const handleRestart = () => {
    setCurrentStep(0);
    updateProgress(0, "In Progress");
  };

  const handleComplete = () => {
    if (progress) {
      base44.entities.TrainingProgress.update(progress.id, {
        status: "Completed",
        completed_date: new Date().toISOString(),
        last_activity: new Date().toISOString()
      });
    }
    localStorage.removeItem("activeWalkthrough");
    setTutorial(null);
    navigate("/training");
  };

  if (!tutorial) return null;

  return (
    <WalkthroughOverlay
      tutorial={tutorial}
      currentStep={currentStep}
      onNext={handleNext}
      onPrev={handlePrev}
      onSkip={handleSkip}
      onRestart={handleRestart}
      onComplete={handleComplete}
    />
  );
}