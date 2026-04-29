"""Apply `backend/app/db/memfiredb_full_schema.sql` to the target Supabase project.

Preferred path: TARGET_POSTGRES_URL is set, we run the SQL via psql. This
preserves triggers, RLS policies, and functions exactly.

Fallback path: print the schema path and instruct the operator to paste it
into the Supabase SQL Editor. REST/PostgREST does not expose DDL.
"""

from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

from .config import Settings


SCHEMA_PATH = (
    Path(__file__).resolve().parents[2] / "app" / "db" / "memfiredb_full_schema.sql"
)


def _run_psql(postgres_url: str, sql_path: Path) -> None:
    if not shutil.which("psql"):
        raise RuntimeError(
            "psql not found on PATH. Install the PostgreSQL client "
            "(`brew install libpq && brew link --force libpq`) or set "
            "TARGET_POSTGRES_URL to empty and apply the schema manually."
        )
    cmd = [
        "psql",
        postgres_url,
        "--set=ON_ERROR_STOP=on",
        "--single-transaction",
        "-f",
        str(sql_path),
    ]
    print(f"[schema] running: psql <target> -f {sql_path.name}")
    subprocess.run(cmd, check=True)


def apply_schema(settings: Settings) -> None:
    if not SCHEMA_PATH.exists():
        raise RuntimeError(f"Schema file not found: {SCHEMA_PATH}")

    if settings.dry_run:
        print(f"[schema] DRY RUN — would apply {SCHEMA_PATH}")
        return

    if settings.target.postgres_url:
        _run_psql(settings.target.postgres_url, SCHEMA_PATH)
        print("[schema] applied via psql ✅")
        return

    print(
        "[schema] TARGET_POSTGRES_URL not set. Apply the schema manually:\n"
        f"  1. Open {settings.target.url} → SQL Editor\n"
        f"  2. Paste the contents of {SCHEMA_PATH}\n"
        f"  3. Run it\n"
        "[schema] skipping (manual step required)"
    )
    sys.exit(0)
