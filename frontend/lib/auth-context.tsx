"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { API_BASE } from "./api";
import { AUTH_TOKENS_EVENT } from "./auth-constants";
import { apiPost } from "./api";

const ACCESS_STORAGE_KEY_DEV = "fab.dev.access_token";
const IS_DEV_STORAGE = process.env.NODE_ENV !== "production";
const REFRESH_ON_LOAD_PATHS = ["/admin", "/me", "/messages", "/login"];

type AuthContextValue = {
  accessToken: string | null;
  setAccessToken: (token: string | null) => void;
  setTokens: (access: string | null, refresh: string | null) => void;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  isAuthLoading: boolean;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [accessToken, setAccessTokenState] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  const setAccessToken = useCallback((token: string | null) => {
    setAccessTokenState(token);
    if (IS_DEV_STORAGE) {
      if (token) window.localStorage.setItem(ACCESS_STORAGE_KEY_DEV, token);
      else window.localStorage.removeItem(ACCESS_STORAGE_KEY_DEV);
    }
  }, []);

  const setTokens = useCallback(
    (access: string | null, _refresh: string | null) => {
      setAccessToken(access);
    },
    [setAccessToken]
  );

  const clearSession = useCallback(() => {
    setAccessTokenState(null);
    if (IS_DEV_STORAGE) window.localStorage.removeItem(ACCESS_STORAGE_KEY_DEV);
  }, []);

  const logout = useCallback(async () => {
    if (accessToken) {
      try {
        await apiPost<{ success: boolean }>("/auth/logout", { token: accessToken });
      } catch {
        // Logout must still clear local session even if API call fails.
      }
    }
    clearSession();
  }, [accessToken, clearSession]);

  // Au chargement : dev = lecture access depuis localStorage ; sinon refresh seulement sur les pages protégées.
  useEffect(() => {
    if (typeof window === "undefined") {
      setIsAuthLoading(false);
      return;
    }

    if (IS_DEV_STORAGE) {
      const storedAccess = window.localStorage.getItem(ACCESS_STORAGE_KEY_DEV);
      if (storedAccess) {
        setAccessTokenState(storedAccess);
        setIsAuthLoading(false);
        return;
      }
    }

    if (accessToken) {
      setIsAuthLoading(false);
      return;
    }

    if (!shouldRefreshOnLoad(pathname)) {
      setIsAuthLoading(false);
      return;
    }

    setIsAuthLoading(true);
    void tryRefreshOnLoad();
  }, [accessToken, pathname]);

  async function tryRefreshOnLoad() {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({})
      });
      if (!res.ok) {
        clearSession();
        return;
      }
      const data = (await res.json()) as { accessToken: string };
      setAccessTokenState(data.accessToken);
      if (IS_DEV_STORAGE && data.accessToken) {
        window.localStorage.setItem(ACCESS_STORAGE_KEY_DEV, data.accessToken);
      }
    } catch {
      clearSession();
    } finally {
      setIsAuthLoading(false);
    }
  }

  // Écoute des tokens renouvelés par l'API (refresh automatique sur 401)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ accessToken: string }>).detail;
      if (detail?.accessToken != null) {
        setAccessTokenState(detail.accessToken);
        if (IS_DEV_STORAGE) {
          window.localStorage.setItem(ACCESS_STORAGE_KEY_DEV, detail.accessToken);
        }
      }
    };
    window.addEventListener(AUTH_TOKENS_EVENT, handler);
    return () => window.removeEventListener(AUTH_TOKENS_EVENT, handler);
  }, []);

  const value = useMemo(
    () => ({
      accessToken,
      setAccessToken,
      setTokens,
      logout,
      isAuthenticated: Boolean(accessToken),
      isAuthLoading
    }),
    [accessToken, setAccessToken, setTokens, logout, isAuthLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return ctx;
}

function shouldRefreshOnLoad(pathname: string | null): boolean {
  if (!pathname) return false;
  return REFRESH_ON_LOAD_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}
