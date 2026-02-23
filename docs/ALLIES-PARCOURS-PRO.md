# Parcours alliés — Mise au niveau « pro »

Document de planification pour porter le parcours **alliés** (inscription, profil, validation, communication) au niveau des meilleures pratiques. À cocher au fur et à mesure.

**Contexte** : Le parcours de base est en place (inscription gratuite, type, questionnaire, antécédents, modération admin, recherche/messages réservés aux alliés validés). Ce document décrit les **étapes supplémentaires** pour une expérience plus professionnelle, sécurisée et claire.

---

## Vue d’ensemble des phases

| Phase | Objectif | Priorité |
|-------|----------|----------|
| **1** | Sécurité & visibilité (fiche non publiée = 404) | Haute |
| **2** | Communication (email bienvenue, notification changement de statut) | Haute |
| **3** | Qualité des données (MaxLength, validation code postal) | Moyenne |
| **4** | UX allié (redirection post-inscription, bandeau statut, checklist) | Moyenne |
| **5** | Admin (indicateurs, filtres « nouveaux », compteurs) | Basse |

---

## Phase 1 — Sécurité & visibilité

**Objectif** : Un allié non publié (HIDDEN / non VERIFIED) ne doit pas être visible via la fiche publique. Seuls les alliés PUBLISHED + VERIFIED sont accessibles par ID aux non-admin.

### Livrables

- [x] **Backend** : Dans `ProfilesService.getResourcePublicOrPremium`, avant de retourner le profil :
  - Si le profil n’est pas `publishStatus === PUBLISHED` et `verificationStatus === VERIFIED`, lever `NotFoundException` (404) pour les appelants non-admin.
  - L’admin peut continuer à accéder au détail via la liste admin (pas via GET public).
- [x] **Frontend** : La page fiche allié (`/resource/[id]`) gère le 404 (message « Profil non disponible » ou « Allié introuvable ») sans exposer de détail.
- [ ] **Tests** : Vérifier qu’un appel GET `/profiles/resource/:id` pour un profil HIDDEN retourne 404 pour un utilisateur non connecté ou famille.

---

## Phase 2 — Communication

**Objectif** : Informer l’allié par email à des moments clés (bienvenue, changement de statut) pour un parcours transparent et professionnel.

### 2.1 Email de bienvenue (après inscription allié)

- [ ] **Backend** : Après création d’un compte RESOURCE dans `AuthService.register`, appeler `EmailService.send` (ou un service dédié « AlliéWelcomeEmail ») avec :
  - **To** : email de l’utilisateur.
  - **Sujet** : ex. « Bienvenue sur FAB — Prochaines étapes ».
  - **Contenu** : confirmation d’inscription, rappel des prochaines étapes (compléter le profil, questionnaire, engagement antécédents), lien vers la page Mon compte (URL frontend + conseil « Connectez-vous et allez dans Mon profil »).
- [ ] **Config** : S’assurer que `RESEND_API_KEY` et `EMAIL_FROM` sont configurés en production pour que l’email parte vraiment (sinon log uniquement, comme pour le reset de mot de passe).
- [ ] **Doc** : Mentionner dans README ou doc déploiement que l’email de bienvenue allié est envoyé si Resend est configuré.

### 2.2 Notification lors du changement de statut (validé / refusé / suspendu)

- [ ] **Backend** : Dans `ProfilesService.moderateResource` (et éventuellement `bulkModerateResources`), après la mise à jour du profil :
  - Récupérer l’email de l’utilisateur (via `resourceProfile.user.email`).
  - Selon le nouveau `verificationStatus` / `publishStatus` / `onboardingState`, envoyer un email :
    - **Validé + publié** : « Votre profil est maintenant visible dans le répertoire FAB. Les familles peuvent vous contacter. »
    - **Refusé** : « Votre demande d’inscription n’a pas pu être acceptée. Pour toute question : info@formeduc.ca. »
    - **Suspendu** : « Votre profil a été temporairement retiré du répertoire. Contact : info@formeduc.ca. »
- [ ] **Templates** : Créer des templates ou constantes HTML/text pour ces emails (sujet + corps), avec lien vers le site et coordonnées Forméduc.
- [ ] **Bulk** : Pour `bulkModerateResources`, envoyer un email par allié modéré (même contenu selon le statut appliqué).

---

## Phase 3 — Qualité des données

**Objectif** : Limiter les abus et garder des profils lisibles grâce à des règles de validation claires.

### 3.1 Limites de longueur (backend)

- [ ] **RegisterDto** : `displayName` → `@MaxLength(100)`. `bio` (optionnel) → `@MaxLength(2000)` si présent.
- [ ] **UpdateResourceProfileDto** : `displayName` → `@MaxLength(100)`. `bio` → `@MaxLength(2000)`.
- [ ] **UpdateFamilyProfileDto** : Idem pour cohérence (`displayName`, `bio`).
- [ ] **Messages d’erreur** : Retourner un message clair en français si la limite est dépassée (ex. « Le nom affiché ne peut pas dépasser 100 caractères. »).

### 3.2 Validation du code postal (Québec / Canada)

