"use client";

import Link from "next/link";
import { Card } from "../../components/ui/card";

export default function OnboardingPage() {
  return (
    <main className="mx-auto max-w-4xl space-y-5 p-6">
      <h1 className="text-2xl font-semibold">Premiers pas</h1>
      <p className="text-sm text-slate-300">Choisis le parcours correspondant à ton rôle.</p>

      <section className="grid gap-3 md:grid-cols-3">
        <Card>
          <h2 className="text-lg font-semibold">Famille</h2>
          <p className="mt-2 text-sm text-slate-300">Créer un compte FAMILY puis activer l&apos;abonnement.</p>
          <Link className="mt-3 inline-block" href="/onboarding/family">
            Commencer
          </Link>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold">Ressource</h2>
          <p className="mt-2 text-sm text-slate-300">Créer un compte RESOURCE puis payer les frais d&apos;inscription (Stripe).</p>
          <Link className="mt-3 inline-block" href="/onboarding/resource">
            Commencer
          </Link>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold">Admin</h2>
          <p className="mt-2 text-sm text-slate-300">
            Le rôle ADMIN n&apos;est pas auto-inscriptible. Utilise le compte seed ou le bypass dev.
          </p>
          <Link className="mt-3 inline-block" href="/onboarding/admin">
            Voir options
          </Link>
        </Card>
      </section>
    </main>
  );
}
