import React, { useState, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { isStaff } from "@/lib/constants";

import StaffLayout from "@/components/StaffLayout";
import CustomerLayout from "@/components/CustomerLayout";

import StaffDashboard from "@/pages/StaffDashboard";
import Projects from "@/pages/Projects";
import ProjectDetail from "@/pages/ProjectDetail";
import AreaDetail from "@/pages/AreaDetail";
import RequirementDetail from "@/pages/RequirementDetail";
import Catalogue from "@/pages/Catalogue";
import CatalogueItemEditor from "@/pages/CatalogueItemEditor";
import Templates from "@/pages/Templates";
import Notifications from "@/pages/Notifications";
import ChangeRequests from "@/pages/ChangeRequests";
import ChangeRequestDetail from "@/pages/ChangeRequestDetail";
import Procurement from "@/pages/Procurement";
import ProcurementDetail from "@/pages/ProcurementDetail";
import SupplierOrderList from "@/pages/SupplierOrderList";
import StaffMoodBoard from "@/pages/StaffMoodBoard";

import CustomerDashboard from "@/pages/portal/CustomerDashboard";
import CustomerAreaView from "@/pages/portal/CustomerAreaView";
import CustomerProjectView from "@/pages/portal/CustomerProjectView";
import CustomerSelectionView from "@/pages/portal/CustomerSelectionView";
import CustomerMoodBoard from "@/pages/portal/CustomerMoodBoard";
import CustomerNotifications from "@/pages/portal/CustomerNotifications";

export default function RoleRouter() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.auth.me().then(u => { setUser(u); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-gray-200 border-t-gray-800 rounded-full animate-spin" />
      </div>
    );
  }

  const staffUser = isStaff(user);

  if (staffUser) {
    return (
      <Routes>
        <Route element={<StaffLayout />}>
          <Route path="/" element={<StaffDashboard />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/projects/:projectId" element={<ProjectDetail />} />
          <Route path="/projects/:projectId/area/:areaId" element={<AreaDetail />} />
          <Route path="/projects/:projectId/area/:areaId/requirement/:requirementId" element={<RequirementDetail />} />
          <Route path="/catalogue" element={<Catalogue />} />
          <Route path="/catalogue/:itemId" element={<CatalogueItemEditor />} />
          <Route path="/templates" element={<Templates />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/change-requests" element={<ChangeRequests />} />
          <Route path="/change-requests/:changeRequestId" element={<ChangeRequestDetail />} />
          <Route path="/procurement" element={<Procurement />} />
          <Route path="/procurement/:procurementId" element={<ProcurementDetail />} />
          <Route path="/supplier-orders" element={<SupplierOrderList />} />
          <Route path="/mood-board" element={<StaffMoodBoard />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route element={<CustomerLayout />}>
        <Route path="/portal" element={<CustomerDashboard />} />
        <Route path="/portal/project/:projectId" element={<CustomerProjectView />} />
        <Route path="/portal/project/:projectId/area/:areaId" element={<CustomerAreaView />} />
        <Route path="/portal/project/:projectId/area/:areaId/selection/:requirementId" element={<CustomerSelectionView />} />
        <Route path="/portal/mood-board" element={<CustomerMoodBoard />} />
        <Route path="/portal/notifications" element={<CustomerNotifications />} />
      </Route>
      <Route path="*" element={<Navigate to="/portal" replace />} />
    </Routes>
  );
}