"use client";

import { FormEvent, useState } from "react";
import { Alert } from "../../../components/ui/alert";
import { Button } from "../../../components/ui/button";
import { Card } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { apiPost } from "../../../lib/api";
import { useAuth } from "../../../lib/auth-context";

type RegisterResponse = {
  accessToken: string;
  refreshToken: string;
  user: { id: string; role: string; email: string };
  nextStepForResource?: string | null;
};

type CheckoutResponse = {
  checkoutUrl: string;
  sessionId: string;
};

export default function ResourceOnboardingPage() {
  const { accessToken, setAccessToken } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [postalCode, setPostalCode] = useState("H2X1Y4");
  const [city, setCity] = useState("Montreal");
  const [region, setRegion] = useState("QC");
  const [bio, setBio] = useState("");
  const [tags, setTags] = useState("");
  const [loadingRegister, setLoadingRegister] = useState(false);
  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const onRegister = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setLoadingRegister(true);

    try {
      const response = await apiPost<RegisterResponse>("/auth/register", {
        body: {
          email,
          password,
          role: "RESOURCE",
          displayName,
          postalCode,
          city,
          region,
          bio: bio || undefined,
          tags: toTags(tags)
        }
      });
      setAccessToken(response.accessToken);
      setSuccess("Compte RESOURCE créé. Prochaine étape : paiement des frais d'inscription (Stripe).");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setLoadingRegister(false);
    }
  };

  const onCheckout = async () => {
    if (!accessToken) {
      setError("Token manquant. Inscris-toi d'abord.");
      return;
    }
    setError(null);
    setLoadingCheckout(true);
    try {
      const session = await apiPost<CheckoutResponse>("/billing/resource/checkout-session", {
        token: accessToken
      });
      window.location.href = session.checkoutUrl;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setLoadingCheckout(false);
    }
  };

  return (
    <main className="mx-auto max-w-2xl space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Inscription ressource</h1>

      <Card>
        <form className="grid gap-2" onSubmit={onRegister}>
          <Input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
          <Input
            placeholder="Mot de passe (8+)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            required
          />
          <Input placeholder="Nom affiche" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
          <Input placeholder="Code postal" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} required />
          <Input placeholder="Ville" value={city} onChange={(e) => setCity(e.target.value)} required />
          <Input placeholder="Region" value={region} onChange={(e) => setRegion(e.target.value)} required />
          <Input placeholder="Bio (optionnel)" value={bio} onChange={(e) => setBio(e.target.value)} />
          <Input placeholder="Tags CSV (optionnel)" value={tags} onChange={(e) => setTags(e.target.value)} />
          <Button type="submit" disabled={loadingRegister}>
            {loadingRegister ? "Creation..." : "Creer mon compte RESOURCE"}
          </Button>
        </form>
      </Card>

      <Card className="space-y-2">
        <p className="text-sm text-slate-300">
          Étape suivante : payer les frais d&apos;inscription ressource puis attendre la validation admin.
        </p>
        <Button type="button" onClick={onCheckout} disabled={loadingCheckout || !accessToken}>
          {loadingCheckout ? "Redirection…" : "Payer les frais d'inscription"}
        </Button>
      </Card>

      {success ? <Alert tone="info">{success}</Alert> : null}
      {error ? <Alert tone="error">{error}</Alert> : null}
    </main>
  );
}

function toTags(value: string): string[] | undefined {
  const tags = value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
  return tags.length > 0 ? tags : undefined;
}
