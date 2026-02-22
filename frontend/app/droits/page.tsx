"use client";

import Link from "next/link";

export default function DroitsPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6 pb-16">
      <h1 className="text-2xl font-bold text-white">Exercer vos droits</h1>
      <p className="text-sm text-slate-400">
        Conformément à la Loi 25 et à notre politique de confidentialité, vous disposez de droits sur vos données personnelles. Cette page indique comment les exercer.
      </p>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-white">Vos droits</h2>
        <ul className="list-inside list-disc space-y-1 text-slate-300">
          <li><strong>Accéder</strong> à vos données : obtenir une copie des renseignements personnels que nous détenons sur vous.</li>
          <li><strong>Rectifier</strong> vos données : corriger des informations inexactes ou incomplètes.</li>
          <li><strong>Retirer votre consentement</strong> : par exemple demander à ne plus figurer au répertoire ou à ne plus être visible par certains utilisateurs.</li>
          <li><strong>Supprimer votre compte</strong> : demander la suppression de votre compte et de vos données (droit à l&apos;effacement dans les limites prévues par la loi).</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-white">Comment exercer vos droits</h2>
        <p className="text-slate-300">
          <strong>Modifier ou supprimer votre compte :</strong> si vous avez un compte, connectez-vous et rendez-vous dans <strong>Mon compte</strong>. Vous pouvez y modifier votre profil et utiliser le bouton « Supprimer mon compte » pour une suppression définitive.
        </p>
        <p className="text-slate-300">
          <strong>Demandes par écrit :</strong> pour une demande d&apos;accès à vos données, une rectification, un retrait de consentement ou toute autre question relative à vos données personnelles, contactez la direction de Forméduc (personne responsable de la protection des renseignements personnels) :
        </p>
        <p className="text-slate-300">
          Courriel : <a href="mailto:info@formeduc.ca" className="text-cyan-400 underline hover:text-cyan-300">info@formeduc.ca</a><br />
          Téléphone : 418 842-7523<br />
          Adresse : 5121 boul. Chauveau Ouest, Québec, QC G2E 5A6 local 101
        </p>
        <p className="text-slate-300">
          Indiquez votre nom, votre courriel et la nature de votre demande. Nous nous engageons à vous répondre dans un <strong>délai raisonnable</strong>. Vous avez également le droit de porter plainte devant la Commission d&apos;accès à l&apos;information du Québec (CAI) si vous estimez que vos droits ne sont pas respectés.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-white">En savoir plus</h2>
        <p className="text-slate-300">
          Pour le détail des données collectées, des finalités et des délais de conservation, consultez notre{" "}
          <Link href="/confidentialite" className="text-cyan-400 underline hover:text-cyan-300">
            Politique de confidentialité
          </Link>
          .
        </p>
      </section>

      <p className="pt-4">
        <Link href="/" className="text-cyan-400 hover:text-cyan-300">
          ← Retour à l&apos;accueil
        </Link>
      </p>
    </main>
  );
}
