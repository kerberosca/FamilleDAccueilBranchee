# Audit debug local - 2026-05-07

## Contexte

- Nouvelle reprise de l'audit apres commit/push des corrections.
- Branche locale: `main`
- Alignement GitHub: `main...origin/main = 0 / 0` apres `git fetch origin main`
- Working tree: propre
- Docker local:
  - `fab-backend-dev`: up, healthy, port 3000
  - `fab-frontend-dev`: up, port 3002
  - `postgres`: up, healthy, port 5432

## Validations effectuees

- Sanity local:
  - `GET http://localhost:3000/api/v1/health`: OK
  - `GET http://localhost:3002`: HTTP 200
- Pages publiques chargees en HTTP 200:
  `/`, `/devenir-allie`, `/formulaire-allie`, `/formulaire-allie-repit`, `/onboarding`, `/onboarding/family`, `/onboarding/resource`, `/onboarding/admin`, `/login`, `/forgot-password`, `/reset-password`, `/search`, `/dev`, `/cgu`, `/confidentialite`, `/droits`, `/mentions-legales`, `/accessibilite`.
- Pages protegees redirigent vers login sans session:
  `/me`, `/me/ally-candidature`, `/messages`, `/admin`.
- API validee avec comptes dev seed:
  - `POST /api/v1/dev/login-as` pour `ADMIN`, `FAMILLE`, `RESSOURCE`: OK
  - `GET /api/v1/users/me`: OK
  - `GET /api/v1/profiles/me`: OK
  - `GET /api/v1/search/resources`: OK
  - `GET /api/v1/profiles/resource/:id`: OK avec token famille
  - `POST /api/v1/messaging/conversations`: OK
  - `GET /api/v1/messaging/conversations/:id`: OK famille et ressource
  - `POST /api/v1/messaging/conversations/:id/messages`: OK famille et ressource
  - `GET /api/v1/users/families`: OK
  - `GET /api/v1/profiles/resources/admin`: OK
  - `GET /api/v1/users/admin/audit`: OK
  - `GET /api/v1/maintenance/status`: OK
  - `POST /api/v1/auth/request-password-reset`: OK
- Parcours UI cible:
  - Detail allie connecte famille: OK, un seul appel API `200`
  - Bouton `Contacter cet allie`: OK, navigation vers `/messages?contact=...`
  - Tarif horaire du detail allie: OK, affiche `30 $`
  - Page admin avec token admin: OK
  - Page messages ressource: OK
  - Console navigateur pendant les parcours connectes: aucune erreur/warning observe
- Build/typecheck/tests:
  - `npx tsc --noEmit`: OK
  - `npm --prefix frontend run build`: OK
  - `npm run test:e2e -- --runInBand` depuis Windows: OK, 15/15

## Derniere passe debug

### Resume

- Git local et GitHub: alignes.
- Docker local: backend, frontend et Postgres en ligne.
- Pages publiques: HTTP 200.
- Pages protegees sans session: redirection login attendue.
- API metier: OK.
- Parcours connectes: OK.
- Tests automatises: OK.
- Probleme bloquant restant: aucun observe.

## Debug cible 1 - Inscription Allie

### Objectif

Valider le parcours complet de creation d'un allie depuis `/onboarding/resource`, puis verifier le compte, le profil, les statuts, la moderation admin et la visibilite en recherche.

### Parcours UI complet teste

- Page `/onboarding/resource`: OK
- Validation formulaire compte vide: OK, message `Courriel requis.`
- Creation allie type `Tutorat`: OK
- Etapes wizard validees:
  - Compte
  - Type & lieu
  - Informations generales
  - Competences
  - Offre de service
  - Engagement
  - Recapitulatif
- Soumission finale: OK
- Message de succes visible:
  `Candidature enregistree. Votre profil est en attente de validation.`
- Session creee apres inscription: OK
- Console navigateur pendant le parcours: aucune erreur/warning observe

### Donnees creees pendant le test UI

- Email: `audit.allie.1778199915702@local.test`
- Display name: `Audit Allie 1778199915702`
- Type: `AUTRES` / Tutorat
- Code postal: `H4Z1A1`
- Tarif: `32`

### Verifications apres creation

- `GET /api/v1/users/me`: OK
  - Role: `RESOURCE`
  - Statut compte: `ACTIVE`
- `GET /api/v1/profiles/me`: OK
  - `allyType`: `AUTRES`
  - `hourlyRate`: `32`
  - `verificationStatus`: `PENDING_VERIFICATION`
  - `publishStatus`: `HIDDEN`
  - `onboardingState`: `PENDING_VERIFICATION`
  - `backgroundCheckStatus`: `REQUESTED`
  - `allyRegistration`: present
  - `skillsTags`: generes automatiquement
- Recherche avant moderation:
  - `GET /api/v1/search/resources?postalCode=H4Z&page=1`: OK
  - L'allie cree n'est pas visible: OK attendu, car profil encore cache/en attente
- Admin:
  - `GET /api/v1/profiles/resources/admin?query=Audit Allie ...`: OK
  - L'allie cree est visible dans la liste admin avec les statuts attendus
- Moderation admin:
  - Payload valide utilise: `verificationStatus=VERIFIED`, `publishStatus=PUBLISHED`, `onboardingState=PUBLISHED`, `backgroundCheckStatus=RECEIVED`
  - `PATCH /api/v1/profiles/resource/:id/moderation`: OK
- Recherche apres moderation:
  - L'allie cree devient visible: OK
  - Contacts visibles en acces admin: OK
  - `hourlyRate` renvoye comme nombre: OK

### Variantes type allie testees via API

- `GARDIENS`: OK
  - Compte `RESOURCE` cree
  - Profil cree avec `allyType=GARDIENS`
  - `hourlyRate=29`
  - Statuts initiaux attendus: `PENDING_VERIFICATION`, `HIDDEN`, `PENDING_VERIFICATION`, `REQUESTED`
  - Tags generes incluant `Gardien competent`
- `MENAGE`: OK
  - Compte `RESOURCE` cree
  - Profil cree avec `allyType=MENAGE`
  - `hourlyRate=35`
  - Statuts initiaux attendus: `PENDING_VERIFICATION`, `HIDDEN`, `PENDING_VERIFICATION`, `REQUESTED`
  - Tags generes incluant `Entretien Menage`

### Notes du debug cible

- Une tentative de moderation avec `backgroundCheckStatus=APPROVED` retourne `400`, ce qui est attendu: l'enum valide est `NOT_REQUESTED`, `REQUESTED`, `PENDING`, `RECEIVED`.
- Le test UI a cree des donnees locales de debug dans la base Docker. Elles sont utiles pour l'audit local, mais ne doivent pas etre seed prod.
- Aucun probleme bloquant observe sur le flux inscription allie.

## Debug cible 2 - Inscription Famille

### Objectif

Valider le parcours complet de creation d'une famille depuis `/onboarding/family`, puis verifier le profil famille, le checkout abonnement, l'activation mock, l'acces premium a la recherche et la possibilite de contacter un allie.

