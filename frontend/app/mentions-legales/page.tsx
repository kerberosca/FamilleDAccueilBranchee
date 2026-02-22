"use client";

import Link from "next/link";

export default function MentionsLegalesPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6 pb-16">
      <h1 className="text-2xl font-bold text-white">Mentions légales</h1>
      <p className="text-sm text-slate-400">
        Le site FAB (Famille d&apos;accueil branchée) est opéré par Forméduc.
      </p>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-white">Éditeur du site</h2>
        <p className="text-slate-300">
          <strong>Forméduc</strong><br />
          1189 rue Irving, Québec (Québec) G3K 1N6 Canada<br />
          Téléphone : 418 842-7523<br />
          Courriel : info@formeduc.ca<br />
          Numéro d&apos;entreprise du Québec (NEQ) : 1179350856
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-white">Objet du site</h2>
        <p className="text-slate-300">
          FAB (Famille d&apos;accueil branchée) est une plateforme de mise en relation entre familles d&apos;accueil et alliés (soutien : ménage, garde, transport, répit) au Québec.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-white">Hébergement</h2>
        <p className="text-slate-300">
          À préciser par Forméduc (hébergeur et lieu d&apos;hébergement).
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-white">Propriété intellectuelle</h2>
        <p className="text-slate-300">
          Le contenu du site (textes, visuels, structure) est protégé par le droit d&apos;auteur. Toute reproduction ou utilisation non autorisée peut constituer une contrefaçon.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-white">Liens utiles</h2>
        <ul className="list-inside list-disc space-y-1 text-slate-300">
          <li><Link href="/confidentialite" className="text-cyan-400 hover:text-cyan-300">Politique de confidentialité</Link></li>
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
