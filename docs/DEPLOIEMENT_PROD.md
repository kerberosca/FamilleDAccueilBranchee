# Déploiement production VPS

Procédure unique pour mettre `familledaccueilbranchee.ca` à jour sans écraser la configuration de production.

## Règles

- Utiliser uniquement `docker-compose.prod.yml` en production.
- Ne pas utiliser `docker compose up` sans `-f docker-compose.prod.yml` sur le VPS.
- Garder `.env` local au VPS. Il ne doit pas être versionné.
- Si un fichier suivi par Git est modifié localement sur le VPS, le stasher avant le pull.
- Utiliser le compte `linuxuser` et l'accès Plink/Pageant documenté par GestionVPS; ne pas ouvrir une session directe comme `root`.
- Déclencher et valider une sauvegarde GestionVPS avant toute construction ou migration.

## Exposition réseau et Caddy

Les ports applicatifs ne doivent jamais être publiés sur l'interface publique du VPS. Le fichier
`docker-compose.prod.yml` les rend accessibles uniquement depuis la boucle locale :

- API : `127.0.0.1:3000` vers le port `3000` du conteneur;
- frontend : `127.0.0.1:3002` vers le port `3002` du conteneur.

Dans `/etc/caddy/Caddyfile`, conserver les matchers et les routes existants, mais utiliser ces
upstreams explicites :

- routes API : `127.0.0.1:3000`;
- frontend : `127.0.0.1:3002`.

Ne pas remplacer `127.0.0.1` par l'adresse publique, `0.0.0.0` ou un mapping Docker sans adresse.
Après toute modification de Caddy, valider puis recharger sa configuration :

```bash
caddy validate --config /etc/caddy/Caddyfile
systemctl reload caddy
```

## Variables `.env` minimales

```bash
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://familledaccueilbranchee.ca/api/v1
CORS_ORIGINS=https://familledaccueilbranchee.ca,https://www.familledaccueilbranchee.ca
APP_FRONTEND_URL=https://familledaccueilbranchee.ca
DEV_BYPASS_AUTH=false
NEXT_PUBLIC_DEV_BYPASS_AUTH=false
EMAIL_DELIVERY_MODE=live
ALLY_TRAINING_ENABLED=true
ALLY_TRAINING_EMAILS_ENABLED=false
ALLY_TRAINING_EMAILS_START_AT=
```

`ALLY_TRAINING_EMAILS_ENABLED=false` laisse la formation accessible, mais bloque uniquement ses courriels. Une date ISO valide dans `ALLY_TRAINING_EMAILS_START_AT` est également obligatoire avant toute activation.

## Déploiement

```bash
cd ~/fab

git status
git fetch origin main
git pull --ff-only origin main

bash scripts/backup-db.sh
bash scripts/deploy-vps.sh
docker compose -f docker-compose.prod.yml ps
```

Le script refuse de construire ou migrer sans attestation récente, signée et vérifiée hors site. Il construit les images, exécute `prisma migrate deploy` dans un conteneur ponctuel, puis démarre la nouvelle API.

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

Après un déploiement de la formation avec les relances en pause, vérifier également que les journaux de formation restent `PENDING`, avec `providerMessageId` vide. Le tableau de bord d'administration doit afficher « Relances par courriel : en pause ».

Pour tester le login sans navigateur :

```bash
curl -i -X POST https://familledaccueilbranchee.ca/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -H "Origin: https://familledaccueilbranchee.ca" \
  --data '{"email":"info@formeducweb.ca","password":"MOT_DE_PASSE"}'
```
