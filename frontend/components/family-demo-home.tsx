"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiPost } from "../lib/api";
import { useAuth } from "../lib/auth-context";
import { Alert } from "./ui/alert";
import { Button } from "./ui/button";

type DemoEntryResponse = {
  accessToken: string;
  user: { id: string; role: string; email: string };
};

const supportTypes = [
  { title: "Gardien compétent", description: "Un peu de répit quand la semaine est chargée." },
  { title: "Entretien ménager", description: "Une aide concrète pour alléger le quotidien." },
  { title: "Tutorat", description: "Un soutien scolaire adapté au rythme du jeune." }
];

export function FamilyDemoHome() {
  const router = useRouter();
  const { isAuthenticated, isAuthLoading, setTokens } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enterDemo = async () => {
    if (isAuthenticated) {
      router.push("/search?postalCode=H2X1Y4");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await apiPost<DemoEntryResponse>("/auth/demo-family");
      setTokens(result.accessToken, null);
      router.push("/search?postalCode=H2X1Y4");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "La démo ne peut pas démarrer pour le moment.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="bg-[#f7f4ff] text-[#21183f]">
      <section className="relative isolate overflow-hidden bg-[#261b55] text-white">
        <Image
          src="/images/hero-fab.png"
          alt=""
          fill
          priority
          className="object-cover object-center"
          unoptimized
          aria-hidden
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#211446]/95 via-[#30205f]/83 to-[#4d3174]/45" aria-hidden />
        <div className="relative mx-auto grid min-h-[620px] max-w-6xl items-center px-4 py-16 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.15em] text-[#f8c27f]">Démonstration pour les familles</p>
            <h1 className="mt-4 text-4xl font-semibold leading-tight sm:text-6xl">
              Découvrez comment trouver du soutien près de chez vous.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-[#f3edff] sm:text-lg">
              Explorez le vrai parcours famille de FAB avec votre propre compte temporaire et des profils d&apos;alliés fictifs.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Button
                type="button"
                onClick={() => void enterDemo()}
                disabled={busy || isAuthLoading}
                className="!rounded-xl !bg-[#f17d55] !px-6 !py-3 !text-base !font-semibold hover:!bg-[#df6d46]"
              >
                {busy ? "Préparation de votre visite…" : isAuthenticated ? "Continuer ma visite" : "Entrer dans la démo"}
              </Button>
              <Link href="https://familledaccueilbranchee.ca/" className="text-sm font-medium text-white underline underline-offset-4 hover:text-[#f8c27f]">
                Voir le site principal ↗
              </Link>
            </div>
            {error ? <div className="mt-5"><Alert tone="error">{error}</Alert></div> : null}
            <p className="mt-6 max-w-xl text-sm leading-6 text-[#eee8ff]">
              Aucun courriel, mot de passe ni paiement requis. Votre visite reste séparée de celle des autres personnes.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#7f59db]">À explorer</p>
        <h2 className="mt-2 text-3xl font-semibold sm:text-4xl">Un parcours famille, étape par étape</h2>
        <div className="mt-7 grid gap-4 md:grid-cols-3">
          {[
            ["01", "Rechercher", "Essayez un code postal comme H2X, G1R ou J1H, puis filtrez les services."],
            ["02", "Découvrir", "Ouvrez un profil fictif pour voir les informations utiles à une famille."],
            ["03", "Échanger", "Consultez une conversation de départ et essayez la messagerie dans votre espace privé."]
          ].map(([number, title, description]) => (
            <article key={number} className="rounded-2xl border border-[#ded8f0] bg-white p-6 shadow-sm">
              <span className="text-sm font-bold text-[#d46d45]">{number}</span>
              <h3 className="mt-3 text-xl font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-[#625a7d]">{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-white px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-2xl font-semibold sm:text-3xl">Des exemples de soutien à découvrir</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {supportTypes.map((type) => (
              <article key={type.title} className="rounded-2xl border border-[#ded8f0] bg-[#fbfaff] p-6">
                <h3 className="text-lg font-semibold">{type.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#625a7d]">{type.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#261b55] px-4 py-10 text-white sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl rounded-2xl border border-white/25 bg-white/10 p-6 sm:p-8">
          <h2 className="text-2xl font-semibold">Une démo, avec de vraies interactions dans un espace isolé</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[#eee8ff]">
            Les profils, coordonnées et échanges sont fictifs. N&apos;entrez pas de renseignements personnels dans les messages ou le profil. Les comptes créés pour la visite sont supprimés après environ 24 heures. Aucun paiement n&apos;est possible ici.
          </p>
        </div>
      </section>
    </main>
  );
}
