"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { API_BASE } from "./api";
import { AUTH_TOKENS_EVENT, REFRESH_STORAGE_KEY } from "./auth-constants";
import { apiPost } from "./api";

const ACCESS_STORAGE_KEY_DEV = "fab.dev.access_token";
const IS_DEV_STORAGE = process.env.NODE_ENV !== "production";

type AuthContextValue = {
  accessToken: string | null;
  refreshToken: string | null;
  setAccessToken: (token: string | null) => void;
  setTokens: (access: string | null, refresh: string | null) => void;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function getRefreshFromStorage(): string | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(REFRESH_STORAGE_KEY);
}

function setRefreshInStorage(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) window.sessionStorage.setItem(REFRESH_STORAGE_KEY, token);
  else window.sessionStorage.removeItem(REFRESH_STORAGE_KEY);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [accessToken, setAccessTokenState] = useState<string | null>(null);
  const [refreshToken, setRefreshTokenState] = useState<string | null>(null);
  const setAccessToken = useCallback((token: string | null) => {
    setAccessTokenState(token);
    if (IS_DEV_STORAGE) {
      if (token) window.localStorage.setItem(ACCESS_STORAGE_KEY_DEV, token);
      else window.localStorage.removeItem(ACCESS_STORAGE_KEY_DEV);
    }
  }, []);

  const setRefreshToken = useCallback((token: string | null) => {
    setRefreshTokenState(token);
    setRefreshInStorage(token);
  }, []);

  const setTokens = useCallback(
    (access: string | null, refresh: string | null) => {
      setAccessToken(access);
      setRefreshToken(refresh);
    },
    [setAccessToken, setRefreshToken]
  );

  const clearSession = useCallback(() => {
    setAccessTokenState(null);
    setRefreshTokenState(null);
    setRefreshInStorage(null);
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

  // Restauration au mount : dev = lecture access (et optionnellement refresh) depuis localStorage ; prod = lecture refresh depuis sessionStorage puis refresh silencieux
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (IS_DEV_STORAGE) {
      const storedAccess = window.localStorage.getItem(ACCESS_STORAGE_KEY_DEV);
      const storedRefresh = getRefreshFromStorage();
      if (storedAccess) {
        setAccessTokenState(storedAccess);
        if (storedRefresh) setRefreshTokenState(storedRefresh);
      } else if (storedRefresh) {
        setRefreshTokenState(storedRefresh);
        void tryRefreshOnLoad(storedRefresh);
      }
      return;
    }

    const storedRefresh = getRefreshFromStorage();
    if (storedRefresh) {
      setRefreshTokenState(storedRefresh);
      void tryRefreshOnLoad(storedRefresh);
    }
  }, []);

  async function tryRefreshOnLoad(refresh: string) {
    try {
      const url = `${API_BASE}/auth/refresh`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: refresh })
      });
      if (!res.ok) {
        clearSession();
        return;
      }
      const data = (await res.json()) as { accessToken: string; refreshToken: string };
      setAccessTokenState(data.accessToken);
      setRefreshTokenState(data.refreshToken);
      setRefreshInStorage(data.refreshToken);
    } catch {
      clearSession();
    }
  }

  // Écoute des tokens renouvelés par l’API (refresh automatique sur 401)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ accessToken: string; refreshToken: string }>).detail;
      if (detail?.accessToken != null && detail?.refreshToken != null) {
        setAccessTokenState(detail.accessToken);
        setRefreshTokenState(detail.refreshToken);
        setRefreshInStorage(detail.refreshToken);
      }
    };
    window.addEventListener(AUTH_TOKENS_EVENT, handler);
    return () => window.removeEventListener(AUTH_TOKENS_EVENT, handler);
  }, []);

  const value = useMemo(
    () => ({
      accessToken,
      refreshToken,
      setAccessToken,
      setTokens,
      logout,
      isAuthenticated: Boolean(accessToken)
    }),
    [accessToken, refreshToken, setAccessToken, setTokens, logout]
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
