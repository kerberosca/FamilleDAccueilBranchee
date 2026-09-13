"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { RequireAuth } from "../../../components/require-auth";
import { Alert } from "../../../components/ui/alert";
import { Card } from "../../../components/ui/card";
import { apiGet } from "../../../lib/api";
import { useAuth } from "../../../lib/auth-context";

type Subscription = { status: string };

export default function BillingSuccessPage() {
  const { accessToken } = useAuth();
  const [status, setStatus] = useState<string>("PENDING");
  const [attempts, setAttempts] = useState(0);

  const refresh = useCallback(async () => {
    if (!accessToken) return;
    try {
      const subscription = await apiGet<Subscription>("/billing/family/subscription", { token: accessToken });
      setStatus(subscription.status);
    } finally {
      setAttempts((value) => value + 1);
    }
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken || status === "ACTIVE" || attempts >= 15) return;
    const timer = window.setTimeout(() => void refresh(), attempts === 0 ? 0 : 2000);
    return () => window.clearTimeout(timer);
  }, [accessToken, attempts, refresh, status]);

  const confirmed = status === "ACTIVE" || status === "TRIALING";
  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <RequireAuth>
        <Card className="space-y-4 border-[#4e4771] bg-[#171134]/90 text-center">
          <h1 className="text-2xl font-semibold text-white">
            {confirmed ? "Abonnement confirmé" : "Confirmation du paiement en cours"}
          </h1>
          {confirmed ? (
            <Alert tone="info">Votre accès premium est maintenant actif.</Alert>
          ) : (
            <p className="text-sm text-slate-300">
              FAB attend la confirmation sécurisée de Stripe. Le retour du navigateur n'active jamais l'abonnement à
              lui seul.
            </p>
          )}
          <Link className="inline-flex rounded-md bg-cyan-700 px-4 py-2 text-sm font-medium text-white" href="/me">
            Voir mon abonnement
          </Link>
        </Card>
      </RequireAuth>
    </main>
  );
}
