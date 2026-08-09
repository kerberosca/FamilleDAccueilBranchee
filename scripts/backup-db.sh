#!/usr/bin/env bash
# Point d'entrée de compatibilité. La sauvegarde locale-only historique a été
# remplacée par le service root GestionVPS, commun aux applications du VPS.

set -euo pipefail
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

readonly BACKUP_UNIT="gestionvps-backup.service"
readonly SYSTEMCTL="/usr/bin/systemctl"
readonly ID="/usr/bin/id"
readonly SUDO="/usr/bin/sudo"
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ "$("$ID" -u)" -eq 0 ]]; then
  "$SYSTEMCTL" start --wait "$BACKUP_UNIT"
else
  "$SUDO" -n -- "$SYSTEMCTL" start --wait "$BACKUP_UNIT"
fi

# Le service ne vaut succès que si le garde confirme le marqueur signé,
# l'archive distante vérifiée et une fraîcheur maximale de 26 heures.
bash "$script_dir/require-recent-backup.sh"
