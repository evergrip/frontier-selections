import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { Package, AlertTriangle, ImageOff, DollarSign, FolderTree, RefreshCw, Clock, Plus, Upload, Download, FileSpreadsheet, Ban, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import QuickAddItemDialog from "@/components/catalogue/QuickAddItemDialog";
import BuildertrendImportDialog from "@/components/catalogue/BuildertrendImportDialog";

function StatCard({ icon: Icon, label, value, color = "gray", to }) {
  const colorMap = {
    gray: "bg-gray-50 text-gray-700 hover:bg-gray-100",
    green: "bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
    red: "bg-red-50 text-red-700 hover:bg-red-100",
    amber: "bg-amber-50 text-amber-700 hover:bg-amber-100",
    blue: "bg-blue-50 text-blue-700 hover:bg-blue-100",
    purple: "bg-purple-50 text-purple-700 hover:bg-purple-100"
  };
  const content = (
    <div className={`rounded-xl p-4 transition-colors ${colorMap[color]} ${to ? "cursor-pointer" : ""}`}>
      <div className="flex items-center gap-2 mb-1"><Icon size={16} /><span className="text-xs font-medium">{label}</span></div>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
  if (to) return <Link to={to}>{content}</Link>;
  return content;
}

export default function CatalogueDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);

  useEffect(() => {
    base44.functions.invoke("catalogueManagement", { action: "dashboard_stats" })
      .then(res => setStats(res.data.stats))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-96"><div className="w-8 h-8 border-4 border-gray-200 border-t-gray-800 rounded-full animate-spin" /></div>;

  const s = stats || {};

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Catalogue Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your master catalogue and Buildertrend exports</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowImport(true)} className="gap-2"><Upload size={16} /> Import</Button>
          <Button onClick={() => setShowQuickAdd(true)} className="gap-2"><Plus size={16} /> Quick Add</Button>
          <Link to="/catalogue"><Button variant="outline" className="gap-2"><Package size={16} /> View All</Button></Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Package} label="Active Items" value={s.total_active || 0} color="green" to="/catalogue?filter=active" />
        <StatCard icon={Package} label="Inactive/Discontinued" value={s.inactive_discontinued || 0} color="gray" to="/catalogue?filter=inactive" />
        <StatCard icon={DollarSign} label="Missing Pricing" value={s.missing_pricing || 0} color="red" to="/catalogue?filter=missing_price" />
        <StatCard icon={FileSpreadsheet} label="Missing BT Fields" value={s.missing_bt_fields || 0} color="amber" to="/catalogue?filter=missing_bt" />
        <StatCard icon={ImageOff} label="Missing Images" value={s.missing_images || 0} color="amber" to="/catalogue?filter=missing_image" />
        <StatCard icon={FolderTree} label="Incomplete Options" value={s.incomplete_option_groups || 0} color="purple" to="/catalogue?filter=incomplete_options" />
        <StatCard icon={AlertTriangle} label="Not Assigned to Any Project" value={s.not_assigned_to_any_project || 0} color="blue" to="/catalogue?filter=not_assigned" />
        <StatCard icon={Clock} label="Needing Review" value={s.needing_review?.length || 0} color="amber" to="/catalogue?filter=needs_review" />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-900 text-sm mb-3">Cleanup Queues</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          <CleanupQueueItem icon={FileSpreadsheet} label="Missing Buildertrend mapping" to="/catalogue?filter=missing_bt" />
          <CleanupQueueItem icon={ImageOff} label="Missing image" to="/catalogue?filter=missing_image" />
          <CleanupQueueItem icon={DollarSign} label="Missing price" to="/catalogue?filter=missing_price" />
          <CleanupQueueItem icon={Package} label="Missing customer description" to="/catalogue?filter=missing_description" />
          <CleanupQueueItem icon={AlertTriangle} label="No assigned projects" to="/catalogue?filter=not_assigned" />
          <CleanupQueueItem icon={Ban} label="Discontinued but still assigned" to="/catalogue?filter=discontinued_assigned" />
          <CleanupQueueItem icon={FolderTree} label="Option group incomplete" to="/catalogue?filter=incomplete_options" />
          <CleanupQueueItem icon={Copy} label="Duplicate candidates" to="/catalogue?filter=duplicates" />
          <CleanupQueueItem icon={Clock} label="Needs supplier/SKU review" to="/catalogue?filter=needs_review" />
        </div>
      </div>

      {s.needing_review && s.needing_review.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 text-sm mb-3 flex items-center gap-2"><RefreshCw size={14} /> Items Needing Review</h2>
          <div className="space-y-2">
            {s.needing_review.slice(0, 10).map(item => (
              <Link key={item.id} to={`/catalogue/${item.id}`} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50">
                <div>
                  <p className="text-sm font-medium text-gray-900">{item.name}</p>
                  <p className="text-xs text-gray-500">{item.category} • {item.supplier || "—"}</p>
                </div>
                <div className="text-xs text-gray-400">
                  {!item.last_reviewed_date ? "Never reviewed" : `Reviewed ${new Date(item.last_reviewed_date).toLocaleDateString()}`}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {s.recently_updated && s.recently_updated.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 text-sm mb-3">Recently Updated</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {s.recently_updated.slice(0, 6).map(item => (
              <Link key={item.id} to={`/catalogue/${item.id}`} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
                  {item.default_image ? <img src={item.default_image} alt="" className="w-full h-full object-cover rounded-lg" /> : <Package size={18} className="text-gray-300" />}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                  <p className="text-xs text-gray-500">${(item.base_price || 0).toLocaleString()}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <QuickAddItemDialog open={showQuickAdd} onOpenChange={setShowQuickAdd} onCreated={() => {
        base44.functions.invoke("catalogueManagement", { action: "dashboard_stats" }).then(res => setStats(res.data.stats));
      }} />
      <BuildertrendImportDialog open={showImport} onOpenChange={setShowImport} onDone={() => {
        base44.functions.invoke("catalogueManagement", { action: "dashboard_stats" }).then(res => setStats(res.data.stats));
      }} />
    </div>
  );
}

function CleanupQueueItem({ icon: Icon, label, to }) {
  return (
    <Link to={to} className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 hover:bg-gray-50 transition-colors">
      <Icon size={14} className="text-gray-400 shrink-0" />
      <span className="text-sm text-gray-700">{label}</span>
    </Link>
  );
}