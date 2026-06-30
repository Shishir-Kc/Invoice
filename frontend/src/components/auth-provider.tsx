"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { authApi } from "@/lib/api";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  accountType?: string;
  hyperId?: string;
}

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (user: AuthUser) => void;
  logout: () => Promise<void>;
}

const USER_KEY = "invoicely_user";

const AuthContext = createContext<AuthState | undefined>(undefined);

function readStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // The session token lives in an HttpOnly cookie set by the backend — it is
  // never accessible to JS, so we don't store or read it here. We keep a
  // cached user object in localStorage purely for instant first paint; the
  // server (/me via the cookie) is the source of truth and corrects it.
  useEffect(() => {
    let cancelled = false;
    const storedUser = readStoredUser();
    if (storedUser) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUser(storedUser);
    }
    // Always validate against the server using the HttpOnly cookie. If the
    // cookie is missing/expired, /me returns 401 and we clear the cached user.
    authApi
      .me()
      .then(({ data: resp }) => {
        if (cancelled) return;
        const u = resp.data;
        const refreshed: AuthUser = {
          id: u.id,
          email: u.email,
          name: u.name,
          accountType: u.accountType,
          hyperId: u.hyperId,
        };
        localStorage.setItem(USER_KEY, JSON.stringify(refreshed));
        setUser(refreshed);
      })
      .catch(() => {
        if (cancelled) return;
        // 401 is also handled by the axios interceptor (clears user + may
        // redirect). For any failure, drop the cached user so we don't show
        // a stale identity.
        localStorage.removeItem(USER_KEY);
        setUser(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback((newUser: AuthUser) => {
    // The backend already set the HttpOnly session cookie in the response
    // that preceded this call. We only need to cache the user object.
    localStorage.setItem(USER_KEY, JSON.stringify(newUser));
    setUser(newUser);
  }, []);

  const logout = useCallback(async () => {
    // Tell the backend to delete the session row + clear the cookie.
    try {
      await authApi.logout();
    } catch {
      // Network/401 errors are fine — the cookie may already be gone.
    }
    localStorage.removeItem(USER_KEY);
    setUser(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      isAuthenticated: !!user,
      loading,
      login,
      logout,
    }),
    [user, loading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}

export { USER_KEY };
