import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import PackagePreview from "@/components/finalpackage/PackagePreview";
import PortalBreadcrumb from "@/components/portal/PortalBreadcrumb";
import { useProjectAccess } from "@/hooks/useProjectAccess";

export default function CustomerFinalPackage() {
  const { projectId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const { loading: accessLoading, hasAccess } = useProjectAccess(projectId);

  useEffect(() => {
    if (!hasAccess) { setLoading(false); return; }
    base44.functions.invoke("getFinalPackage", { project_id: projectId })
      .then(res => {
        if (res.data?.error) throw new Error(res.data.error);
        setData(res.data);
      })
      .catch(err => setLoadError(err.message || "Failed to load final package"))
      .finally(() => setLoading(false));
  }, [projectId, hasAccess]);

  if (loading || accessLoading) return <div className="flex items-center justify-center h-96"><div className="w-8 h-8 border-4 border-gray-200 border-t-gray-800 rounded-full animate-spin" /></div>;
  if (!hasAccess) return <div className="p-8 text-center text-gray-400">You don't have access to this project.</div>;
  if (loadError) return (
    <div className="p-8 text-center">
      <AlertTriangle size={32} className="mx-auto text-red-400 mb-2" />
      <p className="text-red-600 text-sm font-medium">Failed to load final selections package</p>
      <p className="text-gray-400 text-xs mt-1">{loadError}</p>
    </div>
  );
  if (!data) return <div className="p-8 text-center text-gray-400">Final selections package is not available.</div>;

  return (
    <div className="space-y-6">
      <PortalBreadcrumb items={[{ label: data.project?.name || "Project", to: `/portal/project/${projectId}` }, { label: "Final Selections Package" }]} />
      <Link to={`/portal/project/${projectId}`} className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900"><ArrowLeft size={16} /> Back to project</Link>
      <PackagePreview project={data.project} items={data.packageItems} internal={false} showPrice={data.showPrice} showAllowance={data.showAllowance} />
    </div>
  );
}