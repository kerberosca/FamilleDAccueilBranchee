#!/bin/bash
# Sauvegarde de la base PostgreSQL FAB (production).
# Usage : à lancer depuis le VPS dans le dossier du projet, ou via cron.
#   ./scripts/backup-db.sh
# Sauvegarde aussi les documents prives allies si /root/fab-data/uploads existe.
# Crée des archives dans backups/ et garde les 3 derniers jours (limite l’espace disque).

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$PROJECT_ROOT/backups"
DATE="$(date +%Y%m%d_%H%M)"
FILE="$BACKUP_DIR/fab_$DATE.sql"
UPLOADS_DIR="${RESOURCE_DOCUMENTS_HOST_DIR:-/root/fab-data/uploads}"
UPLOADS_FILE="$BACKUP_DIR/fab_uploads_$DATE.tar.gz"

mkdir -p "$BACKUP_DIR"
cd "$PROJECT_ROOT"

docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U postgres -d famille_accueil --no-owner --no-acl -F p > "$FILE"

gzip "$FILE"
echo "Backup: ${FILE}.gz"

if [ -d "$UPLOADS_DIR" ]; then
  tar -czf "$UPLOADS_FILE" -C "$(dirname "$UPLOADS_DIR")" "$(basename "$UPLOADS_DIR")"
  echo "Backup uploads: $UPLOADS_FILE"
else
  echo "Uploads non trouves, backup fichiers saute: $UPLOADS_DIR"
fi

# Garder seulement les 3 derniers jours
find "$BACKUP_DIR" -name "fab_*.sql.gz" -mtime +3 -delete
find "$BACKUP_DIR" -name "fab_uploads_*.tar.gz" -mtime +3 -delete