### Parcours UI complet teste

- Page `/onboarding/family`: OK
- Etat initial:
  - Bouton `Creer mon compte FAMILY`: desactive tant que la politique n'est pas acceptee
  - Bouton `Activer l'abonnement FAMILY`: desactive tant qu'aucune session famille n'est presente
- Formulaire rempli avec donnees uniques: OK
- Force mot de passe affichee: OK
- Soumission creation famille: OK
- Message de succes visible:
  `Compte FAMILY cree. Vous pouvez maintenant lancer le paiement d'abonnement.`
- Session creee apres inscription: OK
- Console navigateur pendant le parcours reussi: aucune erreur/warning observe

### Donnees creees pendant le test UI

- Email: `audit.famille.1778200237776@local.test`
- Display name: `Audit Famille 1778200237776`
- Code postal: `H2X1Y4`
- Besoins/tags: `Tutorat`, `Gardien competent`

### Verifications apres creation

- `GET /api/v1/users/me`: OK
  - Role: `FAMILY`
  - Statut compte: `ACTIVE`
- `GET /api/v1/profiles/me`: OK
  - `displayName`: present
  - `postalCode`: `H2X1Y4`
  - `city`: `Montreal`
  - `region`: `QC`
  - `bio`: present
  - `needsTags`: present
- Recherche avant activation abonnement:
  - `GET /api/v1/search/resources?postalCode=H2X&page=1`: OK
  - `limitedPreview=true`
  - Contacts masques: OK attendu
- Checkout famille:
  - `POST /api/v1/billing/family/checkout-session`: OK
  - Session mock creee: `cs_mock_...`
  - URL mock retournee: `/onboarding?mockCheckout=1`
- Bouton UI `Activer l'abonnement FAMILY`:
  - OK avec une session famille dev valide
  - Redirection confirmee vers `/onboarding?mockCheckout=1`
- Activation mock:
  - `POST /api/v1/billing/family/mock-activate`: OK
  - Reponse: `{ success: true }`
- Recherche apres activation mock:
  - `limitedPreview=false`
  - Contacts visibles: OK
  - `hourlyRate` renvoye comme nombre: OK
- Detail allie avec famille abonnee:
  - `GET /api/v1/profiles/resource/:id`: OK
  - Contact email/telephone visibles: OK
- Messagerie:
  - `POST /api/v1/messaging/conversations`: OK
  - Conversation creee avec message initial: OK
  - `GET /api/v1/messaging/conversations/:id`: OK
- Admin:
  - La famille creee est visible dans `/users/families` via recherche admin: OK

### Observations du debug cible

- Les inscriptions rapides et repetees declenchent `429 ThrottlerException`, ce qui est attendu vu le rate limit de `/auth/register`.
- En dev local, le checkout mock redirige vers `/onboarding?mockCheckout=1`, mais l'activation effective de l'abonnement a ete verifiee via l'endpoint mock `/billing/family/mock-activate`.
- Aucun probleme bloquant observe sur le flux inscription famille.

## Debug cible 3 - Connexion / Session

### Objectif

Valider l'authentification, les routes protegees, les roles, le refresh, le logout, les comptes bannis et le mode maintenance.

### API auth/session testee

- Login invalide:
  - `POST /api/v1/auth/login` avec mauvais mot de passe: `401`
  - Message: `Email ou mot de passe incorrect`
- Logins valides:
  - `famille@local.test`: OK, role `FAMILY`
  - `ressource@local.test`: OK, role `RESOURCE`
  - `admin@local.test`: OK, role `ADMIN`
- `GET /api/v1/users/me`:
  - OK pour famille, ressource et admin avec token valide
- Routes admin:
  - Sans token: `403 Unauthorized`
  - Avec famille: `403 Insufficient role`
  - Avec ressource: `403 Insufficient role`
  - Avec admin: OK
- Refresh:
  - Refresh par cookie `refresh_token`: OK
  - Refresh par body apres login standard: non applicable, car `POST /auth/login` ne renvoie pas le refresh token dans le JSON, seulement en cookie httpOnly
- Logout:
  - `POST /api/v1/auth/logout`: OK
  - Le refresh token est invalide/efface cote serveur
  - L'access token deja emis reste techniquement valide jusqu'a expiration, comportement attendu avec JWT stateless court terme

### Comptes bannis

- Creation d'une famille de test: OK
- Passage du statut a `BANNED` via admin: OK
- Login du compte banni: `401`
- Message: `Compte desactive. Contactez l'administrateur.`

### Maintenance

- Activation maintenance par admin: OK
- Login famille pendant maintenance: `503`
- Message: `Connexion impossible pendant la maintenance.`
- Login admin pendant maintenance: OK
- Desactivation maintenance par admin: OK
- Statut final maintenance: `enabled=false`

### Parcours UI verifies

- Acces `/me` sans session:
  - Redirection vers `/login?next=%2Fme`: OK
- Login famille via UI:
  - Session creee: OK
  - Reload de `/me`: session conservee: OK
- Logout via UI:
  - Token local retire: OK
  - Retour sur `/me` redirige vers login: OK
- Acces `/admin` avec compte famille:
  - Page admin charge mais affiche `Acces refuse : ce compte n'est pas ADMIN.`: OK

### Observations du debug cible

- Les tests repetes de login/register peuvent declencher le throttler `429`, ce qui est attendu. Pour isoler les cas banni/maintenance, l'API a ete redemarree afin de vider le throttler memoire.
- Les erreurs `401` visibles en console lors des redirections de pages protegees sans session sont attendues.
- Aucun probleme bloquant observe sur le flux connexion/session.

## Debug cible 4 - Recherche Allies

### Objectif

Valider la recherche d'allies en public, famille sans abonnement, famille abonnee, ressource et admin. Verifier la normalisation du code postal, les filtres d'etiquettes, la pagination/preview, l'exposition des contacts et le lien vers le detail allie.

### API recherche testee

- Public, `postalCode=H2X`: OK
  - `totalFound=1`
  - `limitedPreview=true`
  - `pageSize=3`
  - Contacts masques: OK attendu
  - `hourlyRate` renvoye comme nombre: OK
- Public, code postal complet `H2X1Y4`: OK
- Public, code postal avec espace/minuscules `h2x 1y4`: OK, normalise cote API
- Public, `postalCode=H3B&tags=Tutorat`: OK
  - Ressource locale retournee
  - Contacts masques: OK attendu
- Public, `postalCode=H3B&tags=tutorat`: reponse OK mais `totalFound=0`
  - Probleme observe: le filtre d'etiquettes est sensible a la casse
- Public, `postalCode=H2X&tags=Gardien competent`: OK
- Public, parametre non supporte `radiusKm=50`: `400`, attendu avec DTO strict
- Famille abonnee, `postalCode=H2X`: OK
  - `limitedPreview=false`
  - `pageSize=10`
  - Contacts visibles: OK
- Famille abonnee, page 2: OK, pagination disponible, aucun resultat additionnel dans le seed local
- Famille sans abonnement: OK
  - `limitedPreview=true`
  - Contacts masques: OK attendu
