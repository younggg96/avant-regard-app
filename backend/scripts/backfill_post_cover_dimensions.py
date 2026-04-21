#!/usr/bin/env python3
"""
backfill_post_cover_dimensions.py
=================================

One-off data-cleanup script for legacy posts that predate migration 037.

Context
-------
Migration 037 added nullable `cover_width` / `cover_height` columns to the
`posts` table so the mobile feed can size masonry cards synchronously from
the backend payload instead of running an async `Image.getSize` on every
card. New posts populate the columns at publish time; posts that existed
before 037 have them `NULL` and fall back to 3/4 portrait on the client,
which is visually acceptable but still triggers the async measurement path
on the JS thread during scroll.

This script reads a `posts` table export (CSV) and fills in those two
columns by fetching each post's first cover asset and reading its natural
pixel size:

  • JPEG / PNG / WebP / GIF covers → Pillow (`PIL.Image.open().size`),
    only the image header is parsed, bodies are not decoded.
  • MP4 / MOV / WebM covers        → `ffprobe` (system binary), streams
    only enough bytes to read the first video stream's width/height.

It does NOT write to the database. Instead it emits two auditable files:

  1. `<out-dir>/cover_dimensions.sql`  — a batch of `UPDATE posts SET
     cover_width=…, cover_height=… WHERE id=…;` statements, safe to paste
     into Supabase Studio's SQL editor or pipe through psql.
  2. `<out-dir>/cover_dimensions.csv`  — one row per processed post with
     status / width / height / error, so you can spot-check before
     applying the SQL and rerun with `--retry-failed` if needed.

Usage
-----
    cd backend
    source venv/bin/activate                       # Pillow + httpx live here
    python scripts/backfill_post_cover_dimensions.py \\
        --csv /Users/you/Downloads/posts_rows.csv \\
        --out-dir ./tmp/cover_backfill             # default: alongside CSV
    # ➜ review tmp/cover_backfill/cover_dimensions.csv
    # ➜ paste tmp/cover_backfill/cover_dimensions.sql into Supabase SQL

Idempotency
-----------
Rows that already carry a non-empty `cover_width` AND `cover_height` in the
input CSV are skipped (status=`skipped_already_filled`). You can rerun the
script after reapplying a fresh export to pick up any rows that were added
since last run.

Performance
-----------
Concurrent fetches via `ThreadPoolExecutor` (default 8 workers). Images are
fetched with a short timeout + one retry; videos are handled via ffprobe
which streams only the header. For ~1k posts expect ~1-2 minutes on a
reasonable connection.
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from io import BytesIO
from pathlib import Path
from typing import Iterable, Optional
from urllib.parse import urlparse

try:
    import httpx
except ImportError as e:
    sys.exit(
        "missing dependency: httpx. activate the backend venv "
        "(`source backend/venv/bin/activate`) or `pip install httpx`."
    )

try:
    from PIL import Image
except ImportError as e:
    sys.exit(
        "missing dependency: Pillow. activate the backend venv "
        "(`source backend/venv/bin/activate`) or `pip install Pillow`."
    )


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".heic"}
VIDEO_EXTS = {".mp4", ".mov", ".webm", ".m4v"}

HTTP_TIMEOUT = 15.0  # seconds per fetch
HTTP_RETRIES = 1     # extra attempts on failure (total = 1 + retries)
DEFAULT_WORKERS = 8


# ---------------------------------------------------------------------------
# Types
# ---------------------------------------------------------------------------
@dataclass
class Row:
    post_id: int
    url: Optional[str]
    existing_cw: Optional[str]
    existing_ch: Optional[str]


@dataclass
class Result:
    post_id: int
    url: str = ""
    asset_type: str = ""          # "image" | "video" | "unknown"
    width: Optional[int] = None
    height: Optional[int] = None
    status: str = ""              # see STATUS_* constants below
    error: str = ""


STATUS_OK = "ok"
STATUS_SKIPPED_FILLED = "skipped_already_filled"
STATUS_SKIPPED_NO_URL = "skipped_no_cover_url"
STATUS_UNSUPPORTED = "unsupported_asset"
STATUS_FETCH_FAIL = "fetch_failed"
STATUS_PARSE_FAIL = "parse_failed"


# ---------------------------------------------------------------------------
# CSV parsing
# ---------------------------------------------------------------------------
def load_rows(csv_path: Path) -> list[Row]:
    """Parse the posts export into the subset of fields we care about."""
    rows: list[Row] = []
    with csv_path.open("r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        required = {"id", "image_urls", "cover_width", "cover_height"}
        missing = required - set(reader.fieldnames or [])
        if missing:
            sys.exit(f"CSV is missing required columns: {sorted(missing)}")

        for raw in reader:
            try:
                post_id = int(raw["id"])
            except (TypeError, ValueError):
                continue  # garbage row, silently drop

            urls: list[str] = []
            raw_urls = (raw.get("image_urls") or "").strip()
            if raw_urls and raw_urls not in ("[]", "null"):
                try:
                    parsed = json.loads(raw_urls)
                    if isinstance(parsed, list):
                        urls = [u for u in parsed if isinstance(u, str) and u]
                except json.JSONDecodeError:
                    pass

            first_url = urls[0] if urls else None
            rows.append(
                Row(
                    post_id=post_id,
                    url=first_url,
                    existing_cw=(raw.get("cover_width") or "").strip() or None,
                    existing_ch=(raw.get("cover_height") or "").strip() or None,
                )
            )
    return rows


# ---------------------------------------------------------------------------
# Asset probing
# ---------------------------------------------------------------------------
def classify(url: str) -> str:
    """Detect asset kind from URL path extension. Query string stripped."""
    path = urlparse(url).path.lower()
    for ext in IMAGE_EXTS:
        if path.endswith(ext):
            return "image"
    for ext in VIDEO_EXTS:
        if path.endswith(ext):
            return "video"
    return "unknown"


def probe_image(url: str, client: httpx.Client) -> tuple[int, int]:
    """Download the image once, parse header via Pillow. Raises on failure."""
    last_err: Exception | None = None
    for attempt in range(1 + HTTP_RETRIES):
        try:
            r = client.get(url, timeout=HTTP_TIMEOUT)
            r.raise_for_status()
            with Image.open(BytesIO(r.content)) as img:
                w, h = img.size
            if w <= 0 or h <= 0:
                raise ValueError(f"invalid size ({w}x{h})")
            return w, h
        except Exception as e:
            last_err = e
            if attempt < HTTP_RETRIES:
                time.sleep(0.5 * (attempt + 1))
    raise last_err  # type: ignore[misc]


def probe_video(url: str) -> tuple[int, int]:
    """Shell out to ffprobe. ffprobe streams only the header."""
    cmd = [
        "ffprobe",
        "-v", "error",
        "-select_streams", "v:0",
        "-show_entries", "stream=width,height",
        "-of", "csv=s=,:p=0",
        "-timeout", "10000000",  # 10s in microseconds
        url,
    ]
    try:
        out = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=30,
        )
    except FileNotFoundError:
        raise RuntimeError(
            "ffprobe not found. install ffmpeg (`brew install ffmpeg`) "
            "or skip video posts."
        )
    except subprocess.TimeoutExpired:
        raise RuntimeError("ffprobe timed out")

    if out.returncode != 0:
        raise RuntimeError(f"ffprobe exit {out.returncode}: {out.stderr.strip()}")

    # ffprobe's csv formatter is a little loose: some mov containers emit a
    # trailing comma (`668,1552,`) and multi-stream files emit one line per
    # stream even though we asked for `v:0`. Grab the first line that has at
    # least two numeric fields and take its first two numbers.
    width = height = None
    for line in out.stdout.splitlines():
        nums = [p for p in line.strip().split(",") if p.strip().isdigit()]
        if len(nums) >= 2:
            width, height = int(nums[0]), int(nums[1])
            break
    if width is None or height is None:
        raise RuntimeError(f"ffprobe returned unexpected output: {out.stdout!r}")
    if width <= 0 or height <= 0:
        raise RuntimeError(f"ffprobe returned invalid size ({width}x{height})")
    return width, height


def process_row(row: Row, client: httpx.Client) -> Result:
    """Top-level per-row probe with full status classification."""
    result = Result(post_id=row.post_id, url=row.url or "")

    if row.existing_cw and row.existing_ch:
        result.status = STATUS_SKIPPED_FILLED
        return result
    if not row.url:
        result.status = STATUS_SKIPPED_NO_URL
        return result

    kind = classify(row.url)
    result.asset_type = kind

    try:
        if kind == "image":
            w, h = probe_image(row.url, client)
        elif kind == "video":
            w, h = probe_video(row.url)
        else:
            result.status = STATUS_UNSUPPORTED
            result.error = f"unknown extension in {row.url!r}"
            return result
    except Exception as e:
        # Distinguish network failures from decode failures where we can.
        msg = str(e)
        if isinstance(e, (httpx.RequestError, httpx.HTTPStatusError)):
            result.status = STATUS_FETCH_FAIL
        else:
            result.status = STATUS_PARSE_FAIL
        result.error = msg[:200]
        return result

    result.width = w
    result.height = h
    result.status = STATUS_OK
    return result


# ---------------------------------------------------------------------------
# Output
# ---------------------------------------------------------------------------
SQL_HEADER = """-- Auto-generated by backfill_post_cover_dimensions.py
-- Backfills cover_width / cover_height for posts published before
-- migration 037. Safe to apply multiple times: it only touches rows where
-- BOTH columns are NULL, so a second run is a no-op against already-filled
-- posts (and leaves newer publishes alone).
--
-- Review the companion cover_dimensions.csv audit log before applying.

