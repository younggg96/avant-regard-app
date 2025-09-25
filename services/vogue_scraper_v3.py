#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Vogue Runway Scraper — v3 (clean, resilient)
============================================
- Reads an Excel/CSV with columns: Designers, Vogue URL  (aliases supported)
- For each designer page:
    • Collect show links via anchors + JSON scripts (__NEXT_DATA__, ld+json)
- For each show page:
    • Parse season, category, date, title, author, review text
    • Collect hero & look images
- Outputs:
    • shows.csv (one row per show)
    • images.csv (one row per image; fields: show_url, image_url, image_type)
    • shows.ndjson (one JSON per line)

CLI:
    python vogue_scraper_v3.py --input Designers_and_Show_Links.xlsx --sheet Sheet1 --out out_v3 --max-shows 5
    python vogue_scraper_v3.py --input Designers_and_Show_Links.csv --out out_v3 --download-images --rate 1.0

Notes:
- This scraper uses requests+BeautifulSoup (no JS). If a page is JS-only, you may
  need a headless browser; selectors are factored to be easily adjusted.
- Be polite: use rate limiting and check site policies.
"""
import argparse
import csv
import json
import os
import re
import sys
import time
from dataclasses import dataclass, asdict
from typing import List, Optional, Tuple

import pandas as pd
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse

# ---------- New imports for robust IO ----------
from pathlib import Path
import difflib

# ---------- HTTP ----------

DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
}


def build_session(retries: int = 3, backoff: float = 0.8) -> requests.Session:
    s = requests.Session()
    s.headers.update(DEFAULT_HEADERS)
    # attach retry/backoff metadata onto the session for reuse
    s.retries = retries
    s.backoff = backoff
    return s


def http_get(session: requests.Session, url: str, rate: float) -> Optional[str]:
    tries = max(int(getattr(session, "retries", 3)), 1)
    for i in range(tries):
        try:
            r = session.get(url, timeout=25)
            if rate > 0:
                time.sleep(rate)
            if r.status_code == 200 and r.text:
                return r.text
            else:
                print(f"[WARN] GET {url} -> {r.status_code}", file=sys.stderr)
        except Exception as e:
            print(f"[ERR]  GET {url}: {e}", file=sys.stderr)
        time.sleep(getattr(session, "backoff", 0.8) * (i + 1))
    return None


def http_download(session: requests.Session, url: str, path: str, rate: float) -> bool:
    try:
        resp = session.get(url, timeout=30, stream=True)
        if rate > 0:
            time.sleep(rate)
        if resp.status_code == 200:
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, "wb") as f:
                for chunk in resp.iter_content(8192):
                    if chunk:
                        f.write(chunk)
            return True
        print(f"[WARN] DL  {url} -> {resp.status_code}", file=sys.stderr)
    except Exception as e:
        print(f"[ERR]  DL  {url}: {e}", file=sys.stderr)
    return False


# ---------- Models ----------


@dataclass
class ShowRow:
    designer: str
    designer_url: str
    show_url: str
    season: Optional[str] = None
    category: Optional[str] = None
    city: Optional[str] = None
    collection_date: Optional[str] = None
    review_title: Optional[str] = None
    review_author: Optional[str] = None
    review_text: Optional[str] = None
    looks_count: Optional[int] = None


@dataclass
class ImageRow:
    show_url: str
    image_url: str
    image_type: str  # hero|look


# ---------- Utilities: robust path + input loading ----------


def resolve_input_path(input_excel: str) -> Path:
    """
    Resolve input path; if missing:
      - print cwd / input
      - search repo for similar names (*.xls*, *.csv) and suggest candidates
    """
    p = Path(input_excel).expanduser()
    print(f"[debug] cwd        = {Path.cwd()}")
    print(f"[debug] input_arg  = {input_excel}")

    if p.exists():
        print(f"[debug] resolved   = {p.resolve()}")
        return p

    # repository root assumption: this file is under <repo>/services/xxx.py
    repo_root = Path(__file__).resolve().parents[1]
    candidates = list(repo_root.rglob("*.xls*")) + list(repo_root.rglob("*.csv"))
    names = [c.name for c in candidates]
    close = difflib.get_close_matches(Path(input_excel).name, names, n=8, cutoff=0.4)

    print(f"[error] File not found: {input_excel}", file=sys.stderr)
    print(f"[hint]  Repo root: {repo_root}", file=sys.stderr)
    if close:
        print("[hint]  Did you mean one of these?", file=sys.stderr)
        for name in close:
            hit = next(x for x in candidates if x.name == name)
            print(f"   - {hit}", file=sys.stderr)
    else:
        print("[hint]  No similar names found under repo.", file=sys.stderr)

    raise FileNotFoundError(input_excel)


def load_input_dataframe(path: Path, sheet: str) -> pd.DataFrame:
    """
    Auto-detect extension and load DataFrame.
      - .csv           -> read_csv
      - .xls/.xlsx     -> read_excel(sheet_name=sheet)
    Normalize/validate columns with aliases.
    """
    ext = path.suffix.lower()
    try:
        if ext == ".csv":
            df = pd.read_csv(path)
        elif ext in (".xls", ".xlsx"):
            try:
                df = pd.read_excel(path, sheet_name=sheet)
            except ImportError as ie:
                # pandas reading .xlsx requires openpyxl
                raise RuntimeError(
                    "Reading .xlsx requires 'openpyxl'. Try:\n  pip install openpyxl"
                ) from ie
        else:
            raise RuntimeError(f"Unsupported input extension: {ext}")
    except Exception as e:
        print(f"[error] failed to load input file: {path}", file=sys.stderr)
        raise

    # normalize column names
    df.columns = [str(c).strip() for c in df.columns]
    normalized = {c.lower(): c for c in df.columns}

    # alias picking
    def pick(*aliases) -> Optional[str]:
        for a in aliases:
            if a in normalized:
                return normalized[a]
        return None

    col_designers = pick("designers", "designer", "designer name", "brand")
    col_url = pick("vogue url", "url", "link", "show url")

    missing = []
    if not col_designers:
        missing.append("Designers (or: Designer / Designer Name / Brand)")
    if not col_url:
        missing.append("Vogue URL (or: URL / Link / Show URL)")
    if missing:
        raise AssertionError(
            "Excel/CSV must contain columns:\n  - " + "\n  - ".join(missing)
        )

    # keep essential columns under canonical names
    df = df[[col_designers, col_url]].rename(
        columns={col_designers: "Designers", col_url: "Vogue URL"}
    )

    # drop empty rows
    df = df.dropna(subset=["Designers", "Vogue URL"])
    return df


# ---------- Parsing ----------


def normalize_url(base: str, href: str) -> str:
    full = urljoin(base, href)
    return full.split("?")[0].split("#")[0]


def collect_urls_from_json(obj) -> List[str]:
    out = []
    if isinstance(obj, dict):
        for _, v in obj.items():
            if isinstance(v, str) and "vogue.com/fashion-shows/" in v:
                out.append(v.split("?")[0])
            else:
                out.extend(collect_urls_from_json(v))
    elif isinstance(obj, list):
        for v in obj:
            out.extend(collect_urls_from_json(v))
    return out


def parse_designer_for_shows(designer_url: str, html: str) -> List[str]:
    soup = BeautifulSoup(html, "lxml")
    links = set()

    # 1) Anchor discovery
    for a in soup.select("a[href]"):
        href = a.get("href") or ""
        if not href:
            continue
        full = normalize_url(designer_url, href)
        if "vogue.com/fashion-shows/" in full and "/designer/" not in full:
            links.add(full)

    # 2) JSON scripts: __NEXT_DATA__ and ld+json
    for sc in soup.find_all("script"):
        is_json = (sc.get("id") == "__NEXT_DATA__") or (
            "json" in (sc.get("type") or "").lower()
        )
        if not is_json:
            continue
        try:
            data = json.loads(sc.string or "{}")
            for u in collect_urls_from_json(data):
                if "vogue.com/fashion-shows/" in u and "/designer/" not in u:
                    links.add(u)
        except Exception:
            pass

    return sorted(links)


def text_or_none(node) -> Optional[str]:
    if not node:
        return None
    t = node.get_text(" ", strip=True)
    return t or None


def parse_show_page(show_url: str, html: str) -> Tuple[ShowRow, List[ImageRow]]:
    soup = BeautifulSoup(html, "lxml")

    season = category = city = date = title = author = None
    review_text = None
    images: List[ImageRow] = []
    seen = set()

    # JSON-LD
    for sc in soup.find_all("script", {"type": "application/ld+json"}):
        try:
            data = json.loads(sc.string or "{}")
        except Exception:
            continue

        def walk(d):
            nonlocal season, category, city, date, title, author
            if isinstance(d, dict):
                if not date and isinstance(d.get("datePublished"), str):
                    date = d["datePublished"]
                if not title and isinstance(d.get("headline"), str):
                    title = d["headline"]
                # author
                a = d.get("author")
                if not author and a:
                    if isinstance(a, dict) and isinstance(a.get("name"), str):
                        author = a["name"]
                    elif isinstance(a, list):
                        for it in a:
                            if isinstance(it, dict) and isinstance(it.get("name"), str):
                                author = it["name"]
                                break
                # season/category hints
                for key in ("about", "keywords"):
                    v = d.get(key)
                    if isinstance(v, str):
                        s = v.lower()
                        if any(
                            k in s
                            for k in ["spring", "fall", "resort", "pre-fall", "autumn"]
                        ):
                            season = season or v
                        if any(k in s for k in ["ready", "menswear", "couture"]):
                            category = category or v
                for v in d.values():
                    walk(v)
            elif isinstance(d, list):
                for it in d:
                    walk(it)

        walk(data)

    # Fallbacks
    if not author:
        author = text_or_none(
            soup.select_one('[data-test="AuthorByline"], a[href*="/contributor/"]')
        )
    if not title:
        title = text_or_none(soup.find(["h1", "h2"]))

    # Review container
    container = (
        soup.select_one('[data-test="ReviewText"]')
        or soup.select_one("article")
        or soup.select_one("section.review")
    )
    if container:
        parts = [
            p.get_text(" ", strip=True)
            for p in container.find_all(["p", "div"])
            if p.get_text(strip=True)
        ]
        if parts:
            review_text = "\n\n".join(parts)

    # Images
    for m in soup.select('meta[property="og:image"]'):
        u = m.get("content")
        if u and u not in seen:
            images.append(ImageRow(show_url=show_url, image_url=u, image_type="hero"))
            seen.add(u)

    for img in soup.find_all("img"):
        u = img.get("src") or img.get("data-src") or img.get("data-original")
        if not u or "data:image" in u:
            continue
        if not re.match(r"^https?://", u):
            u = urljoin(show_url, u)
        if any(tok in u for tok in ["/photos/", "/images/", "/im", "/look"]):
            if u not in seen:
                images.append(
                    ImageRow(show_url=show_url, image_url=u, image_type="look")
                )
                seen.add(u)

    # Path hints
    path = urlparse(show_url).path.lower()
    m = re.search(r"/fashion-shows/([^/]+)/", path)
    if m and not season:
        season = m.group(1).replace("-", " ").title()
    if not category:
        if "ready-to-wear" in path:
            category = "Ready-to-Wear"
        elif "couture" in path:
            category = "Couture"
        elif "menswear" in path:
            category = "Menswear"

    show = ShowRow(
        designer="",
        designer_url="",
        show_url=show_url,
        season=season,
        category=category,
        city=city,
        collection_date=date,
        review_title=title,
        review_author=author,
        review_text=review_text,
        looks_count=len([i for i in images if i.image_type == "look"]) or None,
    )
    return show, images


# ---------- Runner ----------


def scrape(
    input_excel: str,
    sheet: str,
    out_dir: str,
    max_shows: int,
    rate: float,
    download_images: bool,
):
    os.makedirs(out_dir, exist_ok=True)
    shows_csv = os.path.join(out_dir, "shows.csv")
    images_csv = os.path.join(out_dir, "images.csv")
    ndjson_path = os.path.join(out_dir, "shows.ndjson")
    img_dir = os.path.join(out_dir, "images")

    # ---- new: robust path + loader ----
    inp_path = resolve_input_path(input_excel)
    df = load_input_dataframe(inp_path, sheet)
    print(f"[info] Loaded {len(df)} rows from {inp_path}")

    sess = build_session()

    shows_writer = csv.DictWriter(
        open(shows_csv, "w", newline="", encoding="utf-8"),
        fieldnames=list(ShowRow.__annotations__.keys()),
    )
    shows_writer.writeheader()
    images_writer = csv.DictWriter(
        open(images_csv, "w", newline="", encoding="utf-8"),
        fieldnames=list(ImageRow.__annotations__.keys()),
    )
    images_writer.writeheader()
    ndjson_f = open(ndjson_path, "w", encoding="utf-8")

    for _, row in df.iterrows():
        designer = str(row["Designers"]).strip()
        durl = str(row["Vogue URL"]).strip()
        if not durl.startswith("http"):
            print(f"[SKIP] {designer}: invalid URL: {durl}")
            continue

        print(f"\n=== {designer} ===\n{durl}")
        html = http_get(sess, durl, rate)
        if not html:
            continue

        show_links = parse_designer_for_shows(durl, html)
        if not show_links:
            print(f"[WARN] No shows found: {designer}")
            continue

        if max_shows and max_shows > 0:
            show_links = show_links[:max_shows]

        for s in show_links:
            print(f" - show: {s}")
            shtml = http_get(sess, s, rate)
            if not shtml:
                continue

            show, imgs = parse_show_page(s, shtml)
            show.designer = designer
            show.designer_url = durl

            shows_writer.writerow(asdict(show))
            ndjson_f.write(json.dumps(asdict(show), ensure_ascii=False) + "\n")

            for im in imgs:
                images_writer.writerow(asdict(im))
                if download_images:
                    # images/<designer>/<season>/<filename>
                    dslug = re.sub(r"[^a-z0-9]+", "-", designer.lower()).strip("-")
                    sslug = re.sub(
                        r"[^a-z0-9]+", "-", (show.season or "unknown").lower()
                    ).strip("-")
                    fn = os.path.basename(urlparse(im.image_url).path) or "img.jpg"
                    out_path = os.path.join(img_dir, dslug, sslug, fn)
                    http_download(sess, im.image_url, out_path, rate)

    ndjson_f.close()
    print(f"\nDone.\n- {shows_csv}\n- {images_csv}\n- {ndjson_path}\n")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", required=True, help="Path to Excel/CSV file")
    ap.add_argument(
        "--sheet",
        default="Sheet1",
        help="Sheet name (used for Excel only; ignored for CSV)",
    )
    ap.add_argument("--out", default="out_v3", help="Output directory")
    ap.add_argument(
        "--max-shows", type=int, default=0, help="Max shows per designer (0 = all)"
    )
    ap.add_argument(
        "--rate",
        type=float,
        default=0.8,
        help="Seconds sleep between requests (politeness)",
    )
    ap.add_argument(
        "--download-images", action="store_true", help="Download images to out/images"
    )
    args = ap.parse_args()

    scrape(
        args.input,
        args.sheet,
        args.out,
        args.max_shows,
        args.rate,
        args.download_images,
    )


if __name__ == "__main__":
    main()
