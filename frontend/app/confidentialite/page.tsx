"use client";

import Link from "next/link";

export default function ConfidentialitePage() {
  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6 pb-16">
      <h1 className="text-2xl font-bold text-white">Politique de confidentialité</h1>
      <p className="text-sm text-slate-400">
        Dernière mise à jour : 14 février 2025. Le site FAB est opéré par Forméduc.
      </p>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-white">1. Qui sommes-nous ?</h2>
        <p className="text-slate-300">
          Le responsable du traitement des données est <strong>Forméduc</strong>. Adresse : 5121 boul. Chauveau Ouest, Québec, QC G2E 5A6 local 101. Contact : 418 842-7523, info@formeduc.ca.
          Pour toute question sur vos données ou pour exercer vos droits, vous pouvez contacter Forméduc à info@formeduc.ca.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-white">2. À qui s&apos;applique cette politique ?</h2>
        <p className="text-slate-300">
          Cette politique s&apos;applique au site FAB (Famille d&apos;accueil branchée) et à toutes les données personnelles collectées via ce site : personnes inscrites comme famille ou allié, visiteurs qui nous contactent. Elle décrit quelles données nous recueillons, pour quelles fins, qui y a accès, combien de temps nous les conservons et quels sont vos droits.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-white">3. Quelles données collectons-nous ?</h2>
        <p className="text-slate-300">
          <strong>Familles :</strong> courriel, mot de passe (stocké de manière sécurisée), nom affiché, code postal, ville, région, bio, besoins, disponibilités, informations d&apos;abonnement.
        </p>
        <p className="text-slate-300">
          <strong>Alliés :</strong> courriel, mot de passe (stocké de manière sécurisée), nom affiché, code postal, ville, région, bio, compétences, tarif horaire, coordonnées de contact, type d&apos;allié, réponses au questionnaire, statut de vérification d&apos;antécédents, disponibilités.
        </p>
        <p className="text-slate-300">
          <strong>Messages :</strong> contenu des échanges entre familles et alliés via la plateforme.
        </p>
        <h3 id="cookies" className="text-base font-medium text-cyan-300 pt-2">
          Cookies et traceurs
        </h3>
        <p className="text-slate-300">
          Nous utilisons uniquement des <strong>cookies strictement nécessaires</strong> au fonctionnement du site : cookie de session (ex. <em>refresh_token</em>) pour maintenir votre connexion. Aucun consentement n&apos;est requis pour ces cookies. Nous n&apos;utilisons pas de cookies publicitaires, analytiques ou de traceurs à des fins de ciblage tiers. Vous pouvez à tout moment consulter cette section ou le bandeau d&apos;information en pied de page pour en savoir plus.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-white">4. Répertoire et base de données (alliés et familles)</h2>
        <h3 className="text-base font-medium text-cyan-300">4.1 Finalités</h3>
        <p className="text-slate-300">
          Les données sont enregistrées pour : créer et gérer votre compte ; publier votre profil dans le répertoire afin de permettre la mise en relation entre familles et alliés ; permettre les échanges (messages) ; vérifier et modérer les comptes ; administrer le site. Nous n&apos;utilisons pas vos données pour de la prospection non sollicitée, de la revente de listes ou du ciblage publicitaire par des tiers.
        </p>
        <h3 className="text-base font-medium text-cyan-300">4.2 Qui peut voir quelles données ?</h3>
        <p className="text-slate-300">
          <strong>Profils d&apos;alliés :</strong> les familles disposant d&apos;un abonnement actif peuvent voir les profils publics des alliés (nom, ville, région, code postal, compétences, tarif, bio, coordonnées si rendues visibles).
        </p>
        <p className="text-slate-300">
          <strong>Profils de familles :</strong> les alliés voient les informations des familles avec lesquelles ils sont déjà en conversation.
        </p>
        <p className="text-slate-300">
          <strong>Messages :</strong> seuls les participants à une conversation et l&apos;administrateur (modération, support) peuvent y accéder.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-white">5. Combien de temps conservons-nous vos données ?</h2>
        <p className="text-slate-300">
          Vos données sont conservées tant que votre compte est actif. À la demande de suppression de votre compte, nous supprimons vos données personnelles dans les 30 jours, sauf données que nous devons conserver en vertu de la loi ou données anonymisées à des fins statistiques.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-white">6. Transfert des données hors du Québec</h2>
        <p className="text-slate-300">
          Les données sont hébergées au Canada. Lorsque nous faisons appel à des prestataires hors du Québec, nous nous assurons que des garanties appropriées sont en place. Nous ne vendons pas vos données.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-white">7. Sécurité</h2>
        <p className="text-slate-300">
          Nous mettons en place des mesures techniques et organisationnelles pour protéger vos données. En cas d&apos;incident susceptible d&apos;affecter vos données, nous documentons l&apos;incident et, lorsque la loi l&apos;exige, nous notifions la Commission d&apos;accès à l&apos;information du Québec (CAI) et les personnes concernées.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-white">8. Vos droits</h2>
        <p className="text-slate-300">
          Vous pouvez : <strong>accéder</strong> à vos données (obtenir une copie) ; les <strong>rectifier</strong> (via Mon compte ou en nous contactant) ; <strong>retirer votre consentement</strong> (ex. ne plus figurer au répertoire) ; <strong>demander la suppression de votre compte</strong> (bouton dans Mon compte ou courriel à info@formeduc.ca). Nous nous engageons à répondre dans un délai raisonnable. Vous avez le droit de porter plainte devant la CAI.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-white">9. Modifications</h2>
        <p className="text-slate-300">
          Nous pouvons modifier cette politique. Les changements seront publiés sur cette page avec une nouvelle date de mise à jour. En cas de changement important, nous pourrons vous en informer par courriel ou message sur le site.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-white">10. Nous contacter</h2>
        <p className="text-slate-300">
          Forméduc — 5121 boul. Chauveau Ouest, Québec, QC G2E 5A6 local 101. Téléphone : 418 842-7523. Courriel : info@formeduc.ca. Pour toute question relative à la protection des renseignements personnels : info@formeduc.ca.
        </p>
      </section>

      <p className="pt-4 text-sm text-slate-500">
        Ce document est fourni à titre informatif. Pour une conformité juridique complète, consultez un avocat ou un professionnel spécialisé en protection des renseignements personnels au Québec.
      </p>
      <p className="pt-2">
        <Link href="/" className="text-cyan-400 hover:text-cyan-300">
          ← Retour à l&apos;accueil
        </Link>
      </p>
    </main>
  );
}
