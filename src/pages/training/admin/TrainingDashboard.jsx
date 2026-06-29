import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Users, Play, AlertTriangle, TrendingUp, SkipForward, Clock } from "lucide-react";

export default function TrainingDashboard() {
  const [progress, setProgress] = useState([]);
  const [tutorials, setTutorials] = useState([]);
  const [articles, setArticles] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    const [progs, tuts, arts, usrs] = await Promise.all([
      base44.entities.TrainingProgress.list("-last_activity", 200),
      base44.entities.Tutorial.list("-display_order", 100),
      base44.entities.HelpArticle.list("-view_count", 100),
      base44.entities.User.list()
    ]);
    setProgress(progs); setTutorials(tuts); setArticles(arts); setUsers(usrs);
    setLoading(false);
  };

  const seedContent = async () => {
    setSeeding(true);
    try {
      const res = await base44.functions.invoke("seedTutorials", {});
      alert(res.data?.message || "Seeded successfully");
      load();
    } catch (e) {
      alert(e.response?.data?.error || e.message || "Seed failed");
    }
    setSeeding(false);
  };

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-gray-200 border-t-gray-800 rounded-full animate-spin" /></div>;

  const tutorialProgress = progress.filter(p => p.item_type === "tutorial");
  const userIds = new Set(tutorialProgress.map(p => p.user_id));
  const notStarted = users.filter(u => !userIds.has(u.id) && u.role !== "customer");
  const inProgress = users.filter(u => {
    const userProgs = tutorialProgress.filter(p => p.user_id === u.id);
    return userProgs.some(p => p.status === "In Progress" || p.status === "Not Started") && !userProgs.every(p => p.status === "Completed");
  });
  const completed = users.filter(u => {
    const userProgs = tutorialProgress.filter(p => p.user_id === u.id);
    return userProgs.length > 0 && userProgs.every(p => p.status === "Completed");
  });

  const needsReview = tutorials.filter(t => t.review_status === "Needs Review" || t.status === "Needs Review");
  const outdatedArticles = articles.filter(a => a.review_status === "Needs Review" || a.status === "Needs Review");
  const mostViewed = [...articles].sort((a, b) => (b.view_count || 0) - (a.view_count || 0)).slice(0, 5);
  const skipped = tutorialProgress.filter(p => p.status === "Skipped");

  const requiredTutorials = tutorials.filter(t => t.required);
  const incompleteRequired = users.map(u => {
    const userProgs = tutorialProgress.filter(p => p.user_id === u.id && p.status === "Completed");
    const incomplete = requiredTutorials.filter(t => !userProgs.some(p => p.item_id === t.id));
    return { user: u, incomplete };
  }).filter(x => x.incomplete.length > 0 && x.user.role !== "customer");

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Training Dashboard</h1>
        <button onClick={seedContent} disabled={seeding} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
          {seeding ? "Seeding..." : "Seed Starter Content"}
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <Users size={20} className="text-gray-400 mb-2" />
          <p className="text-2xl font-bold text-gray-900">{notStarted.length}</p>
          <p className="text-xs text-gray-500">Not Started</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <Play size={20} className="text-blue-500 mb-2" />
          <p className="text-2xl font-bold text-gray-900">{inProgress.length}</p>
          <p className="text-xs text-gray-500">In Progress</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <Users size={20} className="text-green-500 mb-2" />
          <p className="text-2xl font-bold text-gray-900">{completed.length}</p>
          <p className="text-xs text-gray-500">Completed</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <AlertTriangle size={20} className="text-amber-500 mb-2" />
          <p className="text-2xl font-bold text-gray-900">{needsReview.length + outdatedArticles.length}</p>
          <p className="text-xs text-gray-500">Need Review</p>
        </div>
      </div>

      {/* Required tutorials incomplete */}
      {incompleteRequired.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="font-semibold text-gray-900 mb-3">Required Tutorials Incomplete</h2>
          <div className="space-y-2">
            {incompleteRequired.map(({ user, incomplete }) => (
              <div key={user.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-900">{user.full_name || user.email}</span>
                <span className="text-gray-500">{incomplete.length} incomplete: {incomplete.map(t => t.title).join(", ")}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Review queue */}
      {(needsReview.length > 0 || outdatedArticles.length > 0) && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
          <h2 className="font-semibold text-amber-900 mb-3 flex items-center gap-2"><AlertTriangle size={18} /> Content Needing Review</h2>
          <div className="space-y-1">
            {needsReview.map(t => (
              <div key={t.id} className="text-sm text-amber-800 flex items-center justify-between">
                <span>📋 {t.title}</span>
                <span className="text-xs">{t.review_reason || "Feature updated"}</span>
              </div>
            ))}
            {outdatedArticles.map(a => (
              <div key={a.id} className="text-sm text-amber-800 flex items-center justify-between">
                <span>📄 {a.title}</span>
                <span className="text-xs">{a.review_reason || "Feature updated"}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Most viewed articles */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2"><TrendingUp size={18} /> Most Viewed Articles</h2>
          <div className="space-y-2">
            {mostViewed.map(a => (
              <div key={a.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-900">{a.title}</span>
                <span className="text-gray-500">{a.view_count || 0} views</span>
              </div>
            ))}
          </div>
        </div>

        {/* Skipped tutorials */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2"><SkipForward size={18} /> Commonly Skipped</h2>
          <div className="space-y-2">
            {skipped.length > 0 ? skipped.map(p => (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-900">{p.item_name}</span>
                <span className="text-gray-500">{p.user_name}</span>
              </div>
            )) : <p className="text-gray-400 text-sm">No skipped tutorials</p>}
          </div>
        </div>
      </div>

      {/* Employee progress table */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="font-semibold text-gray-900 mb-3">Employee Progress</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase">
                <th className="py-2 pr-4">Employee</th>
                <th className="py-2 pr-4">Role</th>
                <th className="py-2 pr-4">Completed</th>
                <th className="py-2 pr-4">Incomplete</th>
                <th className="py-2 pr-4">Progress</th>
                <th className="py-2 pr-4">Last Activity</th>
              </tr>
            </thead>
            <tbody>
              {users.filter(u => u.role !== "customer").map(u => {
                const userProgs = tutorialProgress.filter(p => p.user_id === u.id);
                const userCompleted = userProgs.filter(p => p.status === "Completed");
                const userIncomplete = requiredTutorials.filter(t => !userCompleted.some(p => p.item_id === t.id));
                const pct = requiredTutorials.length > 0 ? Math.round((userCompleted.length / requiredTutorials.length) * 100) : 0;
                const lastAct = userProgs.length > 0 ? userProgs[0].last_activity : null;
                return (
                  <tr key={u.id} className="border-b border-gray-50">
                    <td className="py-2 pr-4 text-gray-900">{u.full_name || u.email}</td>
                    <td className="py-2 pr-4 text-gray-500">{u.role}</td>
                    <td className="py-2 pr-4 text-green-600">{userCompleted.length}</td>
                    <td className="py-2 pr-4 text-red-500">{userIncomplete.length}</td>
                    <td className="py-2 pr-4">
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-gray-200 rounded-full h-1.5"><div className="bg-blue-600 h-1.5 rounded-full" style={{ width: `${pct}%` }} /></div>
                        <span className="text-xs text-gray-500">{pct}%</span>
                      </div>
                    </td>
                    <td className="py-2 pr-4 text-gray-400 text-xs">{lastAct ? new Date(lastAct).toLocaleDateString() : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}