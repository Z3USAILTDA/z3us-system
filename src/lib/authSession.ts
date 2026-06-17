const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

const getProjectRef = () => {
  try {
    return new URL(SUPABASE_URL).hostname.split(".")[0];
  } catch {
    return "";
  }
};

export const AUTH_STORAGE_KEY = `sb-${getProjectRef()}-auth-token`;

export type AuthSessionPayload = {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
  expires_in?: number;
  token_type?: string;
  user?: unknown;
};

export const clearAuthStorage = () => {
  try {
    Object.keys(localStorage)
      .filter((key) => key.startsWith("sb-") && key.endsWith("-auth-token"))
      .forEach((key) => localStorage.removeItem(key));
  } catch {
    // ignore storage cleanup failures
  }
};

export const storeAuthSession = (session: AuthSessionPayload) => {
  const expiresAt = session.expires_at || Math.floor(Date.now() / 1000) + (session.expires_in || 3600);
  const normalizedSession = {
    ...session,
    token_type: session.token_type || "bearer",
    expires_in: session.expires_in || Math.max(0, expiresAt - Math.floor(Date.now() / 1000)),
    expires_at: expiresAt,
  };

  clearAuthStorage();
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(normalizedSession));
};

export const getStoredAuthSession = (): AuthSessionPayload | null => {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.access_token || !parsed?.refresh_token) return null;
    return parsed;
  } catch {
    return null;
  }
};

export const hasUsableStoredSession = () => {
  const session = getStoredAuthSession();
  if (!session?.access_token) return false;
  if (!session.expires_at) return true;
  return session.expires_at > Math.floor(Date.now() / 1000) + 30;
};

export const revokeStoredSession = () => {
  const accessToken = getStoredAuthSession()?.access_token;
  clearAuthStorage();

  if (!accessToken) return;

  void fetch(`${SUPABASE_URL}/auth/v1/logout`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${accessToken}`,
    },
    keepalive: true,
  }).catch(() => undefined);
};