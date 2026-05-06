"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";

const ALLY_TYPES = [
  {
    title: "Gardien compétent",
    text: "Offrez une présence fiable, rassurante et adaptée aux enfants des familles d'accueil.",
    image: "/images/Gardiens compétant.png",
  },
  {
    title: "Entretien Ménage",
    text: "Aidez avec l'entretien du foyer quand le quotidien déborde et que chaque geste compte.",
    image: "/images/Entretien Ménage.png",
  },
  {
    title: "Tutorat",
    text: "Soutenez les apprentissages, les devoirs et la confiance scolaire des jeunes.",
    image: "/images/Tutorat.png",
  },
];

const STEPS = [
  {
    title: "1. Vous remplissez le formulaire",
    text: "On recueille votre type d'aide, votre secteur, vos disponibilités et vos engagements.",
  },
  {
    title: "2. Votre profil est valide",
    text: "FAB vérifie les informations utiles avant de rendre votre profil visible aux familles.",
  },
  {
    title: "3. Les familles vous contactent",
    text: "Vous recevez des demandes proches de votre secteur, selon ce que vous offrez.",
  },
  {
    title: "4. L'entente reste humaine",
    text: "Vous convenez directement des détails avec la famille, clairement et simplement.",
  },
];

const TRUST_POINTS = [
  "Profil encadré avant publication",
  "Types d'aide clairement présentés",
  "Mise en relation locale et respectueuse",
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
  const [postalCode, setPostalCode] = useState("");
  const [tags, setTags] = useState("");
  const [error, setError] = useState<string | null>(null);

  const normalizedPostal = normalizePostalCode(postalCode);
  const isPostalValid = isValidPostalCode(normalizedPostal);

  const handleFamilySearch = (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!normalizedPostal) {
      setError("Entrez un code postal.");
      return;
    }

    if (!isValidPostalCode(normalizedPostal)) {
      setError("Code postal invalide. Exemples valides: H2X ou H2X1Y4.");
      return;
    }

    const params = new URLSearchParams({ postalCode: normalizedPostal });
    if (tags.trim()) params.set("tags", tags.trim());
    router.push(`/search?${params.toString()}`);
  };

  return (
    <main className="bg-[#261b55] text-white">
      <section className="relative isolate min-h-[680px] overflow-hidden">
        <Image
          src="/images/hero-fab.png"
          alt="Parent et enfant au coucher du soleil."
          fill
          priority
          className="object-cover object-center"
          unoptimized
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#251850]/78 via-[#322064]/58 to-[#56347b]/24" aria-hidden />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#261b55] to-transparent" aria-hidden />

        <div className="relative mx-auto flex min-h-[680px] max-w-6xl items-center px-4 py-16 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#f8c27f]">
              Famille d'accueil branchée
            </p>
            <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight sm:text-6xl">
              Devenez un allié pour une famille d'accueil.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-[#f3edff] sm:text-lg">
              Choisissez votre rôle: gardien compétent, entretien ménage ou tutorat. FAB vous aide à devenir une présence
              concrète, locale et rassurante pour les familles d'accueil.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/onboarding/resource"
                className="inline-flex rounded-lg bg-[#f17d55] px-5 py-3 text-sm font-semibold text-white no-underline shadow-[0_16px_36px_-22px_rgba(241,125,85,0.9)] transition-colors hover:bg-[#df6d46]"
              >
                Commencer comme allié
              </Link>
              <Link
                href="/devenir-allie"
                className="inline-flex rounded-lg border border-white/35 bg-white/10 px-5 py-3 text-sm font-semibold text-white no-underline backdrop-blur-sm transition-colors hover:bg-white/16"
              >
                Comprendre le rôle
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#f7f4ff] py-14 text-[#21183f] sm:py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[0.78fr_1.22fr] lg:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[#7f59db]">Le coeur de FAB</p>
              <h2 className="mt-2 text-3xl font-semibold leading-tight sm:text-4xl">
                Des gestes simples qui changent une semaine.
              </h2>
              <p className="mt-4 text-base leading-7 text-[#554c76]">
                Chaque allié indique ce qu&apos;il offre et où il intervient ; la famille choisit qui lui convient, sans
                ambiguïté.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {ALLY_TYPES.map((type) => (
                <article key={type.title} className="rounded-2xl border border-[#d9d2ed] bg-white p-3 shadow-sm">
                  <div className="relative h-24 w-full overflow-hidden rounded-[22px] bg-[#f8f7fb]">
                    <Image src={type.image} alt={type.title} fill className="object-contain object-center" unoptimized />
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[#625a7d]">{type.text}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white py-14 text-[#21183f] sm:py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[1fr_1fr] lg:items-center">
            <div className="relative min-h-[360px] overflow-hidden rounded-lg border border-[#ded8f0] bg-[#f1edff] sm:min-h-[430px]">
              <Image
                src="/images/allies-types.jpg"
                alt="Types d'alliés disponibles sur la plateforme."
                fill
                className="object-contain object-center"
                unoptimized
              />
            </div>

            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[#62beab]">Inscription</p>
              <h2 className="mt-2 text-3xl font-semibold leading-tight sm:text-4xl">
                Un parcours clair avant d'être visible.
              </h2>
              <div className="mt-6 grid gap-3">
                {STEPS.map((step) => (
                  <article key={step.title} className="rounded-lg border border-[#ded8f0] bg-[#fbfaff] p-4">
                    <h3 className="font-semibold">{step.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-[#625a7d]">{step.text}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative isolate overflow-hidden py-16 sm:py-20">
        <Image src="/images/bottom-fab.png" alt="" fill className="object-cover object-center" unoptimized aria-hidden />
        <div className="absolute inset-0 bg-gradient-to-r from-[#211446]/88 via-[#352061]/68 to-[#7a3f67]/36" aria-hidden />
        <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#261b55] to-transparent" aria-hidden />
        <div className="relative mx-auto grid max-w-6xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-end lg:px-8">
          <div className="rounded-[28px] border border-white/18 bg-[#21183f]/58 p-6 shadow-[0_28px_70px_-48px_rgba(9,6,28,0.9)] backdrop-blur-md sm:p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[#f8c27f]">Confiance</p>
            <h2 className="mt-2 text-3xl font-semibold leading-tight sm:text-4xl">
              Les familles doivent sentir qu'elles sont entre bonnes mains.
            </h2>
            <p className="mt-4 max-w-xl text-base leading-7 text-[#f3edff]">
              FAB structure la rencontre pour que chaque allié présente clairement son type de soutien, où il intervient
              et ce qu'il est prêt à fournir.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {TRUST_POINTS.map((point, index) => (
              <article key={point} className="rounded-2xl border border-white/22 bg-white/14 p-4 backdrop-blur-md">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#f8c27f] text-sm font-semibold text-[#21183f]">
                  {index + 1}
                </span>
                <p className="mt-3 text-sm font-medium leading-6 text-[#f6f2ff]">{point}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#261b55] px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
        <div className="mx-auto grid max-w-6xl overflow-hidden rounded-[34px] border border-white/20 bg-[#f7f4ff] text-[#21183f] shadow-[0_28px_70px_-46px_rgba(10,7,30,0.9)] lg:grid-cols-[0.95fr_1.05fr]">
          <div className="bg-gradient-to-br from-[#fff7ef] via-[#fffaf5] to-[#eee9ff] p-6 sm:p-8 lg:p-10">
            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[#d46d45]">Dernière étape</p>
            <h2 className="mt-3 text-3xl font-semibold leading-tight sm:text-4xl">
              Votre aide peut devenir le moment où une famille respire.
            </h2>
            <p className="mt-4 max-w-xl text-base leading-7 text-[#5d5578]">
              Créez votre profil allié, choisissez votre type de soutien et laissez FAB vous guider dans l'inscription.
            </p>
            <Link
              href="/onboarding/resource"
              className="mt-6 inline-flex rounded-xl bg-[#f17d55] px-5 py-3 text-sm font-semibold text-white no-underline shadow-[0_16px_34px_-24px_rgba(241,125,85,0.9)] transition-colors hover:bg-[#df6d46]"
            >
              Devenir allié
            </Link>
          </div>

          <form
            onSubmit={handleFamilySearch}
            className="p-6 sm:p-8 lg:p-10"
            aria-label="Recherche d'alliés par code postal"
          >
            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[#3567b7]">Pour les familles</p>
            <h3 className="mt-3 text-2xl font-semibold leading-tight">Vous cherchez déjà du soutien?</h3>
            <p className="mt-3 text-sm leading-6 text-[#625a7d]">
              Entrez un code postal pour voir les alliés disponibles près de chez vous.
            </p>
            <div className="mt-5 grid gap-3">
              <Input
                type="text"
                value={postalCode}
                onChange={(event) => setPostalCode(normalizePostalCode(event.target.value))}
                placeholder="Code postal"
                maxLength={7}
                className="!border-[#d7d2ea] !bg-white !text-[#21183f] placeholder:!text-[#6f688e] focus:!border-[#62beab] focus:!ring-[#62beab]/30"
              />
              <Input
                type="text"
                value={tags}
                onChange={(event) => setTags(event.target.value)}
                placeholder="Besoin: gardien, ménage, tutorat..."
                className="!border-[#d7d2ea] !bg-white !text-[#21183f] placeholder:!text-[#6f688e] focus:!border-[#62beab] focus:!ring-[#62beab]/30"
              />
              <Button
                type="submit"
                disabled={!isPostalValid}
                className="!rounded-xl !bg-[#3567b7] !px-5 !py-3 !font-semibold hover:!bg-[#2f5da6]"
              >
                Voir les alliés près de moi
              </Button>
            </div>
            {error ? <p className="mt-3 text-sm text-[#b95035]">{error}</p> : null}
          </form>
        </div>
      </section>
    </main>
  );
}
