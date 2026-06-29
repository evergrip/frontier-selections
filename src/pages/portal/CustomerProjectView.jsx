import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import StatusBadge from "@/components/ui/StatusBadge";
import CommentThread from "@/components/comments/CommentThread";
import ProjectTimeline from "@/components/comments/ProjectTimeline";

export default function CustomerProjectView() {
  const { projectId } = useParams();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.Project.get(projectId).then(p => { setProject(p); setLoading(false); }).catch(() => setLoading(false));
  }, [projectId]);

  if (loading) return <div className="flex items-center justify-center h-96"><div className="w-8 h-8 border-4 border-gray-200 border-t-gray-800 rounded-full animate-spin" /></div>;
  if (!project) return <div className="p-8 text-center text-gray-400">Project not found</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/portal" className="p-2 rounded-lg hover:bg-gray-100"><ArrowLeft size={18} /></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
          <p className="text-sm text-gray-500">Project Communication</p>
        </div>
        <StatusBadge status={project.status} />
      </div>

      {project.customer_notes && (
        <div className="bg-blue-50 rounded-xl p-4 text-sm text-blue-800">{project.customer_notes}</div>
      )}

      <ProjectTimeline projectId={projectId} staff={false} />

      <CommentThread projectId={projectId} targetType="project" targetId={projectId} staff={false} title="Ask a Question" />
    </div>
  );
}