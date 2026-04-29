"""Replicate Storage bucket *definitions* from source to target.

We only copy the bucket list and each bucket's public/private + file-size-limit
+ allowed-MIME-types settings. Files are NOT copied — this migration is
structure-only.

Why read from source at all?
    The project uses at least one bucket named `images` (see
    `backend/app/services/file_service.py`), but future buckets might be added
    without this script being updated. Listing the source keeps the target
    aligned automatically.

Why not copy files?
    Scope: user wants a clean empty target. Re-uploads happen naturally as
    users interact with the new backend.
"""

from __future__ import annotations

from typing import Any, Dict, List

from .config import Endpoint, Settings


def _list_buckets(endpoint: Endpoint) -> List[Dict[str, Any]]:
    """Return normalized bucket descriptors regardless of SDK return shape."""
    raw = endpoint.client().storage.list_buckets()
    normalized: List[Dict[str, Any]] = []
    for b in raw:
        name = getattr(b, "name", None) or (b["name"] if isinstance(b, dict) else None)
        if not name:
            continue
        public = bool(
            getattr(b, "public", None)
            if not isinstance(b, dict)
            else b.get("public", False)
        )
        file_size_limit = (
            getattr(b, "file_size_limit", None)
            if not isinstance(b, dict)
            else b.get("file_size_limit")
        )
        allowed_mime_types = (
            getattr(b, "allowed_mime_types", None)
            if not isinstance(b, dict)
            else b.get("allowed_mime_types")
        )
        normalized.append(
            {
                "name": name,
                "public": public,
                "file_size_limit": file_size_limit,
                "allowed_mime_types": allowed_mime_types,
            }
        )
    return normalized


def _ensure_bucket(target: Endpoint, bucket: Dict[str, Any], dry_run: bool) -> str:
    """Create the bucket on the target if it does not exist. Return status string."""
    existing = {b["name"] for b in _list_buckets(target)}
    name = bucket["name"]
    if name in existing:
        return "skip (already exists)"
    if dry_run:
        return f"DRY RUN would create (public={bucket['public']})"

    options: Dict[str, Any] = {"public": bucket["public"]}
    if bucket.get("file_size_limit") is not None:
        options["file_size_limit"] = bucket["file_size_limit"]
    if bucket.get("allowed_mime_types"):
        options["allowed_mime_types"] = bucket["allowed_mime_types"]

    target.client().storage.create_bucket(name, options=options)
    return f"created (public={bucket['public']})"


def migrate_storage(settings: Settings) -> None:
    print("[storage] listing source buckets…")
    source_buckets = _list_buckets(settings.source)
    if not source_buckets:
        print("[storage] source has no buckets — nothing to do")
        return
    print(f"[storage] source has {len(source_buckets)} bucket(s)")

    for bucket in source_buckets:
        status = _ensure_bucket(settings.target, bucket, settings.dry_run)
        print(f"[storage] {bucket['name']} → {status}")

    print("[storage] done ✅ (structure only, no files copied)")
