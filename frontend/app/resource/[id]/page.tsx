"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Alert } from "../../../components/ui/alert";
import { Button } from "../../../components/ui/button";
import { Card } from "../../../components/ui/card";
import { apiGet } from "../../../lib/api";
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
  contactEmail?: string | null;
  contactPhone?: string | null;
};

export default function ResourceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { accessToken, isAuthenticated } = useAuth();
  const resourceId = typeof params.id === "string" ? params.id : "";
  const [resource, setResource] = useState<ResourceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!resourceId) {
      setLoading(false);
      setError("Identifiant ressource manquant.");
      return;
    }
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiGet<ResourceDetail>(`/profiles/resource/${resourceId}`, { token: accessToken ?? undefined });
        setResource(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Ressource introuvable.");
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [resourceId, accessToken]);

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
        <Alert tone="error">{error ?? "Ressource introuvable."}</Alert>
        <Button variant="secondary" onClick={() => router.push("/search")}>
          Retour à la recherche
        </Button>
      </main>
    );
  }

  const hasContact = Boolean(resource.contactEmail ?? resource.contactPhone);

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

        <div className="pt-2">
          <Button onClick={handleContact}>
            {isAuthenticated ? "Contacter cette ressource" : "Se connecter pour contacter"}
          </Button>
        </div>
      </Card>
    </main>
  );
}
