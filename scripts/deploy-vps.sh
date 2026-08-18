#!/usr/bin/env bash
# À exécuter sur le VPS après publication et validation de la CI.

set -euo pipefail
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_root="$(dirname "$script_dir")"
cd "$project_root"

git pull --ff-only origin main

# Toute construction, recréation ou migration reste bloquée sans attestation
# récente, signée et vérifiée hors site par GestionVPS.
bash "$script_dir/require-recent-backup.sh"

# Construire d'abord, migrer avec un conteneur ponctuel, puis seulement démarrer
# la nouvelle API afin qu'elle ne voie jamais un schéma incomplet.
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml run --rm api npx prisma migrate deploy
docker compose -f docker-compose.prod.yml up -d
echo "Déploiement terminé."
