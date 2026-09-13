"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPost } from "../lib/api";
import { useAuth } from "../lib/auth-context";
import { Alert } from "./ui/alert";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import type { FamilySubscriptionSummary } from "../lib/family-readiness";

type FamilyOffer = {
  available: boolean;
  amount: number | null;
  currency: string;
  interval: "month";
  taxes: "UNCONFIRMED" | "AUTOMATIC" | "DISABLED";
  publicState: "PREPARATORY" | "OPEN";
  reason: string | null;
};

export type FamilySubscription = FamilySubscriptionSummary;

const STATUS_LABELS: Record<string, string> = {
  INACTIVE: "Aucun abonnement",
  INCOMPLETE: "Paiement à terminer",
  INCOMPLETE_EXPIRED: "Paiement expiré",
  TRIALING: "Actif",
  ACTIVE: "Actif",
  PAST_DUE: "Paiement en retard — accès premium suspendu",
  CANCELED: "Annulé",
  UNPAID: "Impayé — accès premium suspendu",
  PAUSED: "En pause",
  LEGACY: "Ancien abonnement à vérifier"
};

export function FamilyBillingCard({ compact = false }: { compact?: boolean }) {
  const { accessToken } = useAuth();
  const [offer, setOffer] = useState<FamilyOffer | null>(null);
  const [subscription, setSubscription] = useState<FamilySubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const [nextOffer, nextSubscription] = await Promise.all([
        apiGet<FamilyOffer>("/billing/family/offer", { token: accessToken }),
        apiGet<FamilySubscription>("/billing/family/subscription", { token: accessToken })
      ]);
      setOffer(nextOffer);
      setSubscription(nextSubscription);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "La facturation n'a pas pu être chargée.");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCheckout = async () => {
    if (!accessToken) return;
    setBusy(true);
    setError(null);
    try {
      const result = await apiPost<{ checkoutUrl: string }>("/billing/family/checkout-session", {
        token: accessToken
      });
      window.location.assign(result.checkoutUrl);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Le paiement sécurisé n'a pas pu être ouvert.");
      setBusy(false);
    }
  };

  const openPortal = async () => {
    if (!accessToken) return;
    setBusy(true);
    setError(null);
    try {
      const result = await apiPost<{ portalUrl: string }>("/billing/family/portal-session", {
        token: accessToken
      });
      window.location.assign(result.portalUrl);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Le portail Stripe n'a pas pu être ouvert.");
      setBusy(false);
    }
  };

  const hasCurrentSubscription = Boolean(
    subscription && !["INACTIVE", "INCOMPLETE_EXPIRED", "CANCELED", "LEGACY"].includes(subscription.status)
  );
  const isPreparatory = offer?.publicState === "PREPARATORY" && !offer.available;

  return (
    <Card className="space-y-3 border-[#4e4771] bg-[#171134]/75 backdrop-blur-sm">
      <div>
        <h2 className="text-lg font-medium text-white">
          {isPreparatory ? "Abonnement famille bientôt disponible" : "Abonnement famille"}
        </h2>
        {!compact ? (
          <p className="mt-1 text-sm text-slate-400">
            {isPreparatory
              ? "Votre compte préparatoire est prêt. Vous pouvez compléter votre profil et consulter un aperçu des alliés."
              : "L'abonnement donne accès aux coordonnées premium et à la messagerie avec les alliés."}
          </p>
        ) : null}
      </div>

      {loading ? <p className="text-sm text-slate-300">Chargement de l'abonnement…</p> : null}
      {error ? <Alert tone="error">{error}</Alert> : null}

      {!loading && subscription ? (
        <div className="space-y-1 text-sm text-slate-300">
          <p>
            <strong className="text-white">État :</strong> {STATUS_LABELS[subscription.status] ?? subscription.status}
          </p>
          {subscription.currentPeriodEnd ? (
            <p>
              {subscription.cancelAtPeriodEnd ? "Accès conservé jusqu'au" : "Période actuelle jusqu'au"} {" "}
              <strong className="text-white">{formatDate(subscription.currentPeriodEnd)}</strong>
            </p>
          ) : null}
          {subscription.needsAdminReview ? (
            <p className="text-amber-200">Cet ancien abonnement doit être vérifié par l'équipe FAB.</p>
          ) : null}
        </div>
      ) : null}

      {!loading && offer?.amount && (offer.available || offer.publicState === "OPEN") ? (
        <p className="text-sm text-slate-300">
          Offre mensuelle : <strong className="text-white">{formatMoney(offer.amount, offer.currency)} / mois</strong>
          {offer.taxes === "AUTOMATIC" ? ", taxes calculées au paiement" : ""}.
        </p>
      ) : null}

      {!loading && !hasCurrentSubscription && offer?.reason ? <Alert tone="info">{offer.reason}</Alert> : null}

      {!loading ? (
        <div className="flex flex-wrap gap-2">
          {!hasCurrentSubscription && offer?.available ? (
            <Button disabled={busy} onClick={() => void openCheckout()}>
              {busy ? "Ouverture…" : "S'abonner avec Stripe"}
            </Button>
          ) : null}
          {subscription?.canManage ? (
            <Button variant="secondary" disabled={busy} onClick={() => void openPortal()}>
              {busy ? "Ouverture…" : "Gérer la carte, les factures ou l'annulation"}
            </Button>
          ) : null}
          <Button variant="secondary" disabled={busy || loading} onClick={() => void load()}>
            Actualiser
          </Button>
        </div>
      ) : null}
    </Card>
  );
}

function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat("fr-CA", { style: "currency", currency }).format(amount / 100);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("fr-CA", { dateStyle: "long" }).format(new Date(value));
}
