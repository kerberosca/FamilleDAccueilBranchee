#!/usr/bin/env bash
# À exécuter sur le VPS après publication et validation de la CI.

set -euo pipefail
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_root="$(dirname "$script_dir")"
cd "$project_root"

# La synchronisation en avance rapide ne modifie pas les données.
git pull --ff-only origin main

# Toute construction, recréation ou migration reste bloquée sans attestation
# F-03 récente, signée et vérifiée hors site par GestionVPS.
bash "$script_dir/require-recent-backup.sh"

docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml exec api npx prisma migrate deploy
echo "Déploiement terminé."
