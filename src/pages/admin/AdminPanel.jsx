import React, { useState, useEffect } from "react";
import { Users, UserCircle, Shield, Mail, ScrollText, Lock } from "lucide-react";
import { base44 } from "@/api/base44Client";
import StaffManagement from "@/pages/admin/StaffManagement";
import CustomerManagement from "@/pages/admin/CustomerManagement";
import RolesPermissions from "@/pages/admin/RolesPermissions";
import InvitationManagement from "@/pages/admin/InvitationManagement";
import AuditLogViewer from "@/pages/admin/AuditLogViewer";
import EmailSettings from "@/pages/admin/EmailSettings";

const TABS = [
  { id: 'staff', label: 'Staff Users', icon: Users },
  { id: 'customers', label: 'Customer Users', icon: UserCircle },
  { id: 'roles', label: 'Roles & Permissions', icon: Shield },
  { id: 'invitations', label: 'Invitations', icon: Mail },
  { id: 'audit', label: 'Audit Logs', icon: ScrollText },
  { id: 'email', label: 'Email Settings', icon: Mail },
];

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState('staff');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.auth.me().then(u => { setUser(u); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-96"><div className="w-8 h-8 border-4 border-gray-200 border-t-gray-800 rounded-full animate-spin" /></div>;
  if (user?.role !== 'admin') {
    return (
      <div className="p-8 text-center">
        <Lock size={32} className="mx-auto text-gray-300 mb-2" />
        <p className="text-gray-500">Admin access required to view this page.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
        <p className="text-sm text-gray-500 mt-1">Manage users, roles, permissions, invitations, and audit logs</p>
      </div>

      <div className="flex gap-1 border-b border-gray-200 mb-6 overflow-x-auto">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              data-nav={`admin-${tab.id}`}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap
                ${activeTab === tab.id
                  ? 'border-gray-900 text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div>
        {activeTab === 'staff' && <StaffManagement />}
        {activeTab === 'customers' && <CustomerManagement />}
        {activeTab === 'roles' && <RolesPermissions />}
        {activeTab === 'invitations' && <InvitationManagement />}
        {activeTab === 'audit' && <AuditLogViewer />}
        {activeTab === 'email' && <EmailSettings />}
      </div>
    </div>
  );
}