- Ressource connectee: OK
  - Preview limitee, contacts masques: OK attendu
- Admin, recherche `postalCode=H2X`: OK
  - `limitedPreview=false`
  - Contacts visibles dans les resultats de recherche: OK

### API detail allie testee depuis la recherche

- Public, `GET /api/v1/profiles/resource/:id`: `403 Unauthorized`
  - Probleme observe: le lien public `Voir le profil` existe dans les resultats, mais le detail public n'est pas accessible.
- Famille sans abonnement, `GET /api/v1/profiles/resource/:id`: OK
  - Detail public retourne sans contacts: OK attendu
- Famille abonnee, `GET /api/v1/profiles/resource/:id`: OK
  - Detail retourne avec email et telephone: OK
- Admin, `GET /api/v1/profiles/resource/:id`: OK
  - Probleme observe: le detail admin ne retourne pas les contacts, alors que la recherche admin les expose.

### Parcours UI public verifies

- Page `/search`: OK
- Recherche initiale par defaut `H2X1Y4`: OK
  - Total affiche
  - Mode apercu actif affiche
  - Contacts masques
- Code postal invalide `12`:
  - Bouton `Rechercher` desactive: OK
- Recherche `H2X`: OK
  - Resultat `Alex` visible
  - Contacts masques
- Recherche `H3B` avec etiquette `tutorat`:
  - Aucun resultat affiche
  - Probleme observe: l'exemple de placeholder suggere `tutorat` en minuscule, mais le seed `Tutorat` ne matche pas
- Recherche `H3B` avec etiquette `Tutorat`:
  - Resultat `Ressource Locale` visible
  - Contacts masques
- Clic/lien `Voir le profil` en public:
  - Page detail chargee mais affiche `Unauthorized`
  - Console navigateur: `403 Forbidden`

### Parcours UI famille abonnee verifies

- Session famille dev injectee avec `fab.dev.access_token`: OK
- `/search?postalCode=H3B&page=1`: OK
  - Mode apercu absent
  - Contacts visibles: `ressource@local.test`, `514-555-0000`
- Recherche `H3B` avec etiquette `tutorat`:
  - Aucun resultat affiche
  - Meme probleme de casse que le parcours public
- Recherche `H3B` avec etiquette `Tutorat`:
  - Resultat visible
  - Contacts visibles
- Lien `Voir le profil`:
  - Detail `Ressource Locale` affiche
  - Tarif `30 $` affiche
  - Email et telephone visibles
  - Bouton `Contacter cet allie` visible
- Console navigateur pendant le parcours famille: aucune erreur/warning observe

### Problemes observes sur la cible 4

#### P2 - Le detail public d'un allie affiche `Unauthorized`

**Surface:** `/search` -> lien `Voir le profil` -> `/resource/:id`

**Symptome:** un visiteur public voit des cartes d'allies en mode apercu, avec un lien `Voir le profil`, mais le detail retourne `403 Unauthorized` et l'UI affiche seulement `Unauthorized`.

**Impact:** parcours public casse. L'utilisateur peut rechercher, mais ne peut pas consulter le profil public d'un allie depuis le resultat.

**Hypothese:** l'endpoint `GET /profiles/resource/:id` n'est pas expose comme route publique, meme si le service sait deja masquer les champs sensibles selon le role et l'abonnement.

#### P2 - Recherche par etiquette sensible a la casse

**Surface:** `/search`, champ `Etiquettes`

**Symptome:** `tags=Tutorat` retourne `Ressource Locale`, mais `tags=tutorat` retourne `0` resultat. Le placeholder UI donne pourtant des exemples en minuscules: `gardien, menage, tutorat`.

**Impact:** recherche fragile pour les familles. Une saisie naturelle en minuscules donne un faux "aucun resultat".

**Hypothese:** le filtre utilise une comparaison exacte/case-sensitive sur les tags.

#### P3 - Detail admin sans contacts, recherche admin avec contacts

**Surface:** API admin recherche vs API admin detail allie

**Symptome:** la recherche admin expose `contactEmail` et `contactPhone`, mais `GET /profiles/resource/:id` avec token admin ne retourne pas ces champs.

**Impact:** incoherence admin. Pas bloquant pour la recherche famille, mais surprenant pour une console d'administration.

**Hypothese:** la logique de visibilite des contacts dans le detail n'inclut que les familles abonnees, pas le role admin.

### Correctifs appliques sur la cible 4

- Detail public allie:
  - `GET /api/v1/profiles/resource/:id` est maintenant accessible sans session via JWT optionnel.
  - Le detail public retourne les informations publiques et masque toujours les contacts.
  - Retest UI: `/search?postalCode=H3B&tags=tutorat&page=1` -> `Voir le profil` affiche `Ressource Locale`, sans `Unauthorized`.
- Recherche par etiquette:
  - Le filtre tags est maintenant normalise cote backend: casse et accents ignores.
  - Retest API: `tags=tutorat` retourne `Ressource Locale`.
  - Retest UI: `tutorat` en minuscule retourne bien le resultat attendu.
- Detail admin:
  - Le role `ADMIN` a maintenant acces aux champs sensibles dans le detail allie, comme dans les resultats de recherche.
  - Retest API: detail admin retourne `contactEmail=ressource@local.test` et `contactPhone=514-555-0000`.

### Tests apres correctifs cible 4

- `npx tsc --noEmit`: OK
- `npm --prefix frontend run build`: OK
- `npm run test:e2e -- --runInBand`: OK, 18/18
- Docker local:
  - `fab-backend-dev`: up, healthy
  - `fab-frontend-dev`: up
  - `postgres`: up, healthy

## Debug cible 6 - Messagerie / Contact Allie

### Objectif

Valider le parcours de contact d'un allie depuis la fiche profil, la creation/reutilisation de conversation, l'envoi de messages famille et allie, l'acces lecture seule admin, ainsi que les protections sans session, sans abonnement et cross-user.

### API messagerie testee

- Sans token:
  - `GET /api/v1/messaging/conversations`: `403 Unauthorized`, OK attendu
- Creation conversation:
  - Role `RESOURCE`: `403 Only FAMILY can initiate a conversation`, OK attendu
  - Role `ADMIN`: `403 Only FAMILY can initiate a conversation`, OK attendu
  - Famille abonnee vers `Ressource Locale`: `201`, conversation creee/reutilisee
  - Deuxieme creation famille vers le meme allie: `201`, meme conversation reutilisee et nouveau message initial ajoute
- Listes:
  - Famille abonnee: `GET /messaging/conversations` OK, conversations famille visibles
  - Allie ressource: `GET /messaging/conversations` OK, conversations de l'allie visibles
  - Admin: `GET /messaging/conversations` OK, toutes les conversations visibles
- Detail conversation:
  - Famille proprietaire: OK
  - Allie proprietaire: OK
  - Admin: OK, lecture seule
