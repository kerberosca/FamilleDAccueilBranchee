# Audit debug local - 2026-05-07

## Contexte

- Reprise de l'audit apres modifications locales.
- Branche locale: `main`
- Alignement GitHub: `main...origin/main = 0 / 0` apres `git fetch origin main`
- Modifications locales detectees:
  - `README.md`
  - `frontend/app/layout.tsx`
  - `frontend/app/resource/[id]/page.tsx`
  - `test/app.e2e-spec.ts`
  - `docs/debug-audit-2026-05-07.md`
- Changement local non suivi preexistant: `.codex_known_hosts`
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
- Build/typecheck/tests:
  - `npx tsc --noEmit`: OK
  - `npm --prefix frontend run build`: OK
  - `npm run test:e2e -- --runInBand` depuis Windows: OK, 15/15
  - `docker exec fab-backend-dev npm run test:e2e -- --runInBand`: OK, 15/15

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

- Aucun probleme bloquant observe apres la correction du tarif.

## Notes

- Les erreurs console `401` sur les pages protegees sans session sont attendues: elles declenchent la redirection login.
- Les `net::ERR_ABORTED` sur des URLs `?_rsc=...` sont apparus pendant la navigation automatisee rapide entre pages Next.js. Ils correspondent a des requetes RSC annulees par les changements de page, sans blocage observe.
- Le bouton `Contacter cet allie` fonctionne; lors d'une premiere passe, la banniere cookies pouvait perturber la mesure du clic automatisé. Avec consentement deja enregistre, la navigation est confirmee.
- Les contrats messagerie valides sont:
  - creation conversation: `{ resourceProfileId, initialMessage }`
  - envoi message: `{ content }`
