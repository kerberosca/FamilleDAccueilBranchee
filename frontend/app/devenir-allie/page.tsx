"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Card } from "../../components/ui/card";

const TYPES = [
  {
    title: "Ménage",
    description: "Aide au quotidien : entretien, repas, linge. Un soutien concret pour alléger le foyer.",
    icon: "🏠",
    image: "/images/menage-illustration.png"
  },
  {
    title: "Gardiens",
    description: "Garde d'enfants, répit. Permettre aux familles de souffler en toute confiance.",
    icon: "👶",
    image: "/images/gardien-illustration.png"
  },
  {
    title: "Autres",
    description: "Transport, accompagnement, soutien ponctuel. Chaque aide compte.",
    icon: "🤝",
    image: "/images/autres-illustration.png"
  }
];

const STEPS = [
  "Inscrivez-vous gratuitement et choisissez votre type d'allié.",
  "Complétez votre profil et le questionnaire.",
  "Après validation (vérification d'antécédents), vous êtes visible par les familles.",
  "Les familles vous contactent selon leurs besoins."
];

function TypeIcon({
  item
}: {
  item: { title: string; icon: string; image?: string };
}) {
  const [imageError, setImageError] = useState(false);
  if (item.image && !imageError) {
    return (
      <div className="relative h-20 w-full">
        <Image
          src={item.image}
          alt=""
          fill
          className="object-contain object-left"
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
    <main className="relative mx-auto max-w-4xl px-4 pb-24 pt-8 sm:px-6 sm:pt-12">
      {/* Hero */}
      <section className="animate-slide-up text-center">
        <p className="text-sm font-medium uppercase tracking-wider text-cyan-400/90">
          Allié cherché
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-white sm:text-5xl">
          Qu&apos;est-ce qu&apos;un{" "}
          <span className="bg-gradient-to-r from-cyan-400 via-cyan-300 to-blue-400 bg-clip-text text-transparent">
            allié
          </span>{" "}
          ?
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-slate-400">
          Les alliés sont des personnes qui offrent un soutien concret aux familles d&apos;accueil :
          ménage, garde d&apos;enfants, transport, répit. Ils complètent l&apos;offre de FAB en mettant
          leurs compétences au service des familles près de chez elles.
        </p>
      </section>

      {/* Types d'alliés */}
      <section className="mt-14 sm:mt-18">
        <h2 className="text-center text-2xl font-semibold text-white sm:text-3xl">
          Trois types d&apos;alliés
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-center text-slate-400">
          Choisissez celui qui correspond à ce que vous proposez.
        </p>
        <div className="mt-8 grid gap-5 sm:grid-cols-3">
          {TYPES.map((item) => (
            <Card
              key={item.title}
              variant="glass"
              className="animate-slide-up border-cyan-500/10 bg-slate-800/50 transition hover:border-cyan-500/25 hover:shadow-[0_0_20px_-8px_rgba(34,211,238,0.3)]"
            >
              <TypeIcon item={item} />
              <h3 className="mt-3 text-lg font-semibold text-white">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{item.description}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Comment ça marche */}
      <section className="mt-14 sm:mt-18">
        <h2 className="text-center text-2xl font-semibold text-white sm:text-3xl">
          Du profil à la mise en relation : quatre étapes.
        </h2>
        <ul className="mx-auto mt-8 max-w-lg space-y-4">
          {STEPS.map((step, i) => (
            <li key={i} className="flex gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-500/20 text-sm font-bold text-cyan-400">
                {i + 1}
              </span>
              <span className="pt-0.5 text-slate-300">{step}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* CTA */}
      <section className="mt-14 sm:mt-18">
        <Card variant="elevated" className="border-cyan-500/25 bg-slate-800/70 text-center">
          <h2 className="text-xl font-semibold text-white sm:text-2xl">
            Rejoignez le répertoire : créer mon compte allié.
          </h2>
          <p className="mx-auto mt-2 max-w-md text-slate-400">
            Inscription gratuite. Complétez votre profil, répondez au questionnaire et à la
            vérification d&apos;antécédents pour être visible auprès des familles.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/onboarding/resource"
              className="inline-flex min-w-[200px] justify-center rounded-md bg-cyan-700 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50"
            >
              Créer mon compte allié
            </Link>
            <Link
              href="/"
              className="inline-flex rounded-md bg-slate-700 px-4 py-2 text-sm font-medium text-slate-100 hover:bg-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50"
            >
              Retour à l&apos;accueil
            </Link>
          </div>
        </Card>
      </section>
    </main>
  );
}
