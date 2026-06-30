import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { isStaff } from "@/lib/constants";
import { getImpersonationSession } from "@/lib/impersonation";

export function useProjectAccess(projectId) {
  const [state, setState] = useState({ loading: true, hasAccess: false, user: null });

  useEffect(() => {
    if (!projectId) { setState({ loading: false, hasAccess: false, user: null }); return; }
    let cancelled = false;
    (async () => {
      try {
        const user = await base44.auth.me();

        // During impersonation, treat the user as a customer so portal pages show the customer view
        const session = getImpersonationSession();
        let effectiveUser = user;
        if (session && session.project_id === projectId && isStaff(user)) {
          effectiveUser = { ...user, role: 'customer', _impersonating: true, _staffUser: user };
        }

        // Use server-side access verification
        const res = await base44.functions.invoke("projectAccess", { project_id: projectId });
        const hasAccess = res.data?.has_access === true;

        if (cancelled) return;
        setState({ loading: false, hasAccess, user: effectiveUser });
      } catch {
        if (!cancelled) setState({ loading: false, hasAccess: false, user: null });
      }
    })();
    return () => { cancelled = true; };
  }, [projectId]);

  return state;
}