"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Alert } from "../../components/ui/alert";
import { Card } from "../../components/ui/card";
import { apiPost } from "../../lib/api";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [state, setState] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Vérification de votre adresse de connexion…");

  useEffect(() => {
    if (!token) {
      setState("error");
      setMessage("Le lien de vérification est incomplet.");
      return;
    }
    void apiPost<{ message: string }>("/auth/verify-email", { body: { token } })
      .then((response) => {
        setState("success");
        setMessage(response.message);
      })
      .catch((error) => {
        setState("error");
        setMessage(error instanceof Error ? error.message : "Le lien de vérification est invalide ou expiré.");
      });
  }, [token]);

  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <Card className="space-y-5 border-[#4e4771] bg-[#171134]/90 text-center">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">Sécurité du compte</p>
          <h1 className="mt-2 text-2xl font-semibold text-white">Vérification du courriel</h1>
        </div>
        <Alert tone={state === "error" ? "error" : "info"}>{message}</Alert>
        <p className="text-sm text-slate-300">
          {state === "success"
            ? "Vous pouvez maintenant poursuivre votre parcours FAB."
            : state === "error"
              ? "Connectez-vous à votre profil pour demander un nouveau lien."
              : "Veuillez patienter quelques secondes."}
        </p>
        <Link href={state === "success" ? "/me" : "/login"} className="inline-flex rounded-xl bg-[#3567b7] px-4 py-2.5 font-semibold text-white no-underline hover:bg-[#2f5da6]">
          {state === "success" ? "Ouvrir mon profil" : "Aller à la connexion"}
        </Link>
      </Card>
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-xl p-6"><Alert tone="info">Chargement…</Alert></main>}>
      <VerifyEmailContent />
    </Suspense>
  );
}
