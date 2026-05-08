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

- Aucun probleme bloquant observe apres les correctifs de la cible 4.

## Notes

- Les erreurs console `401` sur les pages protegees sans session sont attendues: elles declenchent la redirection login.
- Les `net::ERR_ABORTED` sur des URLs `?_rsc=...` sont apparus pendant la navigation automatisee rapide entre pages Next.js. Ils correspondent a des requetes RSC annulees par les changements de page, sans blocage observe.
- Le bouton `Contacter cet allie` fonctionne; lors d'une premiere passe, la banniere cookies pouvait perturber la mesure du clic automatisé. Avec consentement deja enregistre, la navigation est confirmee.
- Les contrats messagerie valides sont:
  - creation conversation: `{ resourceProfileId, initialMessage }`
  - envoi message: `{ content }`
