import Link from "next/link";
import { NewsletterForm } from "./newsletter-form";

type NewsletterLandingProps = {
  congress?: boolean;
};

export function NewsletterLanding({ congress = false }: NewsletterLandingProps) {
  return (
    <main className="bg-[#261b55] px-4 py-12 text-white sm:px-6 sm:py-20">
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
        <div className="lg:pt-8">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#f8c27f]">
            {congress ? "FAB au congrès" : "Infolettre FAB"}
          </p>
          <h1 className="mt-4 text-4xl font-semibold leading-tight sm:text-5xl">
            Le lancement de FAB approche. Restez au courant.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-[#f3edff]">
            Famille d’accueil ou futur allié, inscrivez-vous pour découvrir en primeur les nouvelles de Famille
            d’accueil branchée et les détails de son lancement.
          </p>
          <p className="mt-5 max-w-xl text-base leading-7 text-[#ddd5f5]">
            FAB prépare une façon simple et humaine de mettre les familles d’accueil en relation avec des alliés
            qui peuvent leur offrir du soutien.
          </p>
          <Link href="/" className="mt-8 inline-flex text-sm font-semibold text-[#9eeaf9] hover:text-white">
            En savoir plus sur FAB →
          </Link>
        </div>

        <section
          aria-labelledby="newsletter-form-title"
          className="overflow-hidden rounded-[28px] border border-[#ded8f0] bg-[#f7f4ff] p-5 text-[#21183f] shadow-[0_28px_70px_-46px_rgba(10,7,30,0.9)] sm:p-8"
        >
          <h2 id="newsletter-form-title" className="text-2xl font-semibold">
            Inscrivez-vous à l’infolettre
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#554c76]">
            Votre prénom et votre adresse courriel suffisent. Vous recevrez un message de bienvenue, puis les
            nouvelles et les détails du lancement de FAB.
          </p>

          <NewsletterForm congress={congress} />
        </section>
      </div>
    </main>
  );
}
