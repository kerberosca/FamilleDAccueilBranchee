"use client";

import Link from "next/link";
import { Card } from "../../components/ui/card";

const PATHS = [
  {
    title: "Famille",
    description: "Créer un compte FAMILY puis activer l'abonnement.",
    href: "/onboarding/family",
    badgeClass: "bg-[#f17d55]",
  },
  {
    title: "Allié",
    description: "Parcours guidé pour gardien compétent, entretien ménage ou tutorat.",
    href: "/onboarding/resource",
    badgeClass: "bg-[#62beab]",
  },
  {
    title: "Admin",
    description:
      "Compte interne uniquement. Accès via compte seed ou contournement dev selon l’environnement.",
    href: "/onboarding/admin",
    badgeClass: "bg-[#7f59db]",
  },
];

export default function OnboardingPage() {
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

      <div className="mx-auto max-w-6xl space-y-5">
        <section className="rounded-[24px] border border-white/20 bg-gradient-to-r from-[#22184f]/85 via-[#261d57]/78 to-[#2e2462]/74 p-6 text-white shadow-[0_20px_52px_-38px_rgba(8,6,26,0.95)]">
          <h1 className="text-2xl font-semibold sm:text-3xl">Premiers pas</h1>
          <p className="mt-2 text-sm text-[#ebe6ff] sm:text-base">
            Choisissez le parcours correspondant à votre rôle.
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {PATHS.map((item, index) => (
            <Card key={item.title} className="border-[#4e4771] bg-[#171134]/75 backdrop-blur-sm">
              <span
                className={`inline-flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold text-white ${item.badgeClass}`}
              >
                {index + 1}
              </span>
              <h2 className="mt-3 text-lg font-semibold text-white">{item.title}</h2>
              <p className="mt-2 text-sm text-slate-300">{item.description}</p>
              <Link
                className="mt-4 inline-flex rounded-xl border border-[#6f8fe2]/45 bg-[#1d1840] px-4 py-2 text-sm font-medium text-[#b9ccff] no-underline hover:bg-[#292358] hover:text-[#d4dfff]"
                href={item.href}
              >
                Commencer
              </Link>
            </Card>
          ))}
        </section>
      </div>
    </main>
  );
}
