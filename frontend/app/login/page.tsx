"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { ApiError, apiPost } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";

type LoginResponse = {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; role: string };
};

const DEV_BYPASS = process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH === "true";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/me";
  const { setTokens } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiPost<LoginResponse>("/auth/login", {
        body: { email: email.trim(), password }
      });
      setTokens(res.accessToken, res.refreshToken);
      router.push(next);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message || "Connexion impossible."
          : err instanceof Error
            ? err.message
            : "Connexion impossible.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto max-w-md space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Connexion</h1>
      <Card>
        <form onSubmit={onSubmit} className="grid gap-3">
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            type="password"
            placeholder="Mot de passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
          <Button type="submit" disabled={loading}>
            {loading ? "Connexion..." : "Se connecter"}
          </Button>
        </form>
      </Card>
      {error ? <Alert tone="error">{error}</Alert> : null}
      {DEV_BYPASS ? (
        <p className="text-sm text-slate-400">
          <Link href="/dev" className="text-cyan-400 hover:underline">
            Mode dev (bypass login)
          </Link>
        </p>
      ) : null}
      <p className="text-sm text-slate-400">
        <Link href="/onboarding" className="text-cyan-400 hover:underline">
          Créer un compte
        </Link>
      </p>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-md p-6"><p className="text-slate-400">Chargement...</p></main>}>
      <LoginForm />
    </Suspense>
  );
}