- Envoi de message:
  - Famille abonnee: `POST /messaging/conversations/:id/messages` OK
  - Allie ressource: `POST /messaging/conversations/:id/messages` OK
  - Admin: `403 Les comptes administrateur ont un acces en lecture seule aux conversations`, OK attendu
- Validations DTO:
  - Creation avec `initialMessage=""`: `400`, OK attendu
  - Envoi avec `content=""`: `400`, OK attendu
- Conversation inexistante:
  - `GET /messaging/conversations/not-a-real-id`: `404 Conversation not found`, OK attendu
- Famille sans abonnement:
  - Creation conversation: `403 Family subscription is required to contact resources`, OK attendu
- Cross-user:
  - Autre famille abonnee tente de lire une conversation existante: `403 Not part of this conversation`, OK attendu
  - Autre famille abonnee tente d'envoyer dans cette conversation: `403 Not part of this conversation`, OK attendu
- Allie non publie/cache:
  - Famille abonnee tente de contacter `Audit MENAGE ...` en `HIDDEN`: `403 Resource is not available for contact`, OK attendu

### Parcours UI verifies

- Acces `/messages` sans session:
  - Redirection vers `/login`: OK
  - Console: erreurs `401` attendues pendant la verification de session
- Famille abonnee:
  - Fiche `/resource/cmlmyytv1000dhciufvm1df9d`: bouton `Contacter cet allie` visible
  - Clic `Contacter cet allie`: navigation vers `/messages?contact=cmlmyytv1000dhciufvm1df9d`
  - Bloc `Nouvelle conversation` visible
  - Message initial envoye: redirection vers `/messages/:conversationId`
  - Conversation affichee avec le message initial: OK
  - Envoi d'un nouveau message famille: OK, message visible dans le fil
- Allie ressource:
  - Ouverture directe de la meme conversation: OK
  - Libelle interlocuteur famille visible: OK
  - Envoi d'une reponse allie: OK, message visible dans le fil
- Admin:
  - Ouverture de la conversation: OK
  - Message `Lecture seule : les administrateurs ne peuvent pas envoyer de messages ici.` visible
  - Aucun champ `Votre message` disponible: OK

### Observations cible 6

- La conversation famille/allie est unique par couple `familyId/resourceId`; une nouvelle tentative de contact ajoute un message dans la conversation existante plutot que de creer un doublon. Comportement conforme au `upsert`.
- Les messages de validation DTO sont en anglais (`initialMessage must be longer than or equal to 1 characters`, `content must be longer than or equal to 1 characters`). Ce n'est pas bloquant, mais a harmoniser plus tard si on veut une UX 100% francaise.
- Les donnees de test locales ont ajoute quelques messages `audit 5 ...` dans la base Docker.
- Aucun probleme bloquant observe sur le flux messagerie/contact.

### Reste a completer selon checklist cible 6

- RESOLU / valide:
  - Liste conversations triee par activite recente: apres ajout d'un message recent dans la conversation `Ressource Locale`, cette conversation remonte en premiere position cote famille et cote ressource.

## Debug cible 7 - Console Admin / Moderation

### Objectif

Valider les protections de la console admin, les listes familles/allies/audit, les filtres/pagination, les actions de statut famille, la moderation allie, l'audit log et les garde-fous contre les roles non-admin.

### API admin testee

- Protections:
  - `GET /api/v1/users/families` sans token: `403 Unauthorized`, OK attendu
  - `GET /api/v1/users/families` avec token famille: `403 Insufficient role`, OK attendu
  - `GET /api/v1/profiles/resources/admin` avec token ressource: `403 Insufficient role`, OK attendu
  - `GET /api/v1/users/admin/audit` avec token famille: `403 Insufficient role`, OK attendu
- Familles:
  - `GET /users/families?page=1&pageSize=5&sortBy=email&sortOrder=asc`: OK
  - Recherche `query=famille`: OK
  - Pagination hors bornes `page=-2&pageSize=999`: OK, clamp vers `page=1`, `pageSize=50`
  - Creation famille locale `audit6.family...`: OK
  - Bannissement individuel: OK, statut `BANNED`
  - Login compte banni: `401 Compte desactive. Contactez l'administrateur.`, OK attendu
  - Reactivation individuelle: OK, statut `ACTIVE`
  - Bannissement bulk puis reactivation bulk: OK, `updatedCount=1`
  - Statut invalide: `400`, OK attendu
  - Tentative famille de changer un statut: `403 Insufficient role`, OK attendu
- Roles:
  - Role invalide: `400`, OK attendu
  - Mise a jour noop `FAMILY -> FAMILY` sur compte de test: OK
  - Garde-fou dernier admin non teste destructivement, mais present dans le service (`Impossible de retirer le dernier administrateur.`)
- Allies:
  - `GET /profiles/resources/admin?page=1&pageSize=5&sortBy=displayName&sortOrder=asc`: OK
  - Filtre `verificationStatus=VERIFIED&publishStatus=PUBLISHED`: OK
  - Recherche `query=Ressource`: OK
  - Selection d'un allie local `HIDDEN` (`Audit MENAGE ...`): OK
  - Moderation admin vers `VERIFIED/PUBLISHED/PUBLISHED` + `backgroundCheckStatus=RECEIVED`: OK
  - Restauration des statuts originaux de cet allie: OK
  - Tentative famille de moderer un allie: `403 Insufficient role`, OK attendu
  - Moderation bulk avec liste vide: `400`, OK attendu
  - Tentative famille de supprimer un allie: `403 Insufficient role`, OK attendu
  - Suppression admin d'un id inexistant: `404 Profil allie introuvable.`, OK attendu
- Audit log:
  - `GET /users/admin/audit?page=1&pageSize=5`: OK
  - Apres actions admin, le total augmente et les actions recentes incluent `RESOURCE_MODERATED`, `USER_STATUS_UPDATED`, `USER_STATUS_BULK_UPDATED`, `USER_ROLE_UPDATED`: OK
- Maintenance:
  - Statut final verifie apres audit: `enabled=false`

### Parcours UI verifies

- `/admin` avec token famille:
  - Page chargee mais affiche `Acces refuse : ce compte n'est pas ADMIN.`: OK
- `/admin` avec token admin:
  - H1 `Console Admin`: OK
  - Bloc `Mode maintenance`: visible
  - Onglet `Familles`: visible, liste et abonnement visibles
  - Onglet `Allies`: visible
  - Filtre allies `Audit MENAGE`: OK, resultat visible
  - Boutons `Approuver selection`, `Rejeter selection`, `Supprimer (effacer de la base)`: visibles
  - Onglet `Audit`: visible, actions admin recentes affichees
  - Console navigateur pendant le parcours admin: aucune erreur/warning observee

### Observations cible 7

- Les erreurs DTO admin invalides sont encore en anglais (`status must be one of...`, `role must be one of...`, `resourceIds must contain...`). Non bloquant, meme observation UX que la cible messagerie.
- L'action `Supprimer (effacer de la base)` est visible et protegee par confirmation dans le frontend; l'audit n'a pas supprime de vrai allie local pour eviter de perdre des donnees de test utiles.
- Les actions admin ont cree des entrees d'audit et une famille locale `audit6.family...` dans la base Docker.
- Aucun probleme bloquant observe sur la console admin/moderation.

