import React from "react";
import { useNavigate } from "react-router-dom";
import { getImpersonationSession, clearImpersonation } from "@/lib/impersonation";
import { base44 } from "@/api/base44Client";
import { Eye, AlertCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ImpersonationBanner() {
  const navigate = useNavigate();
  const session = getImpersonationSession();

  if (!session) return null;

  const isView = session.mode === 'view';

  const handleExit = async () => {
    try {
      await base44.functions.invoke("impersonation", {
        action: "exit",
        session_id: session.session_id,
        mode: session.mode,
        customer_name: session.customer_name,
        project_id: session.project_id
      });
    } catch (e) { /* ignore */ }
    clearImpersonation();
    navigate("/");
  };

  return (
    <div className={`px-4 py-2.5 flex items-center justify-between gap-3 text-sm ${isView ? 'bg-blue-600 text-white' : 'bg-amber-600 text-white'}`}>
      <div className="flex items-center gap-2 flex-1">
        {isView ? <Eye size={16} /> : <AlertCircle size={16} />}
        <span className="font-medium">
          {isView
            ? `Viewing as ${session.customer_name} — Read Only`
            : `Acting as ${session.customer_name}. Changes will be recorded as ${session.staff_name} acting on behalf of ${session.customer_name}.`
          }
        </span>
      </div>
      <Button
        size="sm"
        variant="secondary"
        onClick={handleExit}
        className="bg-white/20 text-white hover:bg-white/30 border-white/30"
      >
        <XCircle size={14} /> Exit Customer Mode
      </Button>
    </div>
  );
}