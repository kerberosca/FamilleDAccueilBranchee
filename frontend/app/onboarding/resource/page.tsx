"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { Alert } from "../../../components/ui/alert";
import { Button } from "../../../components/ui/button";
import { Card } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { PasswordStrength } from "../../../components/ui/password-strength";
import { apiPost } from "../../../lib/api";
import { useAuth } from "../../../lib/auth-context";

type AllyType = "MENAGE" | "GARDIENS" | "AUTRES";

const ALLY_TYPE_OPTIONS: { value: AllyType; label: string }[] = [
  { value: "MENAGE", label: "Ménage" },
  { value: "GARDIENS", label: "Gardiens" },
  { value: "AUTRES", label: "Autres" }
];

type RegisterResponse = {
  accessToken: string;
  refreshToken?: string;
  user: { id: string; role: string; email: string };
  nextStepForResource?: string | null;
};

export default function ResourceOnboardingPage() {
  const { setTokens } = useAuth();
  const [allyType, setAllyType] = useState<AllyType | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [postalCode, setPostalCode] = useState("H2X1Y4");
  const [city, setCity] = useState("Montreal");
  const [region, setRegion] = useState("QC");
  const [bio, setBio] = useState("");
  const [tags, setTags] = useState("");
  const [acceptPolicy, setAcceptPolicy] = useState(false);
  const [loadingRegister, setLoadingRegister] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const onRegister = async (event: FormEvent) => {
    event.preventDefault();
    if (!acceptPolicy) {
      setError("Vous devez accepter la Politique de confidentialité et le traitement de vos données pour vous inscrire.");
      return;
    }
    if (!allyType) {
      setError("Veuillez choisir un type (Ménage, Gardiens ou Autres).");
      return;
    }
    setError(null);
    setSuccess(null);
    setLoadingRegister(true);

    try {
      const response = await apiPost<RegisterResponse>("/auth/register", {
        body: {
          email,
          password,
          role: "RESOURCE",
          allyType,
          displayName,
          postalCode,
          city,
          region,
          bio: bio || undefined,
          tags: toTags(tags)
        }
      });
      setTokens(response.accessToken, response.refreshToken);
      setSuccess("Compte allié créé. Vous pouvez compléter votre profil et attendre la validation.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setLoadingRegister(false);
    }
  };

  return (
    <main className="mx-auto max-w-2xl space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Inscription allié</h1>

      <p className="text-sm text-slate-300">
        Vos données seront enregistrées dans notre base et votre profil pourra être publié dans le répertoire pour permettre la mise en relation avec les familles. Vous pourrez supprimer votre compte à tout moment depuis « Mon profil ». Consultez notre{" "}
        <Link href="/confidentialite" className="text-cyan-400 underline hover:text-cyan-300">
          Politique de confidentialité
        </Link>
        .
      </p>

      <Card>
        <form className="grid gap-2" onSubmit={onRegister}>
          <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={acceptPolicy}
              onChange={(e) => setAcceptPolicy(e.target.checked)}
              className="mt-0.5 rounded border-slate-600 bg-slate-800 text-cyan-500"
            />
            <span>
              J&apos;ai lu la Politique de confidentialité et j&apos;accepte que mes données soient traitées et que mon profil soit publié dans le répertoire.
            </span>
          </label>
          <p className="text-sm text-slate-300">Choisissez votre type :</p>
          <div className="flex flex-wrap gap-2">
            {ALLY_TYPE_OPTIONS.map(({ value, label }) => (
              <Button
                key={value}
                type="button"
                variant={allyType === value ? "primary" : "secondary"}
                onClick={() => setAllyType(value)}
                className={allyType === value ? "ring-2 ring-cyan-400" : ""}
              >
                {label}
              </Button>
            ))}
          </div>
          {!allyType ? (
            <p className="text-sm text-amber-400">Un type est obligatoire pour créer un compte allié.</p>
          ) : null}
          <Input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
          <Input
            placeholder="Mot de passe (8 caractères min, majuscule, chiffre, spécial)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            required
            minLength={8}
          />
          <PasswordStrength password={password} />
          <Input placeholder="Nom affiche" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
          <Input placeholder="Code postal" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} required />
          <Input placeholder="Ville" value={city} onChange={(e) => setCity(e.target.value)} required />
          <Input placeholder="Region" value={region} onChange={(e) => setRegion(e.target.value)} required />
          <Input placeholder="Bio (optionnel)" value={bio} onChange={(e) => setBio(e.target.value)} />
          <Input placeholder="Tags CSV (optionnel)" value={tags} onChange={(e) => setTags(e.target.value)} />
          <Button type="submit" disabled={loadingRegister || !allyType || !acceptPolicy}>
            {loadingRegister ? "Création…" : "Créer mon compte allié"}
          </Button>
        </form>
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