### Reste a completer selon checklist cible 7

- RESOLU / valide:
  - Bulk moderation allie avec vraie selection non vide: OK, `updatedCount=1`, passage a `VERIFIED/PUBLISHED/PUBLISHED` + `RECEIVED`, puis restauration des statuts originaux OK.
  - Suppression allie sur un allie jetable `Audit67 Delete ...`: OK, suppression `success=true`, verification admin ensuite `total=0`.
  - Maintenance `on/off`: OK, activation `enabled=true`, desactivation `enabled=false`, statut final `enabled=false`.
  - Audit log apres actions admin: OK, actions recentes incluant `RESOURCE_DELETED` et `RESOURCE_BULK_MODERATED`.

## Debug cible 8 - Paiement / Abonnement

### Objectif

Valider les checkouts famille/ressource, le mode mock en dev, l'activation abonnement, les webhooks Stripe et la perte d'acces premium quand l'abonnement n'est plus actif.

### Donnees creees pendant le test

- Famille jetable: `audit8.family...@local.test`
- Ressource jetable: `audit8.resource...@local.test`
- Famille webhook jetable: `audit8.webhook.family...@local.test`
- Les donnees sont restees dans la base Docker locale pour tracabilite d'audit.

### API checkout testee

- Famille checkout:
  - `POST /api/v1/billing/family/checkout-session` avec token famille: `201`
  - `sessionId`: `cs_mock_...`
  - `checkoutUrl`: `http://localhost:3002/onboarding?mockCheckout=1`
  - Mode mock dev confirme
- Ressource checkout:
  - `POST /api/v1/billing/resource/checkout-session` avec token ressource: `201`
  - `sessionId`: `cs_mock_...`
  - `checkoutUrl`: `http://localhost:3002/onboarding?mockCheckout=1`
  - Mode mock dev confirme
  - Apres checkout, profil ressource jetable:
    - `onboardingState=PENDING_PAYMENT`
    - `verificationStatus=PENDING_VERIFICATION`
    - `publishStatus=HIDDEN`
- Protections roles checkout:
  - Ressource vers checkout famille: `403 Insufficient role`, OK attendu
  - Famille vers checkout ressource: `403 Insufficient role`, OK attendu

### Endpoint mock activation teste

- Sans token:
  - `POST /billing/family/mock-activate`: `403 Unauthorized`, OK attendu
- Token ressource:
  - `POST /billing/family/mock-activate`: `403 Insufficient role`, OK attendu
- Token famille:
  - `POST /billing/family/mock-activate`: `201`, `{ success: true }`
  - Subscription creee en base: `status=ACTIVE`, `stripeSubscriptionId=sub_mock_...`
  - Recherche premium apres activation mock:
    - `limitedPreview=false`
    - Contacts visibles: OK

### Abonnement actif / expire / inactif

- Subscription famille jetable active via mock:
  - Recherche famille: contacts visibles, OK
- Subscription forcee en `ACTIVE` avec `currentPeriodEnd` dans le passe:
  - Recherche famille: contacts encore visibles
  - Probleme observe: l'expiration temporelle n'est pas prise en compte si `status=ACTIVE`
- Subscription forcee en `INACTIVE`:
  - Recherche famille: `limitedPreview=true`
  - Contacts masques: OK

### Webhooks Stripe testes en Docker dev

- Payload mock `checkout.session.completed` famille:
  - `POST /billing/stripe/webhook`: `201`
  - Reponse: `{ received: true, validated: false }`
  - Aucune subscription creee pour la famille webhook jetable
- Payload mock `checkout.session.completed` ressource:
  - `POST /billing/stripe/webhook`: `201`
  - Reponse: `{ received: true, validated: false }`
  - Etat ressource reste `PENDING_PAYMENT`; le webhook ne l'a pas passee en `PENDING_VERIFICATION`

### Problemes observes sur la cible 8

#### RESOLU - Une subscription `ACTIVE` expiree gardait l'acces premium

**Surface:** `SubscriptionAccessService.hasActiveFamilySubscription`

**Ancien symptome:** une subscription avec `status=ACTIVE` et `currentPeriodEnd` dans le passe continuait de donner `limitedPreview=false` et les contacts visibles.

**Impact:** si Stripe ou un job de synchronisation ne passe pas explicitement le statut a `INACTIVE`, `PAST_DUE` ou `CANCELED`, une famille pourrait garder l'acces premium apres expiration.

**Correction:** l'acces premium exige maintenant `status=ACTIVE` et `currentPeriodEnd` nul ou futur.

**Resultat retest:** une subscription `ACTIVE` expiree retourne `limitedPreview=true` et les contacts restent masques.

#### RESOLU - Webhook dev sans signature retournait `received=true` mais ne traitait pas l'evenement

**Surface:** `POST /api/v1/billing/stripe/webhook`

**Ancien symptome:** en Docker dev, un payload `checkout.session.completed` sans signature retournait `201` avec `received=true`, `validated=false`, mais ne creait pas la subscription famille et ne mettait pas la ressource en `PENDING_VERIFICATION`.

**Impact:** l'audit local ne peut pas valider les effets metier webhook. Plus important: une configuration Stripe/webhook manquante peut retourner un succes HTTP tout en ignorant l'evenement, ce qui rendrait le diagnostic difficile.

**Correction:** en environnement mock dev/test, le webhook accepte explicitement le payload mock non signe, traite l'evenement et retourne `mocked=true`. Hors mock, une signature/secret manquant est rejete au lieu d'etre un faux succes.

**Resultat retest Docker dev:**
- Webhook famille: subscription creee `ACTIVE`, reponse `{ received: true, validated: false, mocked: true }`
- Webhook ressource: profil passe a `PENDING_VERIFICATION`, `verificationStatus=PENDING_VERIFICATION`, `publishStatus=HIDDEN`

### Tests apres correctifs cible 8

- `npx tsc --noEmit`: OK
- `npm run test:e2e -- --runInBand`: OK, 20/20
- Retest Docker dev:
  - Subscription `ACTIVE` expiree: `limitedPreview=true`, contacts masques
  - Webhook famille mock: subscription creee `ACTIVE`
  - Webhook ressource mock: onboarding passe a `PENDING_VERIFICATION`

### Observations cible 8

- Le mode mock checkout fonctionne bien en dev: sessions `cs_mock_...` et retour `/onboarding?mockCheckout=1`.
- L'activation mock est correctement protegee: seulement une famille connectee peut l'utiliser.
- `INACTIVE` retire bien l'acces premium.
- Les webhooks famille sont couverts par les e2e en environnement `NODE_ENV=test`, mais le Docker dev ne permet pas de confirmer les effets metier sans signature/secret.

## Debug cible 9 - Mot de passe / Email

### Objectif

Valider la demande de reinitialisation de mot de passe, l'absence d'enumeration d'email, les tokens valides/invalides/expires, le changement effectif de mot de passe, et l'erreur controlee de verification email.

