import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { STAFF_ROLES, ROLE_PERMISSIONS, PERMISSIONS } from "@/lib/constants";
import { Loader2, Shield, ChevronDown, ChevronRight } from "lucide-react";

export default function RolesPermissions() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedRole, setExpandedRole] = useState(null);

  useEffect(() => {
    base44.functions.invoke("userManagement", { action: "listStaff" })
      .then(res => setStaff(res.data?.users || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const getStaffForRole = (role) => staff.filter(s => s.staff_role === role);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Staff Role Definitions</h2>
        <p className="text-sm text-gray-500">Default permission sets for each staff role. Individual permissions can be customized per user in the Staff Users tab.</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="animate-spin text-gray-400" /></div>
      ) : (
        <div className="space-y-3">
          {STAFF_ROLES.map(role => {
            const perms = ROLE_PERMISSIONS[role] || [];
            const staffInRole = getStaffForRole(role);
            const isExpanded = expandedRole === role;
            return (
              <div key={role} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => setExpandedRole(isExpanded ? null : role)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50"
                >
                  <div className="flex items-center gap-2">
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    <Shield size={16} className="text-gray-400" />
                    <span className="font-medium text-gray-900">{role}</span>
                    <span className="text-xs text-gray-400">({perms.length} permissions, {staffInRole.length} user(s))</span>
                  </div>
                </button>
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-gray-100">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-1 mt-3">
                      {PERMISSIONS.map(p => (
                        <div key={p} className={`text-xs font-mono px-2 py-1 rounded ${perms.includes(p) ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-400'}`}>
                          {perms.includes(p) ? '✓' : '—'} {p}
                        </div>
                      ))}
                    </div>
                    {staffInRole.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <p className="text-xs text-gray-500 mb-1">Users with this role:</p>
                        <div className="flex flex-wrap gap-2">
                          {staffInRole.map(s => (
                            <span key={s.id} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">{s.full_name || s.email}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}