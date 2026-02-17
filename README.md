# Famille d'accueil branchée - Backend MVP

Backend NestJS (monolithe modulaire) pour une marketplace Quebec FR-CA:
- `ADMIN`: modere, valide, bannit.
- `RESOURCE`: paie a l'inscription, puis verification admin avant publication.
- `FAMILY`: recherche gratuite limitee, abonnement payant requis pour contacts + messagerie.

## Stack
- NestJS + TypeScript
- PostgreSQL + Prisma
- Stripe (checkout paiement unique + abonnement)
- JWT access/refresh
- RBAC roles + guards
- DTO validation stricte (`whitelist` + `forbidNonWhitelisted`)
- Swagger OpenAPI (`/docs`)
- Docker Compose (Postgres)
- Jest + Supertest (E2E smoke)

## Demarrage
1. Copier `.env.example` vers `.env`.
2. Lancer Postgres (docker):
   - `docker compose up -d postgres`
3. Installer dependencies:
   - `npm install`
4. Generer Prisma:
   - `npm run prisma:generate`
5. Appliquer migration:
   - `npm run prisma:migrate`
6. Seed:
   - `npm run prisma:seed`
7. Run API:
   - `npm run start:dev`

Base path API versionnee: `/api/v1`.

## Healthcheck
- Endpoint: `GET /api/v1/health`
- Reponse: `{ "status": "ok" }`

## Swagger
- URL: `http://localhost:3000/docs`

## Tests E2E smoke
1. Verifier Postgres en local Docker (port `5432`).
2. Lancer:
   - `npm run test:e2e`
3. Mode watch:
   - `npm run test:watch`

Les tests couvrent:
- health endpoint
- auth/dev login + endpoint protege
- recherche (preview public vs resultat premium)
- billing checkout avec Stripe mock
- webhook Stripe mock en `NODE_ENV=test`
- headers CORS
- format JSON des erreurs API

## Comptes seed
- Admin: `ADMIN_EMAIL` / `ADMIN_PASSWORD` du `.env`
- Famille demo: `famille.demo@fab.local` / `Famille123!`
- Ressource demo: `ressource.demo@fab.local` / `Ressource123!`
- Dev bypass:
  - `admin@local.test`
  - `famille@local.test`
  - `ressource@local.test`

## Mode DEV login rapide
- Endpoint: `POST /api/v1/dev/login-as`
- Actif seulement si:
  - `NODE_ENV != production`
  - `DEV_BYPASS_AUTH=true`
- En production, module non importe et endpoint indisponible.

Exemple:
- `curl -X POST http://localhost:3000/api/v1/dev/login-as -H "Content-Type: application/json" -d "{\"role\":\"ADMIN\"}"`

## Regles MVP implementees
- Ressource invisible tant que non `VERIFIED + PUBLISHED`.
- Recherche publique: resultat anonymise + preview limitee.
- Famille abonnee active: voit `contactEmail` et `contactPhone`.
- Messagerie:
  - initiation uniquement par `FAMILY` abonnee
  - conversation strictement `FAMILY <-> RESOURCE`

## Limite de recherche code postal (MVP)
- Matching par exact postal code **ou** prefix 3 caracteres.
- Limite documentee pour migration future vers geospatial.

## Webhooks Stripe
Endpoint: `POST /api/v1/billing/stripe/webhook`.

En production, configurer le body brut pour verification de signature Stripe.
Le code actuel contient la logique metier de mapping evenements, avec fallback dev.
