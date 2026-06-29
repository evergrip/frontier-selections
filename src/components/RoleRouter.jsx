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
import Reports from "@/pages/Reports";
import FinalPackage from "@/pages/FinalPackage";
import SubstitutionDetail from "@/pages/SubstitutionDetail";
import TestScenarios from "@/pages/TestScenarios";

import HelpCenter from "@/pages/training/HelpCenter";
import TutorialWalkthrough from "@/pages/training/TutorialWalkthrough";
import HelpArticleView from "@/pages/training/HelpArticleView";
import OnboardingChecklistView from "@/pages/training/OnboardingChecklistView";
import KnowledgeCheckPage from "@/pages/training/KnowledgeCheckPage";
import PracticeMode from "@/pages/training/PracticeMode";
import TrainingDashboard from "@/pages/training/admin/TrainingDashboard";
import TutorialManager from "@/pages/training/admin/TutorialManager";
import HelpArticleManager from "@/pages/training/admin/HelpArticleManager";
import FeatureRegistryManager from "@/pages/training/admin/FeatureRegistryManager";
import KnowledgeCheckManager from "@/pages/training/admin/KnowledgeCheckManager";
import AdminPanel from "@/pages/admin/AdminPanel";

import CustomerDashboard from "@/pages/portal/CustomerDashboard";
import CustomerAreaView from "@/pages/portal/CustomerAreaView";
import CustomerProjectView from "@/pages/portal/CustomerProjectView";
import CustomerFinalPackage from "@/pages/portal/CustomerFinalPackage";
import CustomerSelectionView from "@/pages/portal/CustomerSelectionView";
import CustomerMoodBoard from "@/pages/portal/CustomerMoodBoard";
import CustomerNotifications from "@/pages/portal/CustomerNotifications";

export default function RoleRouter() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      setLoading(false);
      // Check if user is deactivated
      if (u && u.active === false) {
        base44.auth.logout("/login");
        return;
      }
      // Update last login for staff users
      if (u && (u.role === 'admin' || u.role === 'staff')) {
        base44.functions.invoke("userManagement", { action: "updateLastLogin" }).catch(() => {});
      }
    }).catch(() => setLoading(false));
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
          <Route path="/reports" element={<Reports />} />
          <Route path="/final-package" element={<FinalPackage />} />
          <Route path="/substitution/:id" element={<SubstitutionDetail />} />
          <Route path="/test-scenarios" element={<TestScenarios />} />
          <Route path="/training" element={<HelpCenter />} />
          <Route path="/training/walkthrough/:tutorialId" element={<TutorialWalkthrough />} />
          <Route path="/training/article/:articleId" element={<HelpArticleView />} />
          <Route path="/training/checklist" element={<OnboardingChecklistView />} />
          <Route path="/training/knowledge-check" element={<KnowledgeCheckPage />} />
          <Route path="/training/practice" element={<PracticeMode />} />
          <Route path="/training/admin/dashboard" element={<TrainingDashboard />} />
          <Route path="/training/admin/tutorials" element={<TutorialManager />} />
          <Route path="/training/admin/articles" element={<HelpArticleManager />} />
          <Route path="/training/admin/features" element={<FeatureRegistryManager />} />
          <Route path="/training/admin/knowledge-checks" element={<KnowledgeCheckManager />} />
          <Route path="/admin" element={<AdminPanel />} />
        </Route>
        {/* Portal routes for impersonation — separate from StaffLayout to avoid double-layout */}
        <Route element={<CustomerLayout />}>
          <Route path="/portal" element={<CustomerDashboard />} />
          <Route path="/portal/project/:projectId" element={<CustomerProjectView />} />
          <Route path="/portal/project/:projectId/final-package" element={<CustomerFinalPackage />} />
          <Route path="/portal/project/:projectId/area/:areaId" element={<CustomerAreaView />} />
          <Route path="/portal/project/:projectId/area/:areaId/selection/:requirementId" element={<CustomerSelectionView />} />
          <Route path="/portal/mood-board" element={<CustomerMoodBoard />} />
          <Route path="/portal/notifications" element={<CustomerNotifications />} />
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
        <Route path="/portal/project/:projectId/final-package" element={<CustomerFinalPackage />} />
        <Route path="/portal/project/:projectId/area/:areaId" element={<CustomerAreaView />} />
        <Route path="/portal/project/:projectId/area/:areaId/selection/:requirementId" element={<CustomerSelectionView />} />
        <Route path="/portal/mood-board" element={<CustomerMoodBoard />} />
        <Route path="/portal/notifications" element={<CustomerNotifications />} />
      </Route>
      <Route path="*" element={<Navigate to="/portal" replace />} />
    </Routes>
  );
}