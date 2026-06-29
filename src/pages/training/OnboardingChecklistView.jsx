import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { ArrowLeft, CheckCircle2, Circle, ExternalLink, Play } from "lucide-react";

export default function OnboardingChecklistView() {
  const [user, setUser] = useState(null);
  const [checklist, setChecklist] = useState(null);
  const [progress, setProgress] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      if (!u) { setLoading(false); return; }
      const myRole = u.role === "admin" ? "Admin / Operations Manager" : "Project Coordinator";
      base44.entities.OnboardingChecklist.filter({ role: myRole, is_active: true }).then(lists => {
        if (lists.length > 0) setChecklist(lists[0]);
        base44.entities.TrainingProgress.filter({ user_id: u.id, item_type: "checklist_item" }).then(progs => {
          setProgress(progs);
          setLoading(false);
        });
      });
    }).catch(() => setLoading(false));
  }, []);

  const isItemCompleted = (itemName) => progress.some(p => p.item_name === itemName && p.status === "Completed");

  const toggleItem = async (item) => {
    const existing = progress.find(p => p.item_name === item.name);
    if (existing) {
      const newStatus = existing.status === "Completed" ? "Not Started" : "Completed";
      await base44.entities.TrainingProgress.update(existing.id, {
        status: newStatus,
        completed_date: newStatus === "Completed" ? new Date().toISOString() : null,
        last_activity: new Date().toISOString()
      });
    } else {
      await base44.entities.TrainingProgress.create({
        user_id: user.id, user_name: user.full_name || user.email,
        role: user.role, item_type: "checklist_item", item_id: item.name,
        item_name: item.name, status: "Completed",
        completed_date: new Date().toISOString(),
        last_activity: new Date().toISOString()
      });
    }
    const progs = await base44.entities.TrainingProgress.filter({ user_id: user.id, item_type: "checklist_item" });
    setProgress(progs);
  };

  const startTutorial = (tutorialId) => {
    localStorage.setItem("activeWalkthrough", tutorialId);
    navigate("/");
  };

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-gray-200 border-t-gray-800 rounded-full animate-spin" /></div>;

  const items = checklist?.items || [];
  const completedCount = items.filter(i => isItemCompleted(i.name)).length;
  const pct = items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Link to="/training" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-4">
        <ArrowLeft size={16} /> Back to Help & Training
      </Link>

      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">{checklist?.title || "Onboarding Checklist"}</h1>
        <p className="text-gray-500 text-sm mb-4">Complete all required items to finish your onboarding</p>

        {/* Progress bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-gray-700">{completedCount} of {items.length} complete</span>
            <span className="text-sm text-gray-500">{pct}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div className="bg-green-600 h-2.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>

        {/* Checklist items */}
        <div className="space-y-2">
          {items.map((item, idx) => {
            const completed = isItemCompleted(item.name);
            return (
              <div key={idx} className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${completed ? "bg-green-50 border-green-200" : "bg-white border-gray-200 hover:border-gray-300"}`}>
                <button onClick={() => toggleItem(item)} className="mt-0.5 flex-shrink-0">
                  {completed ? <CheckCircle2 size={20} className="text-green-600" /> : <Circle size={20} className="text-gray-300" />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`font-medium text-sm ${completed ? "text-gray-500 line-through" : "text-gray-900"}`}>{item.name}</p>
                    {item.required && <span className="text-xs text-red-500 font-medium">Required</span>}
                  </div>
                  {item.description && <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>}
                  <div className="flex gap-3 mt-2">
                    {item.related_tutorial_id && (
                      <button onClick={() => startTutorial(item.related_tutorial_id)} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                        <Play size={10} /> Tutorial
                      </button>
                    )}
                    {item.related_article_id && (
                      <Link to={`/training/article/${item.related_article_id}`} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                        <ExternalLink size={10} /> Help Article
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {items.length === 0 && <p className="text-gray-400 text-sm text-center py-8">No checklist found for your role.</p>}
        </div>
      </div>
    </div>
  );
}