### API reset password testee

- Creation d'un compte famille jetable en base locale:
  - Email: `audit9.reset...@local.test`
  - Role: `FAMILY`
  - Statut: `ACTIVE`
- Forgot password email connu:
  - `POST /api/v1/auth/request-password-reset`: `201`
  - Message: `Si cet email est connu, un lien a ete envoye.`
  - Token cree dans `PasswordResetToken`: OK
  - Expiration future: OK
- Forgot password email inconnu:
  - `POST /api/v1/auth/request-password-reset`: `201`
  - Meme message que l'email connu: OK
  - Pas d'enumeration d'email: OK
- Token reset invalide:
  - `POST /api/v1/auth/reset-password`: `400`
  - Message: `Lien invalide ou expire.`
- Token reset expire:
  - Token expire cree manuellement en base
  - `POST /api/v1/auth/reset-password`: `400`
  - Message: `Lien invalide ou expire.`
- Token reset valide:
  - `POST /api/v1/auth/reset-password`: `201`
  - Reponse: `{ success: true, message: "Mot de passe mis a jour." }`
  - Tous les tokens reset du compte sont supprimes apres succes: OK
- Ancien mot de passe apres reset:
  - `POST /api/v1/auth/login`: `401 Email ou mot de passe incorrect`, OK attendu
- Nouveau mot de passe apres reset:
  - `POST /api/v1/auth/login`: `201`
  - Token recu: OK
- Reutilisation du meme token apres reset:
  - `POST /api/v1/auth/reset-password`: `400`
  - Message: `Lien invalide ou expire.`, OK attendu
- Nouveau mot de passe faible:
  - `POST /api/v1/auth/reset-password`: `400`
  - Messages de validation force mot de passe: OK
- Verify email token inconnu:
  - `POST /api/v1/auth/verify-email`: `400`
  - Message: `Lien de verification invalide ou expire.`, OK attendu

### Parcours UI verifies

- `/forgot-password`:
  - Titre et formulaire visibles: OK
  - Email inconnu soumis: message generique `Si cet email est connu...` visible
- `/reset-password` sans token:
  - Message `Lien invalide : token manquant`: OK
- `/reset-password?token=...`:
  - Mots de passe differents: message `Les deux mots de passe ne correspondent pas.` visible
  - Token invalide soumis avec mots de passe valides: message `Lien invalide ou expire.` visible
  - Console navigateur: `400 Bad Request` attendu pour le token invalide

### Observations cible 9

- En dev local, `RESEND_API_KEY` n'est pas configuree: l'email n'est pas envoye reellement, mais le service logge l'envoi et retourne OK. Le flux a ete valide en lisant le token directement en base Docker.
- Le throttler de `request-password-reset` limite a 3 demandes / 15 minutes; apres plusieurs essais d'audit, un `429` peut apparaitre. Pour isoler le test email connu/inconnu, l'API a ete redemarree afin de vider le throttler memoire.
- Aucun probleme bloquant observe sur le flux mot de passe/email.

## Debug cible 10 - Profil Mon Compte

### Objectif

Valider l'edition des profils famille/ressource, la persistance apres rechargement, l'annulation/restauration, la suppression de compte et les protections contre les champs admin-only.

### API profil famille testee

- Compte famille jetable cree en base locale: OK
- Login famille: OK
- `PATCH /profiles/family/me` avec:
  - `displayName`
  - `city`
  - `postalCode`
  - `region`
  - `bio`
  - `needsTags`
  - `availability`
- Resultat: `200`
- Reload via `GET /profiles/me`:
  - `displayName=Audit10 Famille Apres`
  - `city=Quebec`
  - `postalCode=G1R4P5`
  - `needsTags=["Tutorat","Transport"]`
  - `availability={"weekend":true}`
  - Persistance: OK

### API profil ressource testee

- Compte ressource jetable cree en base locale: OK
- Login ressource: OK
- `PATCH /profiles/resource/me` avec:
  - `displayName`
  - `bio`
  - `hourlyRate=42.5`
  - `contactPhone`
  - `contactEmail`
  - `skillsTags`
  - `availability`
  - `postalCode`, `city`, `region`, `streetAddress`
  - `backgroundCheckStatus=REQUESTED`
- Resultat: `200`
- Reload via `GET /profiles/me`:
  - `displayName=Audit10 Ressource Apres`
  - `bio=bio resource apres`
  - `hourlyRate=42.5`
  - `contactPhone=514-555-2020`
  - `contactEmail=audit10.resource.contact@local.test`
  - `skillsTags=["Tutorat","audit10"]`
  - `availability={"soir":"mardi","weekend":true}`
  - `backgroundCheckStatus=REQUESTED`
  - Persistance: OK

### Validations profil ressource

- Tarif non numerique:
  - `PATCH /profiles/resource/me` avec `hourlyRate="abc"`: `400`, OK attendu
- Tarif negatif:
  - Frontend `/me`: bloque la sauvegarde et affiche `Le tarif horaire doit etre un nombre positif.`
  - API directe `PATCH /profiles/resource/me` avec `hourlyRate=-5`: `200`
  - Valeur sauvegardee en base: `hourlyRate=-5`
  - Probleme observe: validation negative absente cote backend

### Champs admin-only / statuts ressource

- Ressource tente de modifier:
  - `verificationStatus=VERIFIED`
  - `publishStatus=PUBLISHED`
  - `onboardingState=PUBLISHED`
- Resultat: `400`, messages `property ... should not exist`, OK attendu
- Ressource tente `backgroundCheckStatus=PENDING`:
  - Resultat: `400`
  - Message: `Seul l'engagement (REQUESTED) ou l'absence de demande (NOT_REQUESTED) peut etre modifie par l'allie.`
  - OK attendu

### Suppression compte

- Compte famille jetable avec profil et subscription cree en base locale
- Login: OK
- `DELETE /api/v1/auth/me`: `200`, `{ success: true }`
- Verification base:
  - user supprime
  - cascade profil/subscriptions: OK

### Parcours UI verifies

- Famille `/me`:
  - Modification locale du nom: banniere modifications non enregistrees visible
  - Bouton `Restaurer`: restaure la valeur initiale
- Ressource `/me`:
  - Modification locale de la biographie: banniere modifications non enregistrees visible
  - Bouton `Restaurer`: restaure la valeur initiale
  - Tarif negatif dans le formulaire: message `Le tarif horaire doit etre un nombre positif.`
  - Console navigateur pendant le parcours: aucune erreur/warning observee

### Probleme observe sur la cible 10

#### RESOLU - L'API acceptait un tarif horaire negatif

**Surface:** `PATCH /api/v1/profiles/resource/me`, champ `hourlyRate`

**Ancien symptome:** le frontend bloquait `-12`, mais une requete API directe avec `hourlyRate=-5` retournait `200` et sauvegardait `-5`.

**Impact:** donnees incoherentes possibles si un client contourne le frontend ou si une integration API envoie une valeur invalide.

**Correction:** ajout d'une contrainte backend `@Min(0)` sur `UpdateResourceProfileDto.hourlyRate`.

