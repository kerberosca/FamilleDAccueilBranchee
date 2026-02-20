"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { apiPost } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";

type DevRole = "ADMIN" | "FAMILLE" | "RESSOURCE";

type DevLoginResponse = {
  accessToken: string;
  refreshToken: string;
  user: { id: string; role: string; email: string };
};

const ENABLED = process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH === "true";

export default function DevPage() {
  const router = useRouter();
  const { setTokens } = useAuth();
  const [loadingRole, setLoadingRole] = useState<DevRole | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loginAs = async (role: DevRole) => {
    setError(null);
    setLoadingRole(role);
    try {
      const response = await apiPost<DevLoginResponse>("/dev/login-as", { body: { role } });
      setTokens(response.accessToken, response.refreshToken);
      const nextPath = new URLSearchParams(window.location.search).get("next") || "/me";
      router.push(nextPath);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setLoadingRole(null);
    }
  };

  if (!ENABLED) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <h1 className="text-2xl font-semibold">/dev indisponible</h1>
        <Alert tone="info">Active `NEXT_PUBLIC_DEV_BYPASS_AUTH=true` pour utiliser cette page.</Alert>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Login dev rapide</h1>
      <Card>
        <p className="text-sm text-slate-300">Choisis un role pour appeler `POST /dev/login-as`.</p>

        <div className="mt-3 flex flex-wrap gap-3">
          {(["ADMIN", "FAMILLE", "RESSOURCE"] as DevRole[]).map((role) => (
            <Button key={role} onClick={() => loginAs(role)} disabled={loadingRole !== null}>
              {loadingRole === role ? `Connexion ${role}...` : `Login ${role}`}
            </Button>
          ))}
        </div>
      </Card>

      {error ? <Alert tone="error">{error}</Alert> : null}
    </main>
  );
}
