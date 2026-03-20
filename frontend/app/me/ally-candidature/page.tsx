"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AllyOnboardingWizard } from "../../../components/ally-onboarding-wizard";
import { Alert } from "../../../components/ui/alert";
import { RequireAuth } from "../../../components/require-auth";
import { apiGet, apiPatch } from "../../../lib/api";
import { useAuth } from "../../../lib/auth-context";
import { parseAllyRegistrationFromApi } from "../../../lib/ally-registration";

type ResourceProfileResponse = {
  displayName: string;
  postalCode: string;
  city: string;
  region: string;
  contactPhone?: string | null;
  contactEmail?: string | null;
  allyType?: string | null;
  allyRegistration?: unknown;
};

type MeRole = { role: string };

export default function AllyCandidaturePage() {
  const { accessToken } = useAuth();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [profile, setProfile] = useState<ResourceProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const me = await apiGet<MeRole>("/users/me", { token: accessToken });
      setUserRole(me.role);
      if (me.role !== "RESOURCE") {
        setProfile(null);
        return;
      }
      const p = await apiGet<ResourceProfileResponse>("/profiles/me", { token: accessToken });
      setProfile(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="mx-auto max-w-2xl space-y-4 p-6">
      <RequireAuth>
        <p className="text-sm text-cyan-400/90">
          <Link href="/me" className="underline hover:text-cyan-300">
            ← Mon profil
          </Link>
        </p>
        <h1 className="text-2xl font-semibold text-white">Ma candidature allié répit</h1>
        <p className="text-sm text-slate-400">
          Mettez à jour les informations du formulaire officiel. Les déclarations devront être à nouveau acceptées
          intégralement.
        </p>

        {loading ? <p className="text-slate-400">Chargement…</p> : null}
        {error ? <Alert tone="error">{error}</Alert> : null}
        {success ? <Alert tone="info">{success}</Alert> : null}

        {!loading && userRole && userRole !== "RESOURCE" ? (
          <Alert tone="error">
            Cette page est réservée aux comptes allié.{" "}
            <Link href="/me" className="underline">
              Retour au profil
            </Link>
          </Alert>
        ) : null}

        {!loading && userRole === "RESOURCE" && profile ? (
          <AllyOnboardingWizard
            mode="update"
            initialRegistration={
              parseAllyRegistrationFromApi(profile.allyRegistration) ? profile.allyRegistration : undefined
            }
            initialDisplayName={profile.displayName}
            initialPostalCode={profile.postalCode}
            initialCity={profile.city}
            initialRegion={profile.region}
            initialContactPhone={profile.contactPhone ?? ""}
            initialAllyType={
              profile.allyType === "MENAGE" || profile.allyType === "GARDIENS" || profile.allyType === "AUTRES"
                ? profile.allyType
                : null
            }
            onUpdate={async (payload) => {
              if (!accessToken) return;
              setError(null);
              setSuccess(null);
              await apiPatch("/profiles/resource/me", {
                token: accessToken,
                body: {
                  displayName: payload.displayName,
                  postalCode: payload.postalCode,
                  city: payload.city,
                  region: payload.region,
                  contactPhone: payload.contactPhone,
                  allyRegistration: payload.allyRegistration
                }
              });
              setSuccess("Candidature mise à jour.");
              await load();
            }}
          />
        ) : null}

        {!loading && userRole === "RESOURCE" && !profile ? (
          <Alert tone="error">Profil allié introuvable.</Alert>
        ) : null}
      </RequireAuth>
    </main>
  );
}
