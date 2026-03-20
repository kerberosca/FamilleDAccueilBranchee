"use client";

import Link from "next/link";
import { useState } from "react";
import { AllyOnboardingWizard, AllyRegisterSubmitPayload } from "../../../components/ally-onboarding-wizard";
import { Alert } from "../../../components/ui/alert";
import { apiPost } from "../../../lib/api";
import { useAuth } from "../../../lib/auth-context";

type RegisterResponse = {
  accessToken: string;
  refreshToken?: string;
  user: { id: string; role: string; email: string };
};

export default function ResourceOnboardingPage() {
  const { setTokens } = useAuth();
  const [success, setSuccess] = useState<string | null>(null);

  const handleRegister = async (p: AllyRegisterSubmitPayload) => {
    const response = await apiPost<RegisterResponse>("/auth/register", {
      body: {
        email: p.email,
        password: p.password,
        role: "RESOURCE",
        allyType: p.allyType,
        displayName: p.displayName,
        postalCode: p.postalCode,
        city: p.city,
        region: p.region,
        contactPhone: p.contactPhone,
        allyRegistration: p.allyRegistration
      }
    });
    setTokens(response.accessToken, response.refreshToken);
    setSuccess(
      "Candidature enregistrée. Votre profil est en attente de validation. Vous pouvez compléter ou modifier des détails depuis « Mon profil »."
    );
  };

  return (
    <main className="mx-auto max-w-2xl space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Devenir allié — inscription</h1>
      <p className="text-sm text-slate-400">
        Parcours guidé aligné sur le{" "}
        <Link href="/formulaire-allie-repit" className="text-cyan-400 underline">
          formulaire de candidature répit
        </Link>
        . Besoin d&apos;aide ? Consultez aussi la page{" "}
        <Link href="/devenir-allie" className="text-cyan-400 underline">
          Devenir allié
        </Link>
        .
      </p>

      {success ? (
        <Alert tone="info">
          {success}{" "}
          <Link href="/me" className="font-medium text-cyan-300 underline">
            Ouvrir mon profil
          </Link>
        </Alert>
      ) : (
        <AllyOnboardingWizard
          mode="register"
          onRegister={async (p) => {
            await handleRegister(p);
          }}
        />
      )}
    </main>
  );
}
