"use client";

import Link from "next/link";

export default function CGUPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6 pb-16">
      <h1 className="text-2xl font-bold text-white">Conditions générales d&apos;utilisation</h1>
      <p className="text-sm text-slate-400">
        Dernière mise à jour : 14 février 2025. Le site FAB est opéré par Forméduc.
      </p>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-white">1. Objet du site</h2>
        <p className="text-slate-300">
          FAB (Famille d&apos;accueil branchée) est une plateforme de mise en relation entre familles d&apos;accueil et alliés (soutien : ménage, garde, transport, répit) au Québec. Elle est exploitée par <strong>Forméduc</strong>. En utilisant le site, vous acceptez les présentes conditions générales d&apos;utilisation (CGU).
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-white">2. Règles d&apos;usage</h2>
        <p className="text-slate-300">
          Vous vous engagez à utiliser le site et le répertoire de manière loyale, dans le cadre de la mise en relation prévue par FAB. Vous êtes responsable des informations que vous publiez et des échanges que vous avez avec les autres utilisateurs. Il est interdit d&apos;usurper l&apos;identité d&apos;autrui, de diffuser des contenus illicites, diffamatoires ou contraires à l&apos;ordre public.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-white">3. Répertoire et usage interdit</h2>
        <p className="text-slate-300">
          Le répertoire (profils d&apos;alliés et de familles) et les données accessibles via la plateforme sont fournis uniquement pour permettre la <strong>mise en relation</strong> entre familles et alliés dans le cadre du service FAB. Sont strictement interdits :
        </p>
        <ul className="list-inside list-disc space-y-1 text-slate-300">
          <li>l&apos;utilisation des listes d&apos;alliés ou de familles à des fins de <strong>prospection commerciale</strong>, de revente de données ou de sollicitation non sollicitée ;</li>
          <li>la <strong>revente</strong>, le partage ou la cession des données du répertoire à des tiers ;</li>
          <li>le <strong>scraping</strong>, la copie massive ou la réutilisation automatisée des profils ou des données ;</li>
          <li>toute utilisation du répertoire ou des données en dehors de la plateforme FAB à d&apos;autres fins que la mise en relation prévue.
        </ul>
        <p className="text-slate-300">
          En cas de manquement, Forméduc se réserve le droit de <strong>suspension</strong> ou de <strong>résiliation</strong> du compte, sans préjudice d&apos;éventuelles poursuites.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-white">4. Responsabilités</h2>
        <p className="text-slate-300">
          Forméduc s&apos;efforce d&apos;assurer le bon fonctionnement du site et la modération des contenus dans la mesure de ses moyens. Elle ne peut toutefois être tenue responsable des agissements des utilisateurs entre eux, des contenus qu&apos;ils publient ou des accords qu&apos;ils concluent en dehors de la plateforme. L&apos;utilisation du site est à vos risques et périls dans les limites prévues par la loi applicable.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-white">5. Propriété intellectuelle</h2>
        <p className="text-slate-300">
          Le site, sa structure, son design et les contenus éditoriaux sont protégés par le droit d&apos;auteur et appartiennent à Forméduc ou à ses ayants droit. Toute reproduction ou utilisation non autorisée peut constituer une contrefaçon. Les contenus que vous publiez (textes, photos) restent votre propriété ; vous accordez à Forméduc une licence d&apos;utilisation nécessaire au fonctionnement du service.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-white">6. Modification des conditions</h2>
        <p className="text-slate-300">
          Forméduc peut modifier les présentes CGU. Les changements seront publiés sur cette page avec une date de mise à jour. En cas de modification substantielle, les utilisateurs pourront être informés par courriel ou message sur le site. La poursuite de l&apos;utilisation du site après publication vaut acceptation des nouvelles conditions.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-white">7. Droit applicable et résiliation</h2>
        <p className="text-slate-300">
          Les présentes CGU sont régies par les lois du <strong>Québec</strong> et du <strong>Canada</strong>. Tout litige relève des tribunaux compétents du Québec. Vous pouvez résilier votre compte à tout moment via la fonction « Supprimer mon compte » dans Mon compte. Forméduc peut suspendre ou résilier un compte en cas de non-respect des présentes conditions ou pour tout motif légitime.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-white">8. Contact</h2>
        <p className="text-slate-300">
          Pour toute question : Forméduc — 5121 boul. Chauveau Ouest, Québec, QC G2E 5A6 local 101. Téléphone : 418 842-7523. Courriel : info@formeduc.ca.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-white">Liens utiles</h2>
        <ul className="list-inside list-disc space-y-1 text-slate-300">
          <li><Link href="/confidentialite" className="text-cyan-400 hover:text-cyan-300">Politique de confidentialité</Link></li>
          <li><Link href="/mentions-legales" className="text-cyan-400 hover:text-cyan-300">Mentions légales</Link></li>
          <li><Link href="/" className="text-cyan-400 hover:text-cyan-300">Accueil</Link></li>
        </ul>
      </section>

      <p className="pt-4">
        <Link href="/" className="text-cyan-400 hover:text-cyan-300">
          ← Retour à l&apos;accueil
        </Link>
      </p>
    </main>
  );
}
