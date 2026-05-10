"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Alert } from "../../../components/ui/alert";
import { Button } from "../../../components/ui/button";
import { Card } from "../../../components/ui/card";
import { ApiError, apiGet } from "../../../lib/api";
import { useAuth } from "../../../lib/auth-context";

type ResourceDetail = {
  id: string;
  displayName: string;
  city: string;
  region: string;
  postalCode: string;
  skillsTags: string[];
  hourlyRate?: number | string | null;
  averageRating?: number | string | null;
  bio?: string | null;
  verificationStatus: string;
  publishStatus: string;
  canContact?: boolean;
  contactEmail?: string | null;
  contactPhone?: string | null;
};

export default function ResourceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { accessToken, isAuthenticated, isAuthLoading } = useAuth();
  const resourceId = typeof params.id === "string" ? params.id : "";
  const [resource, setResource] = useState<ResourceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthLoading) {
      setLoading(true);
      return;
    }

    if (!resourceId) {
      setLoading(false);
      setError("Identifiant allié manquant.");
      return;
    }

    let ignore = false;

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiGet<ResourceDetail>(`/profiles/resource/${resourceId}`, { token: accessToken ?? undefined });
        if (ignore) return;
        setResource(data);
      } catch (e) {
        if (ignore) return;
        if (e instanceof ApiError && e.statusCode === 404) {
          setError("Profil non disponible.");
        } else {
          setError(e instanceof Error ? e.message : "Allié introuvable.");
        }
      } finally {
        if (ignore) return;
        setLoading(false);
      }
    };
    void run();

    return () => {
      ignore = true;
    };
  }, [resourceId, accessToken, isAuthLoading]);

  const handleContact = () => {
    if (!isAuthenticated) {
      router.push(`/login?next=${encodeURIComponent(`/resource/${resourceId}`)}`);
      return;
    }
    router.push(`/messages?contact=${resourceId}`);
  };

  if (loading) {
    return (
      <main className="mx-auto max-w-2xl space-y-4 p-6">
        <Alert tone="info">Chargement du profil...</Alert>
      </main>
    );
  }

  if (error || !resource) {
    return (
      <main className="mx-auto max-w-2xl space-y-4 p-6">
        <Alert tone="error">{error ?? "Profil non disponible."}</Alert>
        <Button variant="secondary" onClick={() => router.push("/search")}>
          Retour à la recherche
        </Button>
      </main>
    );
  }

  const hasContact = Boolean(resource.contactEmail ?? resource.contactPhone);
  const canContact = Boolean(resource.canContact);

  return (
    <main className="mx-auto max-w-2xl space-y-4 p-6">
      <Button variant="secondary" onClick={() => router.back()}>
        ← Retour
      </Button>

      <Card className="space-y-4">
        <h1 className="text-2xl font-semibold">{resource.displayName}</h1>
        <p className="text-sm text-slate-300">
          {resource.city}, {resource.region} ({resource.postalCode})
        </p>
        {resource.skillsTags?.length ? (
          <p className="text-sm">
            <strong>Compétences :</strong> {resource.skillsTags.join(", ")}
          </p>
        ) : null}
        {resource.hourlyRate != null ? (
          <p className="text-sm">
            <strong>Tarif horaire :</strong> {String(resource.hourlyRate)} $
          </p>
        ) : null}
        {resource.bio ? <p className="text-sm text-slate-200">{resource.bio}</p> : null}

        {hasContact ? (
          <div className="space-y-1 text-sm">
            {resource.contactEmail ? <p>Email : {resource.contactEmail}</p> : null}
            {resource.contactPhone ? <p>Tél : {resource.contactPhone}</p> : null}
          </div>
        ) : (
          <Alert tone="info">Coordonnées visibles avec un abonnement famille actif.</Alert>
        )}

        {!isAuthenticated ? (
          <div className="pt-2">
            <Button onClick={handleContact}>Se connecter pour contacter</Button>
          </div>
        ) : canContact ? (
          <div className="pt-2">
            <Button onClick={handleContact}>Contacter cet allié</Button>
          </div>
        ) : (
          <Alert tone="info">Activez un abonnement famille pour contacter cet allié.</Alert>
        )}
      </Card>
    </main>
  );
}
