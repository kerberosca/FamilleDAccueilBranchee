"use client";

import Link from "next/link";

export default function AccessibilitePage() {
  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6 pb-16">
      <h1 className="text-2xl font-bold text-white">Accessibilité</h1>
      <p className="text-sm text-slate-400">
        Le site FAB (Famille d&apos;accueil branchée) est opéré par Forméduc. Nous nous engageons à rendre le site accessible au plus grand nombre.
      </p>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-white">Mesures prises</h2>
        <p className="text-slate-300">
          Nous visons la conformité aux <strong>Règles pour l&apos;accessibilité des contenus Web (WCAG) 2.1</strong>, niveau AA, dans la mesure du possible. Les mesures mises en place incluent notamment :
        </p>
        <ul className="list-inside list-disc space-y-1 text-slate-300">
          <li>Structure des pages avec titres hiérarchisés (h1, h2, h3)</li>
          <li>Labels sur les champs de formulaire et boutons</li>
          <li>Contraste des textes et des éléments d&apos;interface</li>
          <li>Navigation au clavier (tabulation, focus visible)</li>
          <li>Liens et boutons explicites (texte ou aria-label)</li>
          <li>Langue du document indiquée (français)</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-white">Limites connues</h2>
        <p className="text-slate-300">
          Certaines pages ou fonctionnalités peuvent ne pas encore être entièrement conformes (ex. contenus tiers, documents PDF, médias). Nous corrigeons les problèmes signalés dans la mesure de nos moyens et intégrons l&apos;accessibilité dans nos évolutions.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-white">Signaler un problème</h2>
        <p className="text-slate-300">
          Si vous rencontrez un obstacle à l&apos;accessibilité sur le site, vous pouvez nous le signaler pour que nous puissions le corriger. Contactez la direction de Forméduc :
        </p>
        <p className="text-slate-300">
          Courriel : <a href="mailto:info@formeduc.ca" className="text-cyan-400 underline hover:text-cyan-300">info@formeduc.ca</a><br />
          Téléphone : 418 842-7523
        </p>
        <p className="text-slate-300">
          Nous nous engageons à répondre dans un délai raisonnable et à proposer une solution ou une alternative lorsque c&apos;est possible.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-white">Références</h2>
        <p className="text-slate-300">
          <a href="https://www.w3.org/TR/WCAG21/" target="_blank" rel="noopener noreferrer" className="text-cyan-400 underline hover:text-cyan-300">WCAG 2.1 (W3C)</a> — Règles pour l&apos;accessibilité des contenus Web. Pour le secteur privé au Québec, la conformité aux bonnes pratiques d&apos;accessibilité est recommandée.
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
