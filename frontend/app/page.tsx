"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";

/** Zones cliquables sur l'image "types d'alliés" : Gardien compétent, Entretien Ménage, Tutorat */
const TYPES_ALLIES_CLICK_ZONES = [
  { label: "Gardien compétent", searchTag: "garde", position: { left: "6%", top: "14%", width: "30%", height: "24%" } },
  { label: "Entretien Ménage", searchTag: "ménage", position: { left: "6%", top: "46%", width: "30%", height: "24%" } },
  { label: "Tutorat", searchTag: "transport", position: { left: "62%", top: "28%", width: "30%", height: "28%" } },
];

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
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [heroLogoSrc, setHeroLogoSrc] = useState("/images/logo.png");
  const [heroLogoError, setHeroLogoError] = useState(false);
  const [postalCode, setPostalCode] = useState("");
  const [tags, setTags] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [videoReady, setVideoReady] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const tryPlay = () => {
      video.muted = true;
      const playPromise = video.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {
          // iOS may block autoplay in portrait; orientationchange will retry.
        });
      }
    };

    const onPlaying = () => setVideoReady(true);

    tryPlay();
    video.addEventListener("loadeddata", tryPlay);
    video.addEventListener("canplay", tryPlay);
    video.addEventListener("playing", onPlaying);
    document.addEventListener("visibilitychange", tryPlay);
    window.addEventListener("orientationchange", tryPlay);
    window.addEventListener("resize", tryPlay);

    const t1 = setTimeout(tryPlay, 400);
    const t2 = setTimeout(tryPlay, 1200);
    const fallbackReady = setTimeout(() => setVideoReady(true), 2500);

    return () => {
      video.removeEventListener("loadeddata", tryPlay);
      video.removeEventListener("canplay", tryPlay);
      video.removeEventListener("playing", onPlaying);
      document.removeEventListener("visibilitychange", tryPlay);
      window.removeEventListener("orientationchange", tryPlay);
      window.removeEventListener("resize", tryPlay);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(fallbackReady);
    };
  }, []);

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
    <main className="relative isolate mx-auto max-w-4xl overflow-hidden px-4 pb-20 pt-10 sm:px-6 sm:pt-16">
      <div className="pointer-events-none absolute inset-0 -z-10 min-h-[100dvh] overflow-hidden sm:min-h-0">
        <video
          ref={videoRef}
          className="block h-full w-full object-cover opacity-60 brightness-[0.65] contrast-110 saturate-90"
          autoPlay
          muted
          loop
          playsInline
          webkit-playsinline="true"
          preload="auto"
          poster="/images/logo.png"
          onCanPlay={() => setVideoReady(true)}
          aria-hidden
        >
          <source src="/videos/video-accueil.mp4" type="video/mp4" />
        </video>
        {!videoReady && <div className="absolute inset-0 bg-[#0a0e17]" aria-hidden />}
        <div className="absolute inset-0 bg-[#0a0e17]/50" aria-hidden />
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(ellipse 120% 80% at 50% -20%, rgba(34, 211, 238, 0.10), transparent), radial-gradient(ellipse 80% 50% at 100% 0%, rgba(59, 130, 246, 0.06), transparent), radial-gradient(ellipse 60% 40% at 0% 100%, rgba(34, 211, 238, 0.05), transparent)",
          }}
          aria-hidden
        />
      </div>

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
          <p className="mb-4 text-center text-sm text-slate-400">
            Cliquez sur un type pour rechercher les alliés correspondants.
          </p>
          <div className="relative w-full overflow-hidden rounded-xl">
            <Image
              src="/images/AlliésTypes.jpg"
              alt="Types d'alliés : Gardien compétent, Entretien Ménage, Tutorat. Cliquez sur une bulle pour rechercher."
              width={800}
              height={600}
              className="w-full h-auto object-contain"
              unoptimized
            />
            {TYPES_ALLIES_CLICK_ZONES.map((zone) => (
              <Link
                key={zone.label}
                href={`/search?tags=${encodeURIComponent(zone.searchTag)}`}
                className="absolute rounded-2xl transition-all duration-200 hover:bg-cyan-500/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                style={{
                  left: zone.position.left,
                  top: zone.position.top,
                  width: zone.position.width,
                  height: zone.position.height,
                }}
                aria-label={`Rechercher des alliés : ${zone.label}`}
              />
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
