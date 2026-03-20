import Link from "next/link";

/** Contenu aligné sur docs/Formulaire_Allie_Repit_Familles_Accueil.md — référence pour les candidat·e·s. */
export default function FormulaireAllieRepitPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-10 text-slate-300">
      <p className="text-sm text-cyan-400/90">
        <Link href="/devenir-allie" className="underline hover:text-cyan-300">
          ← Devenir allié
        </Link>
      </p>
      <h1 className="text-3xl font-bold text-white">Formulaire de candidature — Devenir allié(e) répit</h1>
      <p>
        Merci de votre intérêt à devenir un(e) allié(e) auprès des familles d&apos;accueil. Notre plateforme agit comme
        intermédiaire de mise en relation. Les ententes financières et contractuelles se font directement entre la famille
        et l&apos;allié(e). Nous recherchons des personnes bienveillantes, compétentes et engagées.
      </p>

      <section className="space-y-2 border-t border-slate-700 pt-6">
        <h2 className="text-xl font-semibold text-white">Section 1 — Informations générales</h2>
        <ul className="list-inside list-disc text-sm">
          <li>Nom complet, ville / secteur desservi, adresse</li>
          <li>Téléphone, courriel</li>
          <li>Confirmation 18 ans ou plus</li>
        </ul>
      </section>

      <section className="space-y-2 border-t border-slate-700 pt-6">
        <h2 className="text-xl font-semibold text-white">Section 2 — Vos compétences</h2>
        <ul className="list-inside list-disc text-sm">
          <li>Certification RCR / premiers secours, date d&apos;expiration</li>
          <li>Formation RCR Niveau C</li>
          <li>Expérience avec des enfants et expériences spécifiques (besoins particuliers, famille d&apos;accueil, traumas)</li>
          <li>Votre approche avec les enfants</li>
        </ul>
      </section>

      <section className="space-y-2 border-t border-slate-700 pt-6">
        <h2 className="text-xl font-semibold text-white">Section 3 — Votre offre de service</h2>
        <ul className="list-inside list-disc text-sm">
          <li>Types de répit : soirée, nuit, week-end, urgence / dépannage</li>
          <li>Âges acceptés, nombre maximal d&apos;enfants, secteur (distance)</li>
          <li>Taux horaire suggéré, disponibilités générales</li>
        </ul>
      </section>

      <section className="space-y-2 border-t border-slate-700 pt-6">
        <h2 className="text-xl font-semibold text-white">Section 4 — Vérifications et engagement</h2>
        <ul className="list-inside list-disc text-sm">
          <li>Antécédents judiciaires, références professionnelles, preuve RCR</li>
          <li>Déclarations sur l&apos;exactitude des informations, le rôle d&apos;intermédiaire de FAB, l&apos;entente financière directe avec la famille, et la visibilité du profil</li>
        </ul>
      </section>

      <div className="rounded-xl border border-cyan-500/30 bg-slate-800/50 p-4">
        <p className="text-sm text-slate-300">
          La version détaillée avec cases à cocher est disponible dans le dépôt du projet (
          <code className="text-cyan-300">docs/Formulaire_Allie_Repit_Familles_Accueil.md</code>). Sur le site, le même
          contenu est intégré à l&apos;étape par étape lors de l&apos;inscription.
        </p>
        <Link
          href="/onboarding/resource"
          className="mt-3 inline-flex rounded-md bg-cyan-700 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-600"
        >
          Commencer l&apos;inscription en ligne
        </Link>
      </div>
    </main>
  );
}
