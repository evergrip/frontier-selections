import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { isStaff } from "@/lib/constants";
import {
  GraduationCap, Search, BookOpen, CheckSquare, FlaskConical, Lightbulb,
  Clock, ArrowRight, Play, CheckCircle2, Circle, AlertTriangle, Settings
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const TRAINING_ROLES = [
  "Admin / Operations Manager", "Project Coordinator", "Sales / Pre-Construction",
  "Project Manager / Construction Team", "Catalogue Manager"
];

export default function HelpCenter() {
  const [user, setUser] = useState(null);
  const [tutorials, setTutorials] = useState([]);
  const [articles, setArticles] = useState([]);
  const [progress, setProgress] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      Promise.all([
        base44.entities.Tutorial.list("-display_order", 50),
        base44.entities.HelpArticle.filter({ status: "Published" }, "-view_count", 50),
        u ? base44.entities.TrainingProgress.filter({ user_id: u.id }, "-last_activity", 50) : Promise.resolve([])
      ]).then(([tuts, arts, progs]) => {
        setTutorials(tuts.filter(t => t.status === "Published"));
        setArticles(arts);
        setProgress(progs || []);
        setLoading(false);
      });
    }).catch(() => setLoading(false));
  }, []);

  const startWalkthrough = (tutorial) => {
    localStorage.setItem("activeWalkthrough", tutorial.id);
    if (tutorial.target_page) {
      navigate(tutorial.target_page.replace(":projectId", "").replace(":areaId", "").replace(":requirementId", "").replace(":itemId", "").replace(/\/+$/, "") || "/");
    } else {
      navigate("/");
    }
  };

  const filteredArticles = articles.filter(a =>
    !search || a.title.toLowerCase().includes(search.toLowerCase()) ||
    (a.body || "").toLowerCase().includes(search.toLowerCase()) ||
    (a.category || "").toLowerCase().includes(search.toLowerCase())
  );

  const myRole = user?.role === "admin" ? "Admin / Operations Manager" : "Project Coordinator";
  const roleTutorials = tutorials.filter(t => !t.applies_to_roles || t.applies_to_roles.length === 0 || t.applies_to_roles.includes(myRole));
  const completedIds = progress.filter(p => p.status === "Completed" && p.item_type === "tutorial").map(p => p.item_id);
  const completionPct = roleTutorials.length > 0
    ? Math.round((roleTutorials.filter(t => completedIds.includes(t.id)).length / roleTutorials.length) * 100)
    : 0;

  if (loading) {
    return <div className="flex justify-center items-center h-full py-20"><div className="w-8 h-8 border-4 border-gray-200 border-t-gray-800 rounded-full animate-spin" /></div>;
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <GraduationCap size={28} className="text-blue-600" />
            Help & Training
          </h1>
          <p className="text-gray-500 text-sm mt-1">Learn Frontier Selections at your own pace</p>
        </div>
        {user?.role === "admin" && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/training/admin/dashboard")}>
              <Settings size={14} /> Admin Dashboard
            </Button>
          </div>
        )}
      </div>

      {/* Getting Started Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-5 text-white">
          <CheckSquare size={24} className="mb-2 opacity-80" />
          <p className="text-3xl font-bold">{completionPct}%</p>
          <p className="text-sm opacity-90">Training Complete</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <Play size={24} className="mb-2 text-blue-600" />
          <p className="text-3xl font-bold text-gray-900">{roleTutorials.filter(t => completedIds.includes(t.id)).length}</p>
          <p className="text-sm text-gray-500">of {roleTutorials.length} Tutorials Done</p>
        </div>
        <Link to="/training/checklist" className="bg-white border border-gray-200 rounded-xl p-5 hover:border-blue-300 hover:shadow-sm transition-all">
          <CheckSquare size={24} className="mb-2 text-green-600" />
          <p className="text-sm font-semibold text-gray-900">Onboarding Checklist</p>
          <p className="text-xs text-gray-500 mt-1">Track your progress</p>
        </Link>
        <Link to="/training/knowledge-check" className="bg-white border border-gray-200 rounded-xl p-5 hover:border-blue-300 hover:shadow-sm transition-all">
          <Lightbulb size={24} className="mb-2 text-amber-500" />
          <p className="text-sm font-semibold text-gray-900">Knowledge Check</p>
          <p className="text-xs text-gray-500 mt-1">Test your knowledge</p>
        </Link>
        <Link to="/training/practice" className="bg-white border border-gray-200 rounded-xl p-5 hover:border-blue-300 hover:shadow-sm transition-all">
          <FlaskConical size={24} className="mb-2 text-purple-600" />
          <p className="text-sm font-semibold text-gray-900">Practice Mode</p>
          <p className="text-xs text-gray-500 mt-1">Try with sample data</p>
        </Link>
      </div>

      {/* Role-based Training Path */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Your Training Path: {myRole}</h2>
          <span className="text-sm text-gray-500">{roleTutorials.filter(t => completedIds.includes(t.id)).length} / {roleTutorials.length} completed</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {roleTutorials.map(tut => {
            const isCompleted = completedIds.includes(tut.id);
            return (
              <div key={tut.id} className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-2">
                  <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{tut.category}</span>
                  {isCompleted ? <CheckCircle2 size={18} className="text-green-600" /> : <Circle size={18} className="text-gray-300" />}
                </div>
                <h3 className="font-semibold text-gray-900 text-sm mb-1">{tut.title}</h3>
                <p className="text-xs text-gray-500 line-clamp-2 mb-3">{tut.description}</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400 flex items-center gap-1"><Clock size={12} /> {tut.estimated_minutes || 5} min</span>
                  <Button size="sm" variant={isCompleted ? "outline" : "default"} onClick={() => startWalkthrough(tut)}>
                    {isCompleted ? "Review" : "Start"} <ArrowRight size={12} />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Searchable Help Articles */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Help Articles</h2>
        <div className="relative mb-4">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search help articles..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredArticles.map(art => (
            <Link
              key={art.id}
              to={`/training/article/${art.id}`}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-sm transition-all flex items-start gap-3"
            >
              <BookOpen size={18} className="text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-gray-900 text-sm">{art.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{art.category} · {art.view_count || 0} views</p>
              </div>
            </Link>
          ))}
          {filteredArticles.length === 0 && (
            <p className="text-gray-400 text-sm col-span-2 text-center py-8">No articles found for "{search}"</p>
          )}
        </div>
      </div>

      {/* Admin Links */}
      {user?.role === "admin" && (
        <div className="border-t border-gray-200 pt-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Content Management</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Link to="/training/admin/tutorials" className="bg-white border border-gray-200 rounded-lg p-3 text-center hover:shadow-sm transition-all">
              <Play size={20} className="mx-auto mb-1 text-blue-600" />
              <p className="text-xs font-medium text-gray-900">Tutorials</p>
            </Link>
            <Link to="/training/admin/articles" className="bg-white border border-gray-200 rounded-lg p-3 text-center hover:shadow-sm transition-all">
              <BookOpen size={20} className="mx-auto mb-1 text-blue-600" />
              <p className="text-xs font-medium text-gray-900">Help Articles</p>
            </Link>
            <Link to="/training/admin/features" className="bg-white border border-gray-200 rounded-lg p-3 text-center hover:shadow-sm transition-all">
              <AlertTriangle size={20} className="mx-auto mb-1 text-amber-500" />
              <p className="text-xs font-medium text-gray-900">Feature Registry</p>
            </Link>
            <Link to="/training/admin/knowledge-checks" className="bg-white border border-gray-200 rounded-lg p-3 text-center hover:shadow-sm transition-all">
              <Lightbulb size={20} className="mx-auto mb-1 text-amber-500" />
              <p className="text-xs font-medium text-gray-900">Knowledge Checks</p>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}