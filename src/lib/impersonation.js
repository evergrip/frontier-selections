const STORAGE_KEY = 'impersonation_session';

export function startImpersonation(session) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function getImpersonationSession() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export function clearImpersonation() {
  localStorage.removeItem(STORAGE_KEY);
}

export function isImpersonating() {
  return !!getImpersonationSession();
}

export function isViewAsCustomer() {
  const session = getImpersonationSession();
  return session?.mode === 'view';
}

export function isActAsCustomer() {
  const session = getImpersonationSession();
  return session?.mode === 'act';
}