- [ ] **Backend** : Créer un validateur réutilisable (ex. `IsCanadianPostalCode()` ou validation dans le DTO) pour `postalCode` dans `RegisterDto` et dans les DTO de mise à jour de profil (famille et allié). Format : lettres-chiffres canadien (ex. G1R 4P5).
- [ ] **Frontend** : L’inscription et Mon compte affichent déjà une erreur si le backend rejette ; optionnel : validation côté client pour feedback immédiat (ex. regex + message « Code postal invalide (ex. G1R 4P5) »).

---

## Phase 4 — UX allié (Mon compte & parcours)

**Objectif** : Que l’allié sache où il en est et quoi faire ensuite.

### 4.1 Redirection après inscription

- [ ] **Frontend** : Après succès de l’inscription allié (`onRegister`), au lieu de rester sur la page avec uniquement le message de succès, faire une redirection vers **Mon compte** (`/me`) après 1–2 secondes (ou bouton « Compléter mon profil » qui mène à `/me`). Message de succès peut s’afficher sur `/me` via query param (ex. `?welcome=1`) ou state.

### 4.2 Bandeau / encart « Statut » sur Mon compte (allié)

- [ ] **Frontend** : Sur la page `/me`, pour les utilisateurs avec rôle RESOURCE, afficher en haut du bloc profil un **encart selon le statut** :
  - **PENDING_VERIFICATION** / **HIDDEN** : « Votre profil est en attente de validation. Complétez le questionnaire et confirmez votre engagement pour la vérification d’antécédents pour accélérer le traitement. »
  - **VERIFIED** + **PUBLISHED** : « Votre profil est visible dans le répertoire. Les familles peuvent vous contacter. »
  - **REJECTED** : « Votre demande n’a pas été acceptée. Pour toute question : info@formeduc.ca. »
  - **SUSPENDED** : « Votre profil est temporairement retiré du répertoire. Contact : info@formeduc.ca. »
- [ ] Texte et couleurs (ex. info = bleu, succès = vert, avertissement = orange) cohérents avec le design existant.

### 4.3 Checklist « À faire » (optionnel)

- [ ] **Frontend** : Pour les alliés en PENDING_VERIFICATION, afficher une petite checklist sur Mon compte :
  - [ ] Questionnaire complété (au moins X réponses ou « complété » selon règle métier).
  - [ ] Engagement vérification d’antécédents coché (backgroundCheckStatus === REQUESTED).
  - [ ] Profil à jour (optionnel : bio ou compétences renseignés).
- [ ] Affichage visuel (coches / pourcentage) pour encourager la complétion.

### 4.4 Page ou message « Compte refusé » (optionnel)

- [ ] Si le statut est REJECTED, optionnel : page dédiée `/compte-refuse` ou encart plein écran sur `/me` avec explication et contact, pour éviter que l’allié ne reste sans repère.

---

## Phase 5 — Admin (indicateurs & confort)

**Objectif** : Donner à l’admin une vue rapide pour traiter les alliés de manière efficace.

### 5.1 Compteurs par statut

- [ ] **Backend** : Endpoint ou champ dans l’existant (ex. `GET /profiles/resources/admin/stats`) retournant le nombre d’alliés par statut : `PENDING_VERIFICATION`, `VERIFIED`, `PUBLISHED`, `REJECTED`, `SUSPENDED` (ou regroupement pertinent).
- [ ] **Frontend (admin)** : En haut de l’onglet « Alliés », afficher des **badges ou compteurs** (ex. « 12 en attente », « 45 publiés », « 3 refusés ») pour prioriser le travail.

### 5.2 Filtre « Nouveaux » / « En attente depuis X jours »

- [ ] **Backend** : Dans `listResourcesForAdmin`, support d’un filtre optionnel `createdAfter` (date) ou `pendingSinceMoreThanDays` (nombre de jours en PENDING_VERIFICATION) pour repérer les inscriptions récentes ou les dossiers en attente depuis longtemps.
- [ ] **Frontend (admin)** : Filtre ou onglet « Nouveaux (7 derniers jours) » / « En attente &gt; 14 jours » pour faciliter le suivi.

### 5.3 Indicateur « Profil complet » (optionnel)

- [ ] **Règle métier** : Définir ce qu’est un profil « complet » (ex. questionnaire avec au moins N réponses, backgroundCheckStatus !== NOT_REQUESTED, bio non vide).
- [ ] **Backend** : Exposer un champ calculé `profileComplete: boolean` ou un indicateur dans la liste admin.
- [ ] **Frontend (admin)** : Afficher une pastille « Complet » / « Incomplet » pour prioriser les dossiers prêts à être validés.

---

## Ordre de réalisation suggéré

1. **Phase 1** (sécurité fiche) — rapide, impact direct sur la confidentialité.
2. **Phase 2.1** (email bienvenue) — bon retour pour l’allié dès l’inscription.
3. **Phase 3** (MaxLength, code postal) — évite les abus et incohérences.
4. **Phase 4.1 + 4.2** (redirection + bandeau statut) — clarté du parcours.
5. **Phase 2.2** (notification changement de statut) — transparence et confiance.
6. **Phase 4.3, 4.4, Phase 5** — selon priorité métier et temps disponible.

---

## Références

- Parcours de base : `docs/ALLIES-ETAPES.md`
- Conformité : `docs/cybersecurite/CONFORMITE-WEB-QUEBEC.md`
- Email (Resend) : `src/modules/email/email.service.ts`, `auth.service.ts` (requestPasswordReset)

---

*Document créé pour définir les étapes « parcours pro » alliés. Dernière mise à jour : février 2025.*
