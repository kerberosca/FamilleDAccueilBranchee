"use client";

import { useState } from "react";
import { Alert } from "../../../components/ui/alert";
import { Button } from "../../../components/ui/button";
import { Card } from "../../../components/ui/card";
import { apiPost } from "../../../lib/api";
import { useAuth } from "../../../lib/auth-context";

type DevLoginResponse = {
  accessToken: string;
  refreshToken: string;
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
        body: { role: "ADMIN" }
      });
      setTokens(response.accessToken, response.refreshToken);
      setSuccess("Session ADMIN ouverte. Va sur /me ou commence la moderation.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto max-w-2xl space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Admin — Premiers pas</h1>

      <Card className="space-y-2">
        <p className="text-sm text-slate-300">
          L&apos;inscription publique ADMIN est desactivee cote backend. Le role admin doit etre provisionne en seed ou
          via un process interne.
        </p>
        {ENABLED ? (
          <Button onClick={loginAsAdmin} disabled={loading}>
            {loading ? "Connexion..." : "Login ADMIN (bypass dev)"}
          </Button>
        ) : (
          <Alert tone="info">Mode dev bypass desactive. Utilise un compte admin existant via /auth/login.</Alert>
        )}
      </Card>

      {success ? <Alert tone="info">{success}</Alert> : null}
      {error ? <Alert tone="error">{error}</Alert> : null}
    </main>
  );
}
