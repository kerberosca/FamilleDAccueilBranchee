"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { PasswordStrength } from "../../components/ui/password-strength";
import { ApiError, apiPost } from "../../lib/api";

type ResetPasswordResponse = { success?: boolean; message?: string };

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    if (!token) {
      setError("Lien invalide : token manquant.");
      return;
    }
    setLoading(true);
    try {
      await apiPost<ResetPasswordResponse>("/auth/reset-password", {
        body: { token, newPassword: password }
      });
      setSuccess(true);
      setTimeout(() => router.push("/login"), 2000);
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

  if (!token) {
    return (
      <main className="mx-auto max-w-md space-y-4 p-6">
        <h1 className="text-2xl font-semibold">Réinitialiser le mot de passe</h1>
        <Alert tone="error">Lien invalide : token manquant. Demandez un nouveau lien depuis la page « Mot de passe oublié ».</Alert>
        <p className="text-sm text-slate-400">
          <Link href="/forgot-password" className="text-cyan-400 hover:underline">
            Mot de passe oublié
          </Link>
          {" · "}
          <Link href="/login" className="text-cyan-400 hover:underline">
            Connexion
          </Link>
        </p>
      </main>
    );
  }

  if (success) {
    return (
      <main className="mx-auto max-w-md space-y-4 p-6">
        <h1 className="text-2xl font-semibold">Mot de passe mis à jour</h1>
        <Alert tone="info">Votre mot de passe a été réinitialisé. Redirection vers la connexion...</Alert>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Nouveau mot de passe</h1>
      <Card>
        <form onSubmit={onSubmit} className="grid gap-3">
          <Input
            type="password"
            placeholder="Nouveau mot de passe (8 car. min, majuscule, chiffre, spécial)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />
          <PasswordStrength password={password} />
          <Input
            type="password"
            placeholder="Confirmer le mot de passe"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />
          <Button type="submit" disabled={loading}>
            {loading ? "Enregistrement..." : "Réinitialiser le mot de passe"}
          </Button>
        </form>
      </Card>
      {error ? <Alert tone="error">{error}</Alert> : null}
      <p className="text-sm text-slate-400">
        <Link href="/login" className="text-cyan-400 hover:underline">
          Retour à la connexion
        </Link>
      </p>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-md p-6">
          <p className="text-slate-400">Chargement...</p>
        </main>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
