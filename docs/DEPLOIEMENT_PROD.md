# Déploiement production VPS

Procédure unique pour mettre `familledaccueilbranchee.ca` à jour sans écraser la configuration de production.

## Règles

- Utiliser uniquement `docker-compose.prod.yml` en production.
- Ne pas utiliser `docker compose up` sans `-f docker-compose.prod.yml` sur le VPS.
- Garder `.env` local au VPS. Il ne doit pas être versionné.
- Si un fichier suivi par Git est modifié localement sur le VPS, le stasher avant le pull.

## Variables `.env` minimales

```bash
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://familledaccueilbranchee.ca/api/v1
CORS_ORIGINS=https://familledaccueilbranchee.ca,https://www.familledaccueilbranchee.ca
APP_FRONTEND_URL=https://familledaccueilbranchee.ca
DEV_BYPASS_AUTH=false
NEXT_PUBLIC_DEV_BYPASS_AUTH=false
```

## Déploiement

```bash
cd ~/fab

git status
git fetch origin main
git pull --ff-only origin main

docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml exec api npx prisma migrate deploy
docker compose -f docker-compose.prod.yml ps
```

## Vérifications

```bash
curl -i http://localhost:3000/api/v1/health
curl -i https://familledaccueilbranchee.ca/api/v1/health

curl -i -X OPTIONS https://familledaccueilbranchee.ca/api/v1/auth/login \
  -H "Origin: https://familledaccueilbranchee.ca" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type"
```

Le header CORS doit inclure :

```text
access-control-allow-origin: https://familledaccueilbranchee.ca
```

## Diagnostic si le menu Dev apparaît

Vérifier que le frontend a été buildé en production :

```bash
docker compose -f docker-compose.prod.yml exec frontend printenv NODE_ENV
docker compose -f docker-compose.prod.yml exec frontend printenv NEXT_PUBLIC_DEV_BYPASS_AUTH
```

Si `NEXT_PUBLIC_DEV_BYPASS_AUTH=true`, corriger `.env`, puis reconstruire le frontend sans cache :

```bash
docker compose -f docker-compose.prod.yml build --no-cache frontend
docker compose -f docker-compose.prod.yml up -d frontend
```

## Diagnostic login ou recherche en erreur 500

```bash
docker compose -f docker-compose.prod.yml logs --tail=120 api
docker compose -f docker-compose.prod.yml logs --tail=120 frontend
```

Pour tester le login sans navigateur :

```bash
curl -i -X POST https://familledaccueilbranchee.ca/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -H "Origin: https://familledaccueilbranchee.ca" \
  --data '{"email":"info@formeducweb.ca","password":"MOT_DE_PASSE"}'
```
