"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { API_BASE } from "./api";
import { AUTH_TOKENS_EVENT } from "./auth-constants";
import { apiPost } from "./api";

const ACCESS_STORAGE_KEY_DEV = "fab.dev.access_token";
const IS_DEV_STORAGE = process.env.NODE_ENV !== "production";

type AuthContextValue = {
  accessToken: string | null;
  setAccessToken: (token: string | null) => void;
  setTokens: (access: string | null, refresh: string | null) => void;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [accessToken, setAccessTokenState] = useState<string | null>(null);

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

  // Au chargement : dev = lecture access depuis localStorage ; sinon tentative de refresh via cookie (httpOnly)
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (IS_DEV_STORAGE) {
      const storedAccess = window.localStorage.getItem(ACCESS_STORAGE_KEY_DEV);
      if (storedAccess) {
        setAccessTokenState(storedAccess);
        return;
      }
    }

    void tryRefreshOnLoad();
  }, []);

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
    }
  }

  // Écoute des tokens renouvelés par l’API (refresh automatique sur 401)
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
      isAuthenticated: Boolean(accessToken)
    }),
    [accessToken, setAccessToken, setTokens, logout]
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