**Resultat retest:** `PATCH /profiles/resource/me` avec `hourlyRate=-5` retourne `400` avec `Le tarif horaire doit etre un nombre positif.`

### Tests apres correctif cible 10

- `npx tsc --noEmit`: OK
- `npm run test:e2e -- --runInBand`: OK, 21/21
- Retest Docker dev:
  - `PATCH /profiles/resource/me` avec `hourlyRate=-5`: `400`, OK

### Observations cible 10

- La restauration UI fonctionne pour famille et ressource.
- La suppression compte fonctionne avec cascade.
- Les statuts admin-only sont proteges par `forbidNonWhitelisted` et la logique metier `backgroundCheckStatus`.

## Debug cible 11 - Maintenance / Securite

### Objectif

Valider les comportements globaux de maintenance, CORS, DTO stricts, rate limits, routes privees sans token et masquage des donnees sensibles.

### Maintenance API

- Maintenance avant test: `enabled=false`
- Activation maintenance par admin: `201`, `enabled=true`
- Login famille avec mot de passe valide pendant maintenance:
  - `503`
  - Message: `Connexion impossible pendant la maintenance.`
- Login ressource avec mot de passe valide pendant maintenance:
  - `503`
  - Message: `Connexion impossible pendant la maintenance.`
- Login admin avec mot de passe valide pendant maintenance:
  - `201`
  - Role `ADMIN`, token recu: OK
- Utilisateur famille deja connecte, route privee pendant maintenance:
  - `GET /users/me`: `503 Maintenance en cours`, OK attendu
- Admin deja connecte, route privee pendant maintenance:
  - `GET /users/me`: `200`, OK
- `GET /health` pendant maintenance:
  - `200`, OK
- Desactivation maintenance par admin:
  - `201`, `enabled=false`
- Statut final:
  - `GET /maintenance/status`: `enabled=false`

### Maintenance UI

- Famille deja connectee sur `/me`: profil visible avant maintenance
- Maintenance activee ensuite par admin
- Navigation famille vers `/search`:
  - Page `Maintenance en cours` visible
  - Console: `503 Service Unavailable` attendus, declenchent l'etat maintenance frontend
- Maintenance desactivee en fin de test: OK

### CORS / DTO stricts

- CORS localhost:
  - `GET /health` avec `Origin: http://localhost:3000`
  - `access-control-allow-origin=http://localhost:3000`: OK
- DTO inconnu refuse:
  - `POST /dev/login-as` avec champ extra `extra=nope`
  - `400`
  - Message: `property extra should not exist`, OK attendu

### Rate limits

- Login:
  - Apres plusieurs essais rapides, `POST /auth/login` retourne `429 ThrottlerException: Too Many Requests`
  - OK attendu
- Reset password:
  - 3 demandes rapides: `201`
  - 4e demande rapide: `429 ThrottlerException: Too Many Requests`
  - OK attendu

### Routes privees sans token

- `GET /users/me`: `403 Unauthorized`
- `GET /profiles/me`: `403 Unauthorized`
- `GET /messaging/conversations`: `403 Unauthorized`
- `GET /users/families`: `403 Unauthorized`
- `POST /maintenance`: `403 Unauthorized`
- Comportement coherent avec les guards actuels: OK

### Masquage donnees sensibles

- Recherche publique:
  - `limitedPreview=true`
  - Contacts masques: OK
- Recherche famille premium:
  - `limitedPreview=false`
  - Contacts visibles: OK
- Recherche ressource:
  - `limitedPreview=true`
  - Contacts masques: OK
- Recherche admin:
  - `limitedPreview=false`
  - Contacts visibles: OK

### Observations cible 11

- Les routes privees sans token retournent `403 Unauthorized` plutot que `401`; c'est coherent avec le guard global actuel et deja observe dans les audits precedents.
- Les erreurs console `503` pendant maintenance sont attendues: elles signalent au frontend de basculer vers la page maintenance.
- Aucun probleme bloquant observe sur maintenance/securite.

## Cible 12 - UI / Regression visuelle

Objectif: valider l'experience ecran sur desktop/mobile, navigation selon role, liens legaux, cookies, images, console et etats UI.

### Environnement cible 12

- Frontend Docker local: `http://localhost:3002`
- API Docker local: `http://localhost:3000/api/v1`
- Browser: Microsoft Edge headless via Playwright
- Viewports:
  - Desktop: `1365x900`
  - Mobile: `390x844`
- Maintenance forcee a `enabled=false` avant la passe visuelle.

### Pages testees

- Public:
  - `/`
  - `/login`
  - `/onboarding`
  - `/onboarding/family`
  - `/devenir-allie`
- Famille:
  - `/search`
  - `/search?postalCode=H2X1Y4&page=1`
  - `/resource/cmlmyytt0000bhciun9rzmkj5`
  - `/resource/not-a-real-id`
  - `/me`
  - `/messages`
- Ressource:
  - `/me`
- Admin:
  - `/admin`

### Desktop 1365x900

- Largeur document egale au viewport sur les pages testees: OK
- Aucun debordement horizontal visuel detecte: OK
- Images chargees sur les surfaces hero testees (`/`, `/search`): OK
- Header public:
  - `Accueil`, `Premiers pas`, `Connexion`, `Recherche`, `Invite`: OK
- Header famille:
  - `Mon profil`, `Recherche`, `Messages`, `Connecte`, `Deconnexion`: OK
- Header ressource:
  - `Mon profil`, `Messages`, `Connecte`, `Deconnexion`: OK
  - Pas de lien `Recherche`: OK
- Header admin:
  - `Mon profil`, `Recherche`, `Messages`, `Admin`, `Connecte`, `Deconnexion`: OK
- Footer:
  - `Confidentialite`
  - `Vos droits`
  - `Cookies`
  - `CGU`
  - `Mentions legales`
  - `Accessibilite`
  - `Contact`
  - Tous presents: OK

### Mobile 390x844

- Pages publiques et famille principales sans largeur document superieure au viewport: OK
- `/search`, `/login`, `/onboarding`, `/onboarding/family`, `/devenir-allie`, `/me`, `/messages`: pas de scroll horizontal document: OK
- Faux positifs notes:
  - Quelques elements `sr-only` sur `/devenir-allie` ont un `scrollWidth` interne superieur a leur largeur masquee. Non visuel, attendu.
  - Le lien logo `FAB` peut declarer un petit `scrollWidth` interne, sans augmenter la largeur document. Non bloquant.
- Image `/images/bottom-fab.png` sur la page d'accueil mobile a ete signalee comme non chargee lors d'une mesure initiale, car elle est sous le pli/lazy. Les images hero visibles sont chargees: OK.

### Bannière cookies

- Contexte navigateur frais sans consentement:
  - Bandeau `Information sur les cookies` visible: OK
  - Bouton `J'ai compris` present et unique: OK
  - Apres clic et reload, bandeau masque: OK

### Etats loading / error / empty

