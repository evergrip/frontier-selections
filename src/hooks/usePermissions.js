import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { hasPermission, hasAnyPermission, isStaff } from "@/lib/constants";

export function usePermissions() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.auth.me().then(u => { setUser(u); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  return {
    loading,
    user,
    hasPermission: (perm) => hasPermission(user, perm),
    hasAnyPermission: (perms) => hasAnyPermission(user, perms),
    isAdmin: user?.role === 'admin',
    isStaff: isStaff(user)
  };
}