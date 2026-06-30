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
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
}

const TOKEN_KEY = "invoicely_token";
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
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Hydrate from localStorage on mount, then refresh from the server so the
  // user object is authoritative (e.g. hyperId, which gates official-only UI).
  // We keep the stored user while the refresh is in flight so the app can
  // render immediately; the refresh then corrects/updates it.
  useEffect(() => {
    let cancelled = false;
    const storedToken = localStorage.getItem(TOKEN_KEY);
    const storedUser = readStoredUser();
    if (storedToken && storedUser) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setToken(storedToken);
      setUser(storedUser);
      // Refresh in the background; ignore network failures (keep stored user).
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
          // A 401 is handled by the axios interceptor (clears auth + redirects).
          // Other transient errors: keep the stored user as-is.
        });
    }
    setLoading(false);
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback((newToken: string, newUser: AuthUser) => {
    localStorage.setItem(TOKEN_KEY, newToken);
    localStorage.setItem(USER_KEY, JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      token,
      isAuthenticated: !!token && !!user,
      loading,
      login,
      logout,
    }),
    [user, token, loading, login, logout],
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

export { TOKEN_KEY, USER_KEY };
