"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "fab.dev_ui";
const DEV_UI_ENABLED = process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH === "true";

type DevModeValue = {
  isDevMode: boolean;
  setDevMode: (value: boolean) => void;
};

const DevModeContext = createContext<DevModeValue | undefined>(undefined);

export function DevModeProvider({ children }: { children: React.ReactNode }) {
  const [isDevMode, setState] = useState(false);

  useEffect(() => {
    if (!DEV_UI_ENABLED) {
      window.localStorage.removeItem(STORAGE_KEY);
      setState(false);
      return;
    }
    setState(window.localStorage.getItem(STORAGE_KEY) === "1");
  }, []);

  const setDevMode = useCallback((value: boolean) => {
    if (!DEV_UI_ENABLED) {
      setState(false);
      return;
    }
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
    }
    setState(value);
  }, []);

  const value = useMemo(() => ({ isDevMode, setDevMode }), [isDevMode, setDevMode]);

  return <DevModeContext.Provider value={value}>{children}</DevModeContext.Provider>;
}

export function useDevMode(): DevModeValue {
  const ctx = useContext(DevModeContext);
  if (ctx == null) {
    throw new Error("useDevMode must be used within DevModeProvider");
  }
  return ctx;
}
