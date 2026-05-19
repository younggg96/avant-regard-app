#!/usr/bin/env bash
# Apply all numbered migrations (007–056) in order.
#
# Usage:
#   export SUPABASE_DB_URL='postgresql://postgres.PROJECT_REF:PASSWORD@aws-1-REGION.pooler.supabase.com:5432/postgres?sslmode=require'
#   ./run_all_migrations.sh
#   ./run_all_migrations.sh 008    # resume from migration 008 (optional)
#
# Copy SUPABASE_DB_URL from Supabase Dashboard → Connect → Session pooler (recommended).
#
# If Direct (db.*.supabase.co:5432) fails: IPv6-only / connection refused — use Session pooler.
# Fallback: Transaction pooler on db host port 6543 with user "postgres".
#
# psql (Homebrew libpq on macOS):
#   export PSQL=/opt/homebrew/opt/libpq/bin/psql

set -euo pipefail

if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
  echo "ERROR: Set SUPABASE_DB_URL first (copy full URI from Supabase Dashboard)." >&2
  exit 1
fi

PSQL="${PSQL:-psql}"
if ! command -v "$PSQL" >/dev/null 2>&1; then
  if [[ -x /opt/homebrew/opt/libpq/bin/psql ]]; then
    PSQL=/opt/homebrew/opt/libpq/bin/psql
  else
    echo "ERROR: psql not found. Install: brew install libpq" >&2
    exit 1
  fi
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "Testing connection..."
if ! "$PSQL" "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -c 'SELECT current_database(), current_user;'; then
  echo "" >&2
  echo "TIP: If Direct :5432 fails with 'Connection refused', try Transaction pooler :6543:" >&2
  echo "  export SUPABASE_DB_URL='postgresql://postgres:PASSWORD@db.PROJECT_REF.supabase.co:6543/postgres?sslmode=require'" >&2
  exit 1
fi

START_FROM="${1:-007}"

for f in $(ls 0*.sql | sort); do
  num=$(echo "$f" | sed -E 's/^0*([0-9]+).*/\1/')
  if [[ "$num" -lt "$START_FROM" ]]; then
    echo "=== Skipping $f (before $START_FROM) ==="
    continue
  fi
  echo "=== Applying $f ==="
  "$PSQL" "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$f"
done

echo "=== ALL MIGRATIONS COMPLETE ==="
