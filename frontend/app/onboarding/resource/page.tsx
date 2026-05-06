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
        allyRegistration: p.allyRegistration,
      },
    });
    setTokens(response.accessToken, response.refreshToken ?? null);
    setSuccess(
      "Candidature enregistrée. Votre profil est en attente de validation. Vous pouvez ensuite le modifier dans Mon profil."
    );
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
          <h1 className="text-2xl font-semibold sm:text-3xl">Devenir allié — inscription</h1>
          <p className="mt-2 text-sm text-[#ebe6ff] sm:text-base">
            Choisissez votre type d’allié : gardien compétent, entretien ménager ou tutorat.
          </p>
          <p className="mt-2 text-sm text-[#ebe6ff]">
            Voir la référence:{" "}
            <Link href="/formulaire-allie" className="font-medium text-[#b9ccff] underline hover:text-[#d3dfff]">
              formulaire de candidature FAB
            </Link>
            .
          </p>
        </section>

        {success ? (
          <Alert tone="info">
            {success}{" "}
            <Link href="/me" className="font-medium text-[#b9ccff] underline hover:text-[#d3dfff]">
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
      </div>
    </main>
  );
}