BEGIN;
"""

SQL_FOOTER = """
COMMIT;
"""


def write_outputs(results: Iterable[Result], out_dir: Path) -> dict[str, int]:
    """Emit the SQL patch + CSV audit trail. Returns status counts."""
    out_dir.mkdir(parents=True, exist_ok=True)
    sql_path = out_dir / "cover_dimensions.sql"
    csv_path = out_dir / "cover_dimensions.csv"

    counts: dict[str, int] = {}
    with sql_path.open("w", encoding="utf-8") as sql_f, \
         csv_path.open("w", encoding="utf-8", newline="") as csv_f:
        sql_f.write(SQL_HEADER)

        writer = csv.writer(csv_f)
        writer.writerow(
            ["post_id", "asset_type", "width", "height", "status", "error", "url"]
        )

        for r in results:
            counts[r.status] = counts.get(r.status, 0) + 1
            writer.writerow(
                [r.post_id, r.asset_type, r.width or "", r.height or "",
                 r.status, r.error, r.url]
            )
            if r.status == STATUS_OK and r.width and r.height:
                sql_f.write(
                    f"UPDATE posts SET cover_width = {r.width}, "
                    f"cover_height = {r.height} "
                    f"WHERE id = {r.post_id} "
                    f"AND cover_width IS NULL AND cover_height IS NULL;\n"
                )

        sql_f.write(SQL_FOOTER)

    print(f"\n✅ wrote {sql_path}")
    print(f"✅ wrote {csv_path}")
    return counts


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> None:
    parser = argparse.ArgumentParser(
        description="Backfill cover_width/cover_height for legacy posts.",
    )
    parser.add_argument(
        "--csv", required=True, type=Path,
        help="Path to posts_rows.csv (Supabase export).",
    )
    parser.add_argument(
        "--out-dir", type=Path, default=None,
        help="Output directory. Defaults to <csv_dir>/cover_backfill.",
    )
    parser.add_argument(
        "--workers", type=int, default=DEFAULT_WORKERS,
        help=f"Concurrent fetches. Default {DEFAULT_WORKERS}.",
    )
    parser.add_argument(
        "--limit", type=int, default=None,
        help="Process at most N rows (for smoke-testing).",
    )
    args = parser.parse_args()

    if not args.csv.exists():
        sys.exit(f"CSV not found: {args.csv}")
    out_dir = args.out_dir or args.csv.parent / "cover_backfill"

    rows = load_rows(args.csv)
    print(f"📄 loaded {len(rows)} posts from {args.csv}")

    if args.limit:
        rows = rows[: args.limit]
        print(f"⚙️  --limit {args.limit} in effect")

    results: list[Result] = []
    pending = [r for r in rows if not (r.existing_cw and r.existing_ch)]
    skipped_filled = len(rows) - len(pending)
    print(f"⏭️  {skipped_filled} already have dims, probing {len(pending)}")

    # Pre-seed results with the skipped rows so the audit CSV is complete.
    for r in rows:
        if r.existing_cw and r.existing_ch:
            results.append(Result(
                post_id=r.post_id, url=r.url or "",
                status=STATUS_SKIPPED_FILLED,
            ))

    done = 0
    total = len(pending)
    with httpx.Client(follow_redirects=True, http2=False) as client, \
         ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {pool.submit(process_row, r, client): r for r in pending}
        for fut in as_completed(futures):
            res = fut.result()
            results.append(res)
            done += 1
            if done % 25 == 0 or done == total:
                print(f"   probed {done}/{total}")

    results.sort(key=lambda r: r.post_id)
    counts = write_outputs(results, out_dir)

    print("\n— summary —")
    for status, n in sorted(counts.items(), key=lambda kv: -kv[1]):
        print(f"  {status:<28s} {n}")


if __name__ == "__main__":
    main()
