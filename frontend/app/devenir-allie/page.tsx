"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Card } from "../../components/ui/card";

const TYPES = [
  {
    title: "Gardien compétent",
    description: "Présence fiable auprès des enfants, avec une approche rassurante et responsable.",
    icon: "G",
    image: "/images/Gardiens compétant.png",
  },
  {
    title: "Entretien Ménage",
    description: "Aide concrète pour l'entretien du foyer, les tâches courantes et l'organisation du quotidien.",
    icon: "M",
    image: "/images/Entretien Ménage.png",
  },
  {
    title: "Tutorat",
    description: "Accompagnement scolaire, devoirs, motivation et confiance dans les apprentissages.",
    icon: "T",
    image: "/images/Tutorat.png",
  },
];

const STEPS = [
  "Choisissez votre type d'allié: gardien compétent, entretien ménage ou tutorat.",
  "Renseignez vos compétences, votre offre de service et les déclarations légales.",
  "Après validation, votre profil devient visible pour les familles.",
  "Les familles vous contactent selon leurs besoins; l'entente financière se fait directement.",
];

function TypeIcon({ item }: { item: { title: string; icon: string; image?: string } }) {
  const [imageError, setImageError] = useState(false);
  if (item.image && !imageError) {
    return (
      <div className="relative h-24 w-full overflow-hidden rounded-[22px] bg-white">
        <Image
          src={item.image}
          alt={item.title}
          fill
          className="object-contain object-center"
          onError={() => setImageError(true)}
          unoptimized
        />
      </div>
    );
  }
  return <div className="text-3xl">{item.icon}</div>;
}

export default function DevenirAlliePage() {
  return (
    <main className="relative isolate overflow-hidden px-4 pb-20 pt-8 sm:px-6 lg:px-8">
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

      <div className="mx-auto max-w-6xl space-y-10">
        <section className="relative overflow-hidden rounded-[30px] border border-white/20 shadow-[0_24px_58px_-42px_rgba(8,6,26,0.95)]">
          <Image
            src="/images/bottom-fab.png"
            alt="Mains et halo lumineux"
            fill
            className="object-cover"
            unoptimized
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#18113a]/92 via-[#20154a]/84 to-[#25184a]/74" aria-hidden />

          <div className="relative px-6 py-10 sm:px-8 sm:py-12 text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#f8e6cf]">Allié recherché</p>
            <h1 className="mt-3 text-3xl font-semibold text-white sm:text-5xl">Qu'est-ce qu'un allié ?</h1>
            <p className="mx-auto mt-4 max-w-3xl text-sm text-[#ebe6ff] sm:text-base">
              Les alliés FAB offrent un soutien concret aux familles d'accueil selon trois rôles clairs: gardien
              compétent, entretien ménage ou tutorat. Ils mettent leurs compétences au service des familles près de chez
              elles.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-center text-2xl font-semibold text-white sm:text-3xl">Trois types d'alliés</h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-slate-300">Choisissez celui qui correspond à ce que vous proposez.</p>
          <div className="mt-7 grid gap-4 sm:grid-cols-3">
            {TYPES.map((item) => (
              <Card key={item.title} className="border-[#4e4771] bg-[#171134]/75 backdrop-blur-sm">
                <TypeIcon item={item} />
                <h3 className="sr-only">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">{item.description}</p>
              </Card>
            ))}
          </div>
        </section>

        <section className="rounded-[24px] border border-[#4e4771] bg-[#171134]/75 p-6 backdrop-blur-sm sm:p-8">
          <h2 className="text-center text-2xl font-semibold text-white sm:text-3xl">Du profil à la mise en relation</h2>
          <ul className="mx-auto mt-7 max-w-3xl space-y-3">
            {STEPS.map((step, i) => (
              <li key={i} className="flex items-start gap-3 text-slate-200">
                <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#3567b7] text-xs font-semibold text-white">
                  {i + 1}
                </span>
                <span className="text-sm sm:text-base">{step}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-[28px] border border-white/20 bg-gradient-to-r from-[#22184f]/85 via-[#261d57]/78 to-[#2e2462]/74 p-6 text-center shadow-[0_20px_52px_-38px_rgba(8,6,26,0.95)] sm:p-8">
          <h2 className="text-xl font-semibold text-white sm:text-2xl">Rejoignez le repertoire FAB</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-[#ebe6ff] sm:text-base">
            Inscription gratuite avec parcours aligné sur le formulaire officiel: informations générales, compétences,
            offre de service et engagements légaux.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/onboarding/resource"
              className="inline-flex min-w-[220px] justify-center rounded-xl bg-[#3567b7] px-5 py-2.5 text-sm font-semibold text-white no-underline transition-colors hover:bg-[#2f5da6]"
            >
              Commencer l'inscription guidée
            </Link>
            <Link
              href="/formulaire-allie"
              className="inline-flex rounded-xl border border-[#6f8fe2]/45 bg-[#1d1840] px-4 py-2.5 text-sm font-medium text-[#b9ccff] no-underline hover:bg-[#292358] hover:text-[#d4dfff]"
            >
              Lire le formulaire de référence
            </Link>
            <Link
              href="/"
              className="inline-flex rounded-xl border border-[#6f8fe2]/45 bg-[#1d1840] px-4 py-2.5 text-sm font-medium text-[#b9ccff] no-underline hover:bg-[#292358] hover:text-[#d4dfff]"
            >
              Retour à l'accueil
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

