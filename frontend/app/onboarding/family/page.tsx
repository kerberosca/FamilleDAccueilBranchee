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

type RegisterResponse = {
  accessToken: string;
  refreshToken?: string;
  user: { id: string; role: string; email: string };
};

type CheckoutResponse = {
  checkoutUrl: string;
  sessionId: string;
};

export default function FamilyOnboardingPage() {
  const { accessToken, setTokens } = useAuth();
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
  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const onRegister = async (event: FormEvent) => {
    event.preventDefault();
    if (!acceptPolicy) {
      setError(
        "Vous devez accepter la Politique de confidentialité et le traitement de vos données pour vous inscrire."
      );
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
          role: "FAMILY",
          displayName,
          postalCode,
          city,
          region,
          bio: bio || undefined,
          tags: toTags(tags),
        },
      });
      setTokens(response.accessToken, response.refreshToken ?? null);
      setSuccess("Compte FAMILY créé. Vous pouvez maintenant lancer le paiement d’abonnement.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setLoadingRegister(false);
    }
  };

  const onCheckout = async () => {
    if (!accessToken) {
      setError("Session introuvable. Inscrivez-vous d’abord.");
      return;
    }
    setError(null);
    setLoadingCheckout(true);
    try {
      const session = await apiPost<CheckoutResponse>("/billing/family/checkout-session", {
        token: accessToken,
      });
      window.location.href = session.checkoutUrl;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setLoadingCheckout(false);
    }
  };

  return (
    <main className="relative isolate overflow-hidden px-4 pb-16 pt-8 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(980px 420px at -10% -8%, rgba(242,157,82,0.18), transparent), radial-gradient(760px 360px at 108% 4%, rgba(118,106,204,0.24), transparent), linear-gradient(180deg, #130e2d 0%, #100c26 60%, #0d0a1f 100%)",
          }}
          aria-hidden
        />
      </div>

      <div className="mx-auto max-w-3xl space-y-4">
        <section className="rounded-[24px] border border-white/20 bg-gradient-to-r from-[#22184f]/85 via-[#261d57]/78 to-[#2e2462]/74 p-6 text-white shadow-[0_20px_52px_-38px_rgba(8,6,26,0.95)]">
          <h1 className="text-2xl font-semibold sm:text-3xl">Inscription famille</h1>
          <p className="mt-2 text-sm text-[#ebe6ff] sm:text-base">
            Créez votre espace puis activez l'abonnement pour contacter les alliés.
          </p>
        </section>

        <p className="text-sm text-slate-200">
          Vos données seront enregistrées pour la mise en relation. Vous pourrez supprimer votre compte depuis « Mon
          profil ». Consultez notre{" "}
          <Link href="/confidentialite" className="font-medium text-[#b9ccff] underline hover:text-[#d3dfff]">
            Politique de confidentialité
          </Link>
          .
        </p>

        <Card className="border-[#4e4771] bg-[#171134]/75 backdrop-blur-sm">
          <form className="grid gap-3" onSubmit={onRegister}>
            <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={acceptPolicy}
                onChange={(e) => setAcceptPolicy(e.target.checked)}
                className="mt-0.5 rounded border-[#5e567f] bg-[#0f0b24] text-[#6f8fe2]"
              />
              <span>
                J’ai lu la Politique de confidentialité et j’accepte le traitement de mes données pour la mise en
                relation.
              </span>
            </label>

            <Input
              placeholder="Courriel"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              required
              className="!border-[#4f476f] !bg-[#0f0b24] !text-white placeholder:!text-[#8b84ad] focus:!border-[#6f8fe2] focus:!ring-[#6f8fe2]/35"
            />
            <Input
              placeholder="Mot de passe (8 caractères min., majuscule, chiffre, caractère spécial)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              required
              minLength={8}
              className="!border-[#4f476f] !bg-[#0f0b24] !text-white placeholder:!text-[#8b84ad] focus:!border-[#6f8fe2] focus:!ring-[#6f8fe2]/35"
            />
            <PasswordStrength password={password} />
            <Input
              placeholder="Nom affiché"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              className="!border-[#4f476f] !bg-[#0f0b24] !text-white placeholder:!text-[#8b84ad] focus:!border-[#6f8fe2] focus:!ring-[#6f8fe2]/35"
            />
            <Input
              placeholder="Code postal"
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
              required
              className="!border-[#4f476f] !bg-[#0f0b24] !text-white placeholder:!text-[#8b84ad] focus:!border-[#6f8fe2] focus:!ring-[#6f8fe2]/35"
            />
            <Input
              placeholder="Ville"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              required
              className="!border-[#4f476f] !bg-[#0f0b24] !text-white placeholder:!text-[#8b84ad] focus:!border-[#6f8fe2] focus:!ring-[#6f8fe2]/35"
            />
            <Input
              placeholder="Région"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              required
              className="!border-[#4f476f] !bg-[#0f0b24] !text-white placeholder:!text-[#8b84ad] focus:!border-[#6f8fe2] focus:!ring-[#6f8fe2]/35"
            />
            <Input
              placeholder="Biographie (optionnel)"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="!border-[#4f476f] !bg-[#0f0b24] !text-white placeholder:!text-[#8b84ad] focus:!border-[#6f8fe2] focus:!ring-[#6f8fe2]/35"
            />
            <Input
              placeholder="Étiquettes, séparées par des virgules (optionnel)"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="!border-[#4f476f] !bg-[#0f0b24] !text-white placeholder:!text-[#8b84ad] focus:!border-[#6f8fe2] focus:!ring-[#6f8fe2]/35"
            />
            <Button
              type="submit"
              disabled={loadingRegister || !acceptPolicy}
              className="!rounded-xl !bg-[#3567b7] !font-semibold hover:!bg-[#2f5da6]"
            >
              {loadingRegister ? "Création…" : "Créer mon compte FAMILY"}
            </Button>
          </form>
        </Card>

        <Card className="space-y-2 border-[#4e4771] bg-[#171134]/75 backdrop-blur-sm">
          <p className="text-sm text-slate-300">Étape suivante : activer l’abonnement FAMILY via Stripe.</p>
          <Button
            type="button"
            onClick={onCheckout}
            disabled={loadingCheckout || !accessToken}
            className="!rounded-xl !bg-[#3567b7] !font-semibold hover:!bg-[#2f5da6]"
          >
            {loadingCheckout ? "Redirection…" : "Activer l’abonnement FAMILY"}
          </Button>
        </Card>

        {success ? <Alert tone="info">{success}</Alert> : null}
        {error ? <Alert tone="error">{error}</Alert> : null}
      </div>
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
