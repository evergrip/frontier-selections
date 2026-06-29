import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { ArrowLeft, FlaskConical, Trash2, AlertTriangle, CheckCircle2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PracticeMode() {
  const [practiceProject, setPracticeProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const projects = await base44.entities.Project.list();
      const training = projects.find(p => p.name && p.name.startsWith('TRAINING:'));
      setPracticeProject(training || null);
    } catch (e) { /* ignore */ }
    setLoading(false);
  };

  const createPractice = async () => {
    setActionLoading(true);
    try {
      const res = await base44.functions.invoke("practiceMode", { action: "create" });
      alert(res.data?.message || "Practice project created");
      load();
    } catch (e) {
      alert(e.response?.data?.error || e.message || "Failed to create practice project");
    }
    setActionLoading(false);
  };

  const cleanPractice = async () => {
    if (!confirm("Delete all training data? This cannot be undone.")) return;
    setActionLoading(true);
    try {
      const res = await base44.functions.invoke("practiceMode", { action: "clean" });
      alert(res.data?.message || "Training data deleted");
      setPracticeProject(null);
    } catch (e) {
      alert(e.response?.data?.error || e.message || "Failed to delete");
    }
    setActionLoading(false);
  };

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-gray-200 border-t-gray-800 rounded-full animate-spin" /></div>;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Link to="/training" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-4">
        <ArrowLeft size={16} /> Back to Help & Training
      </Link>

      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
            <FlaskConical size={20} className="text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Practice Mode</h1>
            <p className="text-gray-500 text-sm">Practice using Frontier Selections with sample data</p>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-800">
            Practice Mode creates a sample project with training data so you can learn the system without affecting real client projects.
            All practice data is clearly labelled with <strong>"TRAINING:"</strong> in the name.
          </p>
        </div>

        <div className="space-y-3 mb-6">
          <div className="flex items-start gap-2 text-sm text-gray-600">
            <CheckCircle2 size={16} className="text-green-600 mt-0.5 flex-shrink-0" />
            <span>Sample project with Kitchen, Bathroom, and Global areas</span>
          </div>
          <div className="flex items-start gap-2 text-sm text-gray-600">
            <CheckCircle2 size={16} className="text-green-600 mt-0.5 flex-shrink-0" />
            <span>Sample catalogue items with option groups (sizes, colours)</span>
          </div>
          <div className="flex items-start gap-2 text-sm text-gray-600">
            <CheckCircle2 size={16} className="text-green-600 mt-0.5 flex-shrink-0" />
            <span>Sample selection requirements with allowances</span>
          </div>
          <div className="flex items-start gap-2 text-sm text-gray-600">
            <CheckCircle2 size={16} className="text-green-600 mt-0.5 flex-shrink-0" />
            <span>Sample pending selection (ready for you to review)</span>
          </div>
          <div className="flex items-start gap-2 text-sm text-gray-600">
            <CheckCircle2 size={16} className="text-green-600 mt-0.5 flex-shrink-0" />
            <span>Sample approved selection with procurement item</span>
          </div>
          <div className="flex items-start gap-2 text-sm text-gray-600">
            <CheckCircle2 size={16} className="text-green-600 mt-0.5 flex-shrink-0" />
            <span>Sample change request for you to process</span>
          </div>
        </div>

        {practiceProject ? (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
              <CheckCircle2 size={20} className="text-green-600" />
              <div className="flex-1">
                <p className="font-medium text-green-900 text-sm">Practice project is ready!</p>
                <p className="text-xs text-green-700">{practiceProject.name}</p>
              </div>
              <Button size="sm" onClick={() => navigate(`/projects/${practiceProject.id}`)}>
                Open Project <ExternalLink size={12} />
              </Button>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={cleanPractice} disabled={actionLoading} className="text-red-600 hover:text-red-700">
                <Trash2 size={14} /> Delete Practice Data
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-2">
              <AlertTriangle size={18} className="text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-amber-800">
                No practice project found. Click the button below to create one.
              </p>
            </div>
            <Button onClick={createPractice} disabled={actionLoading} size="lg">
              <FlaskConical size={16} /> {actionLoading ? "Creating..." : "Create Practice Project"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}