import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { ArrowLeft, Clock, Play, CheckCircle2, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function TutorialWalkthrough() {
  const { tutorialId } = useParams();
  const [tutorial, setTutorial] = useState(null);
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!tutorialId) return;
    Promise.all([
      base44.entities.Tutorial.get(tutorialId),
      base44.auth.me().then(u => u ? base44.entities.TrainingProgress.filter({ user_id: u.id, item_type: "tutorial", item_id: tutorialId }) : [])
    ]).then(([t, progs]) => {
      setTutorial(t);
      setProgress(progs.length > 0 ? progs[0] : null);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [tutorialId]);

  const startWalkthrough = () => {
    localStorage.setItem("activeWalkthrough", tutorial.id);
    if (tutorial.target_page) {
      const cleanPath = tutorial.target_page
        .replace(":projectId", "").replace(":areaId", "").replace(":requirementId", "").replace(":itemId", "")
        .replace(/\/+$/, "");
      navigate(cleanPath || "/");
    } else {
      navigate("/");
    }
  };

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-gray-200 border-t-gray-800 rounded-full animate-spin" /></div>;
  if (!tutorial) return <div className="p-6 text-center text-gray-500">Tutorial not found</div>;

  const isCompleted = progress?.status === "Completed";

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Link to="/training" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-4">
        <ArrowLeft size={16} /> Back to Help & Training
      </Link>

      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{tutorial.category}</span>
          <span className="text-xs text-gray-400 flex items-center gap-1"><Clock size={12} /> {tutorial.estimated_minutes || 5} min</span>
          {isCompleted && <span className="text-xs text-green-600 flex items-center gap-1"><CheckCircle2 size={12} /> Completed</span>}
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">{tutorial.title}</h1>
        <p className="text-gray-600 mb-6">{tutorial.description}</p>

        {tutorial.applies_to_roles && tutorial.applies_to_roles.length > 0 && (
          <div className="mb-6">
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Applies to</p>
            <div className="flex flex-wrap gap-2">
              {tutorial.applies_to_roles.map(r => (
                <span key={r} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-md">{r}</span>
              ))}
            </div>
          </div>
        )}

        <div className="mb-6">
          <p className="text-xs font-semibold text-gray-500 uppercase mb-3 flex items-center gap-1"><ListChecks size={14} /> Steps</p>
          <div className="space-y-3">
            {tutorial.steps?.map((step, idx) => (
              <div key={idx} className="flex gap-3">
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-semibold">
                  {idx + 1}
                </div>
                <div>
                  <p className="font-medium text-gray-900 text-sm">{step.title}</p>
                  <p className="text-sm text-gray-500">{step.instruction}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <Button onClick={startWalkthrough} size="lg">
            <Play size={16} /> {isCompleted ? "Restart Walkthrough" : "Start Walkthrough"}
          </Button>
          <Link to="/training">
            <Button variant="outline" size="lg">Cancel</Button>
          </Link>
        </div>

        {tutorial.target_page && (
          <p className="text-xs text-gray-400 mt-4">
            This walkthrough will navigate you to the {tutorial.target_page} page and guide you through each step.
          </p>
        )}
      </div>
    </div>
  );
}