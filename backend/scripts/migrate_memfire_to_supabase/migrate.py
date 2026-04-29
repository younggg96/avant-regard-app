"""CLI entrypoint for the MemFire → Supabase structure-only migration.

This toolkit replicates the *empty* backend infrastructure on a new Supabase
project — tables, triggers, functions, extensions, and Storage buckets —
WITHOUT copying any user data or files.

Examples
--------
Dry-run first (no writes, just reports):

    MIGRATION_DRY_RUN=1 python -m scripts.migrate_memfire_to_supabase.migrate all

Apply everything:

    python -m scripts.migrate_memfire_to_supabase.migrate all

Individual stages:

    python -m scripts.migrate_memfire_to_supabase.migrate schema
    python -m scripts.migrate_memfire_to_supabase.migrate storage
"""

from __future__ import annotations

import argparse
import sys
import traceback

from .config import Settings, load_settings
from .migrate_schema import apply_schema
from .migrate_storage import migrate_storage


def _cmd_schema(settings: Settings, _args: argparse.Namespace) -> None:
    apply_schema(settings)


def _cmd_storage(settings: Settings, _args: argparse.Namespace) -> None:
    migrate_storage(settings)


def _cmd_all(settings: Settings, args: argparse.Namespace) -> None:
    print("=== [1/2] schema ===")
    try:
        _cmd_schema(settings, args)
    except SystemExit:
        # apply_schema exits 0 when it needs a manual SQL Editor step.
        print(
            "[all] schema requires manual step — pausing. Re-run once you've "
            "applied the schema on the target."
        )
        return
    print("\n=== [2/2] storage ===")
    _cmd_storage(settings, args)
    print("\n✅ structure migration complete (no data was copied)")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="migrate-memfire-to-supabase")
    sub = parser.add_subparsers(dest="cmd", required=True)

    sub.add_parser("schema", help="apply schema SQL to the target project")
    sub.add_parser("storage", help="create empty Storage buckets on the target")
    sub.add_parser("all", help="run schema → storage")

    args = parser.parse_args(argv)
    settings = load_settings()
    print(
        f"source={settings.source.url}\n"
        f"target={settings.target.url}\n"
        f"dry_run={settings.dry_run}"
    )

    handlers = {"schema": _cmd_schema, "storage": _cmd_storage, "all": _cmd_all}
    try:
        handlers[args.cmd](settings, args)
    except Exception:
        traceback.print_exc()
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
