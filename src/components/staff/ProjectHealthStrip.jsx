import React from "react";
import { Link } from "react-router-dom";
import { Users, CheckCircle, Clock, Star, FileSignature, Lock, Package, AlertTriangle, Calendar } from "lucide-react";

export default function ProjectHealthStrip({ project, areas, requirements, selections, suggestedOptions, procurement, customerInvited }) {
  const DONE = ["Approved", "Locked", "Ready to Order", "Ordered", "Received", "Installed"];
  const currentSels = (selections || []).filter(s => s.is_current);

  const metrics = [];

  // Customer status
  const hasCustomer = (project.assigned_customers || []).length > 0;
  metrics.push({
    icon: Users,
    label: hasCustomer ? (customerInvited ? "Customer Active" : "Customer Assigned") : "No Customer",
    value: hasCustomer ? "✓" : "!",
    color: hasCustomer ? "green" : "red",
    link: null,
  });

  // Selections progress
  const totalReqs = (requirements || []).length;
  const completedReqs = (requirements || []).filter(r => DONE.includes(r.status)).length;
  metrics.push({
    icon: CheckCircle,
    label: "Selections",
    value: `${completedReqs}/${totalReqs}`,
    color: completedReqs === totalReqs && totalReqs > 0 ? "green" : "blue",
    link: null,
  });

  // Pending approvals
  const pendingCount = currentSels.filter(s => s.status === "Pending").length;
  if (pendingCount > 0) {
    metrics.push({
      icon: Clock,
      label: "Pending Approval",
      value: pendingCount,
      color: "amber",
      link: null,
    });
  }

  // Missing suggested options
  const missingSuggested = (requirements || []).filter(r => !DONE.includes(r.status) && (r.customer_catalogue_access_mode || "suggested_only") === "suggested_only" && !(suggestedOptions || []).some(s => s.requirement_id === r.id)).length;
  if (missingSuggested > 0) {
    metrics.push({
      icon: Star,
      label: "Missing Suggestions",
      value: missingSuggested,
      color: "red",
      link: null,
    });
  }

  // Requested sign-offs
  const signOffRequested = currentSels.filter(s => s.sign_off_requested && !s.signed_off).length;
  if (signOffRequested > 0) {
    metrics.push({
      icon: FileSignature,
      label: "Sign-off Requested",
      value: signOffRequested,
      color: "purple",
      link: null,
    });
  }

  // Locked selections
  const lockedCount = currentSels.filter(s => s.locked).length;
  if (lockedCount > 0) {
    metrics.push({
      icon: Lock,
      label: "Locked",
      value: lockedCount,
      color: "gray",
      link: null,
    });
  }

  // Procurement warnings
  const procWarnings = (procurement || []).filter(p => ["Backordered", "Delayed", "Substitution Required"].includes(p.status)).length;
  if (procWarnings > 0) {
    metrics.push({
      icon: Package,
      label: "Procurement Issues",
      value: procWarnings,
      color: "red",
      link: null,
    });
  }

  // Over allowance
  const overAllowance = currentSels.filter(s => (s.over_allowance || 0) > 0).length;
  if (overAllowance > 0) {
    metrics.push({
      icon: AlertTriangle,
      label: "Over Allowance",
      value: overAllowance,
      color: "red",
      link: null,
    });
  }

  // Next due date
  const upcomingReqs = (requirements || [])
    .filter(r => r.due_date && !DONE.includes(r.status))
    .sort((a, b) => (a.due_date || "9999").localeCompare(b.due_date || "9999"));
  if (upcomingReqs.length > 0) {
    const next = upcomingReqs[0];
    const isOverdue = new Date(next.due_date + "T00:00:00") < new Date();
    metrics.push({
      icon: Calendar,
      label: isOverdue ? "Overdue" : "Next Due",
      value: next.due_date,
      color: isOverdue ? "red" : "blue",
      link: null,
    });
  }

  const colorMap = {
    green: "bg-emerald-50 text-emerald-700 border-emerald-200",
    red: "bg-red-50 text-red-700 border-red-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    purple: "bg-purple-50 text-purple-700 border-purple-200",
    gray: "bg-gray-50 text-gray-600 border-gray-200",
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center gap-2 mb-3">
        <h2 className="font-semibold text-gray-900 text-sm">Project Health</h2>
      </div>
      <div className="flex flex-wrap gap-2">
        {metrics.map((m, i) => {
          const Icon = m.icon;
          return (
            <div key={i} className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${colorMap[m.color]}`}>
              <Icon size={14} className="shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] font-medium opacity-80 leading-none">{m.label}</p>
                <p className="text-sm font-bold leading-tight mt-0.5">{m.value}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}