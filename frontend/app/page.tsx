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
        </div>

        <div className="mx-auto mt-10 max-w-md animate-slide-up">
          <Link
            href="/devenir-allie"
            className="block rounded-xl border border-cyan-500/30 bg-slate-800/60 p-4 text-center transition hover:border-cyan-500/50 hover:bg-slate-800/80 hover:shadow-[0_0_24px_-8px_rgba(34,211,238,0.2)] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50"
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
