#!/bin/bash
# Sauvegarde de la base PostgreSQL FAB (production).
# Usage : à lancer depuis le VPS dans le dossier du projet, ou via cron.
#   ./scripts/backup-db.sh
# Crée des archives dans backups/ et garde les 7 derniers jours.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$PROJECT_ROOT/backups"
DATE="$(date +%Y%m%d_%H%M)"
FILE="$BACKUP_DIR/fab_$DATE.sql"

mkdir -p "$BACKUP_DIR"
cd "$PROJECT_ROOT"

docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U postgres -d famille_accueil --no-owner --no-acl -F p > "$FILE"

gzip "$FILE"
echo "Backup: ${FILE}.gz"

# Garder seulement les 7 derniers jours
find "$BACKUP_DIR" -name "fab_*.sql.gz" -mtime +7 -delete
