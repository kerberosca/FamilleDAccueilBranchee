"use client";

import { createContext, useContext, useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api/v1";

type MaintenanceStatus = {
  enabled: boolean;
  updatedAt: string;
  updatedBy: string | null;
};

type MaintenanceContextValue = {
  maintenance: boolean | null;
};

const MaintenanceContext = createContext<MaintenanceContextValue | undefined>(undefined);

export function MaintenanceProvider({ children }: { children: React.ReactNode }) {
  const [maintenance, setMaintenance] = useState<boolean | null>(null);

  useEffect(() => {
    const url = `${API_BASE}/maintenance/status`;
    fetch(url, { cache: "no-store" })
      .then((res) => {
        if (res.status === 503) {
          setMaintenance(true);
          return undefined;
        }
        if (!res.ok) {
          setMaintenance(false);
          return undefined;
        }
        return res.json() as Promise<MaintenanceStatus>;
      })
      .then((data) => {
        if (data !== undefined && typeof data.enabled === "boolean") {
          setMaintenance(data.enabled);
        } else if (data === undefined) {
          // already set above (503 or !ok)
        } else {
          setMaintenance(false);
        }
      })
      .catch(() => {
        setMaintenance(false);
      });
  }, []);

  const value: MaintenanceContextValue = { maintenance };

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
