import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import PackagePreview from "@/components/finalpackage/PackagePreview";
import { useProjectAccess } from "@/hooks/useProjectAccess";

export default function CustomerFinalPackage() {
  const { projectId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { loading: accessLoading, hasAccess } = useProjectAccess(projectId);

  useEffect(() => {
    if (!hasAccess) { setLoading(false); return; }
    base44.functions.invoke("getFinalPackage", { project_id: projectId })
      .then(res => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [projectId, hasAccess]);

  if (loading || accessLoading) return <div className="flex items-center justify-center h-96"><div className="w-8 h-8 border-4 border-gray-200 border-t-gray-800 rounded-full animate-spin" /></div>;
  if (!hasAccess) return <div className="p-8 text-center text-gray-400">You don't have access to this project.</div>;
  if (!data) return <div className="p-8 text-center text-gray-400">Final selections package is not available.</div>;

  return (
    <div className="space-y-6">
      <Link to={`/portal/project/${projectId}`} className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900"><ArrowLeft size={16} /> Back to project</Link>
      <PackagePreview project={data.project} items={data.packageItems} internal={false} showPrice={data.showPrice} showAllowance={data.showAllowance} />
    </div>
  );
}