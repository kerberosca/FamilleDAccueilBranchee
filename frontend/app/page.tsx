"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";

const CATEGORIES = [
  {
    title: "Ménage",
    description: "Entretien, repas, linge. Un soutien concret pour alléger le foyer.",
    image: "/images/menage-illustration.png",
    searchTag: "ménage",
  },
  {
    title: "Gardiens",
    description: "Garde d'enfants, répit. Permettre aux familles de souffler.",
    image: "/images/gardien-illustration.png",
    searchTag: "garde",
  },
  {
    title: "Autres",
    description: "Transport, accompagnement, soutien ponctuel.",
    image: "/images/autres-illustration.png",
    searchTag: "transport",
  },
];

const FSA_REGEX = /^[A-Z][0-9][A-Z]$/;
const FULL_POSTAL_REGEX = /^[A-Z][0-9][A-Z][0-9][A-Z][0-9]$/;

function normalizePostalCode(value: string): string {
  return value.replace(/\s+/g, "").toUpperCase();
}

function isValidPostalCode(value: string): boolean {
  return FSA_REGEX.test(value) || FULL_POSTAL_REGEX.test(value);
}

function CategoryCard({
  item,
}: {
  item: (typeof CATEGORIES)[number];
}) {
  const [imageError, setImageError] = useState(false);
  const searchHref = `/search?tags=${encodeURIComponent(item.searchTag)}`;

  return (
    <Link
      href={searchHref}
      className="block h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 rounded-xl transition-shadow duration-200"
    >
      <Card
        variant="glass"
        className="h-full border-cyan-500/10 bg-slate-800/50 text-center transition-all duration-200 hover:border-cyan-500/25 hover:shadow-[0_0_20px_-8px_rgba(34,211,238,0.3)]"
      >
        <div className="relative mx-auto h-16 w-full max-w-[120px]">
          {item.image && !imageError ? (
            <Image
              src={item.image}
              alt=""
              fill
              className="object-contain object-center"
              onError={() => setImageError(true)}
              unoptimized
            />
          ) : (
            <span className="text-3xl" aria-hidden>
              {item.title === "Ménage" ? "🏠" : item.title === "Gardiens" ? "👶" : "🤝"}
            </span>
          )}
        </div>
        <h3 className="mt-3 text-base font-semibold text-white">{item.title}</h3>
        <p className="mt-1 text-sm leading-snug text-slate-400">{item.description}</p>
      </Card>
    </Link>
  );
}

export default function HomePage() {
  const router = useRouter();
  const [heroLogoSrc, setHeroLogoSrc] = useState("/images/logo.png");
  const [heroLogoError, setHeroLogoError] = useState(false);
  const [postalCode, setPostalCode] = useState("");
  const [tags, setTags] = useState("");
  const [error, setError] = useState<string | null>(null);

  const normalizedPostal = normalizePostalCode(postalCode);
  const isPostalValid = isValidPostalCode(normalizedPostal);

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const code = normalizedPostal;
    if (!code) {
      setError("Entre un code postal (3 ou 6 caractères).");
      return;
    }
    if (!isValidPostalCode(code)) {
      setError("Code postal invalide. Utilise 3 caractères (ex: H2X) ou 6 (ex: H2X1Y4).");
      return;
    }
    const params = new URLSearchParams({ postalCode: code });
    if (tags.trim()) params.set("tags", tags.trim());
    router.push(`/search?${params.toString()}`);
  };

  return (
    <main className="relative mx-auto max-w-4xl px-4 pb-20 pt-10 sm:px-6 sm:pt-16">
      <div className="animate-slide-up text-center">
        {!heroLogoError && (
          <div className="mb-0 flex justify-center">
            <Image
              src={heroLogoSrc}
              alt=""
              width={320}
              height={320}
              className="h-52 w-auto object-contain sm:h-72"
              onError={() => {
                if (heroLogoSrc === "/images/logo.png") {
                  setHeroLogoSrc("/images/Logo.png");
                } else {
                  setHeroLogoError(true);
                }
              }}
              unoptimized
            />
          </div>
        )}
        <h1 className="-mt-5 text-4xl font-bold tracking-tight text-white sm:text-5xl md:text-6xl">
          Là où les familles d&apos;accueil trouvent leur soutien.
        </h1>
        <p className="mt-2 text-xl text-cyan-400/90 sm:text-2xl">
          <span className="bg-gradient-to-r from-cyan-400 via-cyan-300 to-blue-400 bg-clip-text text-transparent">
            FAB
          </span>
        </p>

        <div className="mx-auto mt-6 max-w-md">
          <p className="mb-3 text-center text-sm text-slate-400">
            Un code postal, des alliés. C&apos;est parti.
          </p>
          <form
            onSubmit={handleSearch}
            className="animate-soft-glow rounded-xl border border-cyan-500/20 bg-slate-800/40 p-4 text-left backdrop-blur-sm"
            aria-label="Recherche d'alliés par code postal"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                type="text"
                value={postalCode}
                onChange={(e) => setPostalCode(normalizePostalCode(e.target.value))}
                placeholder="Code postal (ex: H2X ou H2X1Y4)"
                className="flex-1"
                maxLength={7}
                aria-label="Code postal"
              />
              <Button type="submit" disabled={!isPostalValid} className="w-full sm:w-auto">
                Rechercher
              </Button>
            </div>
            <Input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="Tags optionnels (ex: transport, répit)"
              className="mt-3 w-full"
              aria-label="Tags de recherche"
            />
            {error && (
              <p className="mt-2 text-sm text-rose-400" role="alert">
                {error}
              </p>
            )}
          </form>
          <p className="mt-2 text-center text-xs text-slate-500">
            3 ou 6 caractères (ex. G8P ou G8P 1A1)
          </p>
          <p className="mt-1 text-center text-xs text-slate-500">
            Alliés vérifiés (vérification d&apos;antécédents).
          </p>
        </div>

        <section className="mx-auto mt-10 max-w-3xl animate-slide-up" aria-labelledby="categories-heading">
          <h2 id="categories-heading" className="mb-4 text-center text-lg font-semibold text-slate-300">
            Types d&apos;alliés
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {CATEGORIES.map((item) => (
              <CategoryCard key={item.title} item={item} />
            ))}
          </div>
        </section>

        <p className="mx-auto mt-6 max-w-2xl text-center text-sm text-slate-500">
          FAB est une initiative de{" "}
          <a
            href="https://www.formeduc.ca"
            target="_blank"
            rel="noopener noreferrer"
            className="text-cyan-400 underline hover:text-cyan-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 rounded transition-colors duration-200"
            aria-label="Forméduc, formation en secourisme (nouvelle fenêtre)"
          >
            Forméduc
          </a>
          , reconnu pour la formation en secourisme au Québec.
        </p>

        <div className="mx-auto mt-10 max-w-md animate-slide-up">
          <Link
            href="/devenir-allie"
            className="block rounded-xl border border-cyan-500/30 bg-slate-800/60 p-4 text-center transition-all duration-200 hover:border-cyan-500/50 hover:bg-slate-800/80 hover:shadow-[0_0_24px_-8px_rgba(34,211,238,0.2)] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            aria-label="Rejoindre le répertoire FAB, page Devenir allié"
          >
            <span className="block text-base font-medium leading-snug text-white">
              Votre temps, leurs besoins. Rejoignez FAB comme allié.
            </span>
            <span className="mt-2 block text-sm text-cyan-400/90">
              Rejoindre le répertoire FAB
            </span>
          </Link>
        </div>
      </div>
    </main>
  );
}
