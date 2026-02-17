"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { apiPost } from "./api";

const STORAGE_KEY = "fab.dev.access_token";
const IS_DEV_STORAGE = process.env.NODE_ENV !== "production";

type AuthContextValue = {
  accessToken: string | null;
  setAccessToken: (token: string | null) => void;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [accessToken, setAccessTokenState] = useState<string | null>(null);

  useEffect(() => {
    if (!IS_DEV_STORAGE) {
      return;
    }
    const storedToken = window.localStorage.getItem(STORAGE_KEY);
    if (storedToken) {
      setAccessTokenState(storedToken);
    }
  }, []);

  const setAccessToken = (token: string | null) => {
    setAccessTokenState(token);
    syncStorage(token);
  };

  const clearSession = () => {
    setAccessTokenState(null);
    syncStorage(null);
  };

  const logout = async () => {
    if (accessToken) {
      try {
        await apiPost<{ success: boolean }>("/auth/logout", { token: accessToken });
      } catch {
        // Logout must still clear local session even if API call fails.
      }
    }
    clearSession();
  };

  const value = useMemo(
    () => ({
      accessToken,
      setAccessToken,
      logout,
      isAuthenticated: Boolean(accessToken)
    }),
    [accessToken]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function syncStorage(token: string | null) {
    if (!IS_DEV_STORAGE) {
      return;
    }
    if (!token) {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, token);
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return ctx;
}
