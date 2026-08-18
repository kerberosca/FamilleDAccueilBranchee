#!/usr/bin/env bash
# Valide l'attestation de sauvegarde FAB avant une opération de production.

set -euo pipefail
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

readonly PRODUCTION_HELPER="/usr/local/sbin/gestion-vps-backup-guard"
readonly APPLICATION="fab"
readonly MAX_AGE_SECONDS="93600"
readonly STAT="/usr/bin/stat"
readonly ID="/usr/bin/id"
readonly SUDO="/usr/bin/sudo"

helper="$PRODUCTION_HELPER"
test_mode=0

if [[ $# -eq 2 && "$1" == "--test-helper" ]]; then
  if [[ "${GESTION_VPS_BACKUP_GUARD_TEST_MODE:-}" != "1" ]]; then
    printf 'ERROR: --test-helper est réservé aux tests automatisés.\n' >&2
    exit 64
  fi
  helper="$2"
  test_mode=1
elif [[ $# -ne 0 ]]; then
  printf 'Usage: %s [--test-helper /chemin/absolu]\n' "$0" >&2
  exit 64
fi

if [[ "$helper" != /* || ! -f "$helper" || -L "$helper" || ! -x "$helper" ]]; then
  printf 'ERROR: garde GestionVPS absent ou non exécutable: %s\n' "$helper" >&2
  exit 1
fi

if [[ "$test_mode" -eq 0 ]]; then
  helper_uid="$("$STAT" -c '%u' -- "$helper")"
  helper_mode="$("$STAT" -c '%a' -- "$helper")"
  if [[ "$helper_uid" != "0" || "$helper_mode" =~ [2367][0-7]$ || "$helper_mode" =~ [0-7][2367]$ ]]; then
    printf 'ERROR: le garde GestionVPS doit appartenir à root et ne pas être modifiable par groupe/autres.\n' >&2
    exit 1
  fi
fi

guard_args=(
  --application "$APPLICATION"
  --max-age-seconds "$MAX_AGE_SECONDS"
  --require-remote-verified
  --require-signed-marker
)

if [[ "$test_mode" -eq 1 || "$("$ID" -u)" -eq 0 ]]; then
  exec "$helper" "${guard_args[@]}"
fi

exec "$SUDO" -n -- "$helper" "${guard_args[@]}"
