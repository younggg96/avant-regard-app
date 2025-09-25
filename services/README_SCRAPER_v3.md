
# Vogue Runway Scraper — v3

A resilient requests+BeautifulSoup scraper for Vogue Runway designer pages & show pages.

## Install
```bash
pip install -r requirements_v3.txt
```

## Run
```bash
python vogue_scraper_v3.py --input Designers_and_Show_Links.xlsx --sheet Sheet1 --out out_v3 --max-shows 5
# Download images too:
python vogue_scraper_v3.py --input Designers_and_Show_Links.xlsx --out out_v3 --download-images --rate 1.0
```

## Outputs
- `out_v3/shows.csv` — one row per show
- `out_v3/images.csv` — hero & look images
- `out_v3/shows.ndjson` — newline‑delimited JSON

> If Vogue changes markup, tweak selectors in `parse_designer_for_shows` and `parse_show_page`.
> Respect robots.txt and terms of use. Use modest `--rate`.
