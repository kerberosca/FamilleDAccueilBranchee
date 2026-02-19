"use client";

import { createContext, useContext, useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api/v1";

const MAINTENANCE_POLL_INTERVAL_MS = 60_000;
export const FAB_MAINTENANCE_503_EVENT = "fab-maintenance-503";

type MaintenanceStatus = {
  enabled: boolean;
  updatedAt: string;
  updatedBy: string | null;
};

type MaintenanceContextValue = {
  maintenance: boolean | null;
  /** Met à jour l’état maintenance immédiatement (ex. après toggle depuis la console admin). */
  updateMaintenance: (enabled: boolean) => void;
};

const MaintenanceContext = createContext<MaintenanceContextValue | undefined>(undefined);

function fetchMaintenanceStatus(): Promise<boolean> {
  const url = `${API_BASE}/maintenance/status`;
  return fetch(url, { cache: "no-store" })
    .then((res) => {
      if (res.status === 503) return true;
      if (!res.ok) return false;
      return res.json() as Promise<MaintenanceStatus>;
    })
    .then((data) => {
      if (typeof data === "boolean") return data;
      if (data !== undefined && typeof data.enabled === "boolean") return data.enabled;
      return false;
    })
    .catch(() => false);
}

export function MaintenanceProvider({ children }: { children: React.ReactNode }) {
  const [maintenance, setMaintenance] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    const apply = (enabled: boolean) => {
      if (!cancelled) setMaintenance(enabled);
    };

    fetchMaintenanceStatus().then(apply);

    const intervalId = setInterval(() => {
      fetchMaintenanceStatus().then(apply);
    }, MAINTENANCE_POLL_INTERVAL_MS);

    const onVisibility = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        fetchMaintenanceStatus().then(apply);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    const on503 = () => apply(true);
    window.addEventListener(FAB_MAINTENANCE_503_EVENT, on503);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener(FAB_MAINTENANCE_503_EVENT, on503);
    };
  }, []);

  const value: MaintenanceContextValue = {
    maintenance,
    updateMaintenance: setMaintenance
  };

  return (
    <MaintenanceContext.Provider value={value}>
      {children}
    </MaintenanceContext.Provider>
  );
}

export function useMaintenance() {
  const ctx = useContext(MaintenanceContext);
  if (!ctx) {
    throw new Error("useMaintenance must be used inside MaintenanceProvider");
  }
  return ctx;
}
