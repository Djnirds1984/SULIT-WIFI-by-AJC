#!/usr/bin/env bash
set -euo pipefail

BACKUP_FILE=${1:-}
if [[ -z "$BACKUP_FILE" ]]; then
  echo "Usage: restore-db.sh <backup.tar.gz or .sql>"
  exit 1
fi

# Load .env for PG variables
if [[ -f .env ]]; then
  export $(grep -E '^(PGHOST|PGPORT|PGDATABASE|PGUSER|PGPASSWORD)=' .env | xargs)
fi

: "${PGHOST:?PGHOST required}"
: "${PGPORT:?PGPORT required}"
: "${PGDATABASE:?PGDATABASE required}"
: "${PGUSER:?PGUSER required}"
: "${PGPASSWORD:?PGPASSWORD required}"

export PGPASSWORD

echo "[Restore] Restoring $BACKUP_FILE into $PGDATABASE on $PGHOST:$PGPORT as $PGUSER"

if [[ "$BACKUP_FILE" == *.tar.gz ]]; then
  # Use pg_restore for custom/tar format
  pg_restore -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -c "$BACKUP_FILE"
else
  # Assume plain SQL
  psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -f "$BACKUP_FILE"
fi

echo "[Restore] Done."