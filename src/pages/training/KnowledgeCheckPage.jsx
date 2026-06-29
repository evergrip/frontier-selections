import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { ArrowLeft, Lightbulb, Trophy } from "lucide-react";
import KnowledgeCheckCard from "@/components/training/KnowledgeCheckCard";

export default function KnowledgeCheckPage() {
  const [user, setUser] = useState(null);
  const [checks, setChecks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState({});

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      base44.entities.KnowledgeCheck.list().then(all => {
        const myRole = u?.role === "admin" ? "Admin / Operations Manager" : "Project Coordinator";
        const filtered = all.filter(c => !c.required_for_roles || c.required_for_roles.length === 0 || c.required_for_roles.includes(myRole));
        setChecks(filtered);
        setLoading(false);
      });
    }).catch(() => setLoading(false));
  }, []);

  const handleAnswered = (checkId, isCorrect) => {
    setResults(prev => ({ ...prev, [checkId]: isCorrect }));
    if (user) {
      base44.entities.TrainingProgress.filter({ user_id: user.id, item_type: "knowledge_check", item_id: checkId }).then(progs => {
        const data = {
          status: "Completed",
          score: isCorrect ? 1 : 0,
          completed_date: new Date().toISOString(),
          last_activity: new Date().toISOString()
        };
        if (progs.length > 0) {
          base44.entities.TrainingProgress.update(progs[0].id, data);
        } else {
          base44.entities.TrainingProgress.create({
            user_id: user.id, user_name: user.full_name || user.email,
            role: user.role, item_type: "knowledge_check", item_id: checkId,
            item_name: "Knowledge Check", ...data
          });
        }
      });
    }
  };

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-gray-200 border-t-gray-800 rounded-full animate-spin" /></div>;

  const correctCount = Object.values(results).filter(r => r).length;
  const answeredCount = Object.keys(results).length;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Link to="/training" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-4">
        <ArrowLeft size={16} /> Back to Help & Training
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Lightbulb size={24} className="text-amber-500" /> Knowledge Check
        </h1>
        <p className="text-gray-500 text-sm mt-1">Test your understanding of Frontier Selections</p>
      </div>

      {checks.length > 0 && answeredCount > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex items-center gap-3">
          <Trophy size={20} className="text-blue-600" />
          <p className="text-sm text-blue-800">
            You've answered {answeredCount} of {checks.length} questions. {correctCount} correct so far.
          </p>
        </div>
      )}

      <div className="space-y-4">
        {checks.map(check => (
          <KnowledgeCheckCard key={check.id} check={check} onAnswered={(isCorrect) => handleAnswered(check.id, isCorrect)} />
        ))}
        {checks.length === 0 && <p className="text-gray-400 text-sm text-center py-8">No knowledge checks available for your role.</p>}
      </div>
    </div>
  );
}