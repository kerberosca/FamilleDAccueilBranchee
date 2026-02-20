"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { ApiError, apiPost } from "../../lib/api";

type RequestResetResponse = { message?: string };

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const res = await apiPost<RequestResetResponse>("/auth/request-password-reset", {
        body: { email: email.trim() }
      });
      setSuccess(res.message ?? "Si cet email est connu, un lien a été envoyé.");
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message || "Une erreur est survenue."
          : err instanceof Error
            ? err.message
            : "Une erreur est survenue.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto max-w-md space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Mot de passe oublié</h1>
      <Card>
        <form onSubmit={onSubmit} className="grid gap-3">
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Button type="submit" disabled={loading}>
            {loading ? "Envoi..." : "Envoyer le lien"}
          </Button>
        </form>
      </Card>
      {error ? <Alert tone="error">{error}</Alert> : null}
      {success ? <Alert tone="info">{success}</Alert> : null}
      <p className="text-sm text-slate-400">
        <Link href="/login" className="text-cyan-400 hover:underline">
          Retour à la connexion
        </Link>
      </p>
    </main>
  );
}
