"use client";

import { useState } from "react";
import { Alert } from "../../../components/ui/alert";
import { Button } from "../../../components/ui/button";
import { Card } from "../../../components/ui/card";
import { apiPost } from "../../../lib/api";
import { useAuth } from "../../../lib/auth-context";

type DevLoginResponse = {
  accessToken: string;
  refreshToken?: string;
  user: { id: string; role: string; email: string };
};

const ENABLED = process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH === "true";

export default function AdminOnboardingPage() {
  const { setTokens } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loginAsAdmin = async () => {
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const response = await apiPost<DevLoginResponse>("/dev/login-as", {
        body: { role: "ADMIN" },
      });
      setTokens(response.accessToken, response.refreshToken ?? null);
      setSuccess("Session ADMIN ouverte. Allez sur /me ou commencez la modération.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setLoading(false);
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
          <h1 className="text-2xl font-semibold sm:text-3xl">Admin - Premiers pas</h1>
          <p className="mt-2 text-sm text-[#ebe6ff] sm:text-base">
            L’inscription publique ADMIN est désactivée. Utilisez un compte provisionné ou le contournement dev.
          </p>
        </section>

        <Card className="space-y-3 border-[#4e4771] bg-[#171134]/75 backdrop-blur-sm">
          {ENABLED ? (
            <Button
              onClick={loginAsAdmin}
              disabled={loading}
              className="!rounded-xl !bg-[#3567b7] !font-semibold hover:!bg-[#2f5da6]"
            >
              {loading ? "Connexion…" : "Connexion ADMIN (contournement dev)"}
            </Button>
          ) : (
            <Alert tone="info">
              Contournement dev désactivé. Utilisez un compte administrateur existant via la page de connexion.
            </Alert>
          )}
        </Card>

        {success ? <Alert tone="info">{success}</Alert> : null}
        {error ? <Alert tone="error">{error}</Alert> : null}
      </div>
    </main>
  );
}