- Loading recherche:
  - Requete `/search?postalCode=G1R&page=1` ralentie volontairement
  - Bouton affiche `Recherche...`: OK
- Empty state recherche:
  - `/search?postalCode=J0Z&tags=zzzz&page=1`
  - `Total : 0`
  - Message `Aucun resultat pour ce filtre...`: OK
- Error state detail allie:
  - `/resource/not-a-real-id`
  - Message `Profil non disponible.`
  - Bouton `Retour a la recherche`: OK

### Console navigateur

- Aucune `pageerror` JavaScript detectee sur les pages testees: OK
- Erreurs console attendues/observees:
  - `401 Unauthorized` sur `/login` lie a la verification de session sans token.
  - `404 Not Found` sur `/resource/not-a-real-id`, attendu pour l'etat erreur.
  - Un `404 Not Found` generique peut apparaitre sur navigation publique/search sans bloquer le rendu; aucune reponse API critique en erreur associee lors du controle detaille.
- Aucun blocage UI observe lie a ces logs.

### Probleme trouve cible 12

#### RESOLU - Admin mobile creait un debordement horizontal

**Surface:** `/admin`, viewport `390x844`

**Ancien symptome:**

- Largeur document mesuree: `410px`
- Viewport: `390px`
- `horizontalOverflow=true`

**Elements impliques:**

- Section familles/admin avec filtres et longues lignes utilisateur.
- Exemples detectes:
  - ligne famille contenant un email long
  - libelles/checkbox/actions dans les blocs de liste admin

**Impact:**

- Sur mobile, l'interface admin peut creer un scroll horizontal et couper legerement le contenu.
- Les autres pages testees ne montrent pas de debordement document.

**Correction:**

- Ajout de contraintes responsives sur la console admin:
  - conteneur principal sans overflow horizontal
  - cartes admin en `min-w-0`
  - textes longs en `break-words`
  - groupes d'actions et pagination en `flex-wrap`
  - blocs JSON et selects limites a la largeur disponible

**Resultat retest:**

- `/admin`, onglet familles, mobile `390x844`: `docWidth=390`, `viewport=390`, `horizontalOverflow=false`
- `/admin`, onglet allies, mobile `390x844`: `docWidth=390`, `viewport=390`, `horizontalOverflow=false`
- `/admin`, onglet audit, mobile `390x844`: `docWidth=390`, `viewport=390`, `horizontalOverflow=false`

### Tests apres correctif cible 12

- `npm --prefix frontend run build`: OK
- Retest Edge headless mobile `390x844` sur les onglets admin `Familles`, `Allies`, `Audit`: OK

### Details API verifies

- `POST /api/v1/dev/login-as`: OK pour `ADMIN`, `FAMILLE`, `RESSOURCE`
- `GET /api/v1/users/me`: OK pour les trois roles
- `GET /api/v1/profiles/me`: OK famille et ressource
- `GET /api/v1/search/resources?postalCode=H2X&page=1`: OK public, preview limitee, `hourlyRate` en nombre
- `GET /api/v1/search/resources?postalCode=H3B&page=1`: OK famille, contacts visibles, `hourlyRate` en nombre
- `GET /api/v1/profiles/resource/:id`: OK famille, `hourlyRate: 30`
- Messagerie famille/ressource: creation conversation, detail conversation et envoi de messages OK
- Admin: familles, ressources, audit et maintenance OK
- Reset password request: OK

### Details UI verifies

- Detail allie famille:
  - H1: `Ressource Locale`
  - Tarif affiche: `Tarif horaire : 30 $`
  - Contacts visibles: email et telephone
  - Bouton contact visible et fonctionnel
- Route contact:
  - Navigation confirmee vers `/messages?contact=cmlmyytv1000dhciufvm1df9d`
  - Page `Messages` chargee
- Admin:
  - H1: `Console Admin`
  - Mode maintenance, familles et actions visibles
- Ressource:
  - Page `Messages` chargee
  - Conversation avec `Famille Locale` visible

### Tests commandes

- `npx tsc --noEmit`: OK
- `npm --prefix frontend run build`: OK
- `npm run test:e2e -- --runInBand`: OK, 15/15

## Problemes resolus depuis l'audit precedent

### RESOLU - Detail allie affichait `Unauthorized` pour une famille connectee

**Ancien symptome:** `/resource/[id]` faisait un appel `403`, puis un appel `200`, mais l'UI restait sur `Unauthorized`.

**Resultat retest:** le detail allie fait maintenant un seul appel API `200` et affiche le profil avec les contacts famille.

### RESOLU - Test e2e du webhook Stripe

**Ancien symptome:** `POST /api/v1/billing/stripe/webhook accepte un payload mock en test` echouait parce que `sub_test_123` n'etait pas creee.

**Resultat retest:** les e2e passent: 15/15 depuis Windows et 15/15 dans Docker.

### RESOLU - E2E depuis l'hote Windows

**Ancien symptome:** les e2e Windows echouaient avant assertions car `postgres:5432` n'etait pas resolu hors Docker.

**Resultat retest:** `npm run test:e2e -- --runInBand` utilise maintenant `localhost:5432` et passe 15/15.

### RESOLU - Warning Next.js `scroll-behavior: smooth`

**Ancien symptome:** warning console Next.js sur `<html>` pendant les transitions.

**Resultat retest:** le warning n'apparait plus apres ajout de `data-scroll-behavior="smooth"`.

### RESOLU - Le tarif horaire du detail allie affichait `[object Object] $`

**Surface:** `/resource/[id]`, champ `hourlyRate`

**Ancien symptome:**
1. Se connecter comme famille dev.
2. Ouvrir `/resource/cmlmyytv1000dhciufvm1df9d`.
3. Le profil s'affichait, mais le tarif rendait:
   `Tarif horaire : [object Object] $`

**Cause:** `GET /api/v1/profiles/resource/:id` renvoyait `hourlyRate` comme objet Decimal Prisma:

```json
{
  "s": 1,
  "e": 1,
  "d": [30]
}
```

**Correction:** conversion des champs Decimal exposés (`hourlyRate`, `averageRating`) en nombres simples dans les réponses `profiles` et `search`.

**Resultat retest:** l'API renvoie `hourlyRate: 30` et la page affiche `Tarif horaire : 30 $`. `[object Object]` n'apparait plus.

## Problemes restants

- Aucun probleme bloquant ouvert apres correction de la cible 12.

## Notes

- Les erreurs console `401` sur les pages protegees sans session sont attendues: elles declenchent la redirection login.
- Les `net::ERR_ABORTED` sur des URLs `?_rsc=...` sont apparus pendant la navigation automatisee rapide entre pages Next.js. Ils correspondent a des requetes RSC annulees par les changements de page, sans blocage observe.
- Le bouton `Contacter cet allie` fonctionne; lors d'une premiere passe, la banniere cookies pouvait perturber la mesure du clic automatisé. Avec consentement deja enregistre, la navigation est confirmee.
- Les contrats messagerie valides sont:
  - creation conversation: `{ resourceProfileId, initialMessage }`
  - envoi message: `{ content }`
