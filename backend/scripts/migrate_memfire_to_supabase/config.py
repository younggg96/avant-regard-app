"""Shared configuration for the MemFire → Supabase structure migration.

Environment variables (read from the shell or a `.env` sitting next to this
file). Source defaults to the existing MemFire instance, target is the new
Supabase project.

Required:
    SOURCE_SUPABASE_URL
    SOURCE_SUPABASE_SERVICE_KEY
    TARGET_SUPABASE_URL
    TARGET_SUPABASE_SERVICE_KEY

Optional:
    TARGET_POSTGRES_URL    direct Postgres conn string (Supabase "connection
                           string"), enables automated schema application
                           via psql. Without it, you paste the SQL manually
                           into the SQL Editor.
    MIGRATION_DRY_RUN      "1" to skip writes
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from supabase import Client, create_client


SCRIPT_DIR = Path(__file__).resolve().parent
load_dotenv(SCRIPT_DIR / ".env")
load_dotenv(SCRIPT_DIR.parent.parent / ".env")


def _require(name: str) -> str:
    val = os.environ.get(name)
    if not val:
        raise RuntimeError(
            f"Missing required env var: {name}. Populate "
            f"{SCRIPT_DIR / '.env'} (see .env.example) and retry."
        )
    return val


@dataclass(frozen=True)
class Endpoint:
    label: str
    url: str
    service_key: str
    postgres_url: Optional[str]

    def client(self) -> Client:
        return create_client(self.url, self.service_key)


@dataclass(frozen=True)
class Settings:
    source: Endpoint
    target: Endpoint
    dry_run: bool


def load_settings() -> Settings:
    source = Endpoint(
        label="source(MemFire)",
        url=_require("SOURCE_SUPABASE_URL"),
        service_key=_require("SOURCE_SUPABASE_SERVICE_KEY"),
        postgres_url=None,  # source PG not needed for structure-only migration
    )
    target = Endpoint(
        label="target(Supabase)",
        url=_require("TARGET_SUPABASE_URL"),
        service_key=_require("TARGET_SUPABASE_SERVICE_KEY"),
        postgres_url=os.environ.get("TARGET_POSTGRES_URL"),
    )
    if source.url.rstrip("/") == target.url.rstrip("/"):
        raise RuntimeError(
            "SOURCE_SUPABASE_URL and TARGET_SUPABASE_URL are identical. "
            "Migration would overwrite the source project."
        )
    return Settings(
        source=source,
        target=target,
        dry_run=os.environ.get("MIGRATION_DRY_RUN") == "1",
    )
