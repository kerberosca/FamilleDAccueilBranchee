"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";

const FSA_REGEX = /^[A-Z][0-9][A-Z]$/;
const FULL_POSTAL_REGEX = /^[A-Z][0-9][A-Z][0-9][A-Z][0-9]$/;

function normalizePostalCode(value: string): string {
  return value.replace(/\s+/g, "").toUpperCase();
}

function isValidPostalCode(value: string): boolean {
  return FSA_REGEX.test(value) || FULL_POSTAL_REGEX.test(value);
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
          Bienvenue sur{" "}
          <span className="bg-gradient-to-r from-cyan-400 via-cyan-300 to-blue-400 bg-clip-text text-transparent">
            FAB
          </span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-slate-400">
          Entrez votre code postal ci-dessous pour trouver des alliés près de chez vous. La recherche se fait par code postal (3 lettres-chiffres, ex. G8P, ou code complet en 6 caractères).
        </p>

        <form onSubmit={handleSearch} className="mx-auto mt-8 max-w-md space-y-3 text-left">
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
            className="w-full"
            aria-label="Tags de recherche"
          />
          {error && (
            <p className="text-sm text-rose-400" role="alert">
              {error}
            </p>
          )}
        </form>

        <div className="mx-auto mt-10 max-w-md animate-slide-up">
          <Link
            href="/devenir-allie"
            className="block rounded-xl border border-cyan-500/30 bg-slate-800/60 p-4 text-center transition hover:border-cyan-500/50 hover:bg-slate-800/80 hover:shadow-[0_0_24px_-8px_rgba(34,211,238,0.2)] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50"
          >
            <span className="text-sm font-medium uppercase tracking-wider text-cyan-400">
              Exemple : Allié cherché
            </span>
            <span className="mt-1 block text-base font-medium text-white">
              Qu&apos;est-ce qu&apos;un allié ? Devenir allié
            </span>
          </Link>
        </div>
      </div>
    </main>
  );
}
