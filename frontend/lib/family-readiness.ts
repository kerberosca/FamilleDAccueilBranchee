"use client";

import { useEffect, useState } from "react";
import { apiGet } from "./api";

export type FamilyReadinessState = "PREPARATORY" | "OPEN";

export function useFamilyReadiness() {
  const [state, setState] = useState<FamilyReadinessState>("PREPARATORY");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    void apiGet<{ state: FamilyReadinessState }>("/billing/family/readiness")
      .then((response) => {
        if (!ignore && response.state === "OPEN") {
          setState("OPEN");
        }
      })
      .catch(() => {
        // En cas d'indisponibilité, l'interface demeure prudemment en mode préparatoire.
      })
      .finally(() => {
        if (!ignore) {
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  return { state, loading, isOpen: state === "OPEN" };
}

export type FamilySubscriptionSummary = {
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  canManage: boolean;
  hasPremiumAccess: boolean;
  needsAdminReview: boolean;
};

