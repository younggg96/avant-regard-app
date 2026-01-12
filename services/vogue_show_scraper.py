#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Vogue Runway 秀场信息爬虫（简化版）
===================================
只获取每个秀场的标题和一张封面图，输出为JSON格式

用法:
    python vogue_show_scraper.py --input processed_brands.csv --output shows.json
    python vogue_show_scraper.py --input processed_brands.csv --start-year 2020 --end-year 2025

依赖:
    pip install pandas requests beautifulsoup4 lxml
"""

import argparse
import json
import os
import re
import sys
import time
from dataclasses import dataclass, asdict
from typing import List, Optional
from urllib.parse import urljoin, urlparse

import pandas as pd
import requests
from bs4 import BeautifulSoup


# HTTP 配置
DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
}


@dataclass
class ShowInfo:
    """秀场信息"""

    designer: str  # 设计师/品牌名
    season: str  # 季节 (如: Fall 2024 Ready-to-Wear)
    title: str  # 秀场标题
    cover_image: str  # 封面图URL
    show_url: str  # 秀场页面URL
    year: Optional[int] = None  # 年份
    category: Optional[str] = None  # 类别 (Ready-to-Wear, Couture, Menswear)


def build_session() -> requests.Session:
    """创建HTTP会话"""
    session = requests.Session()
    session.headers.update(DEFAULT_HEADERS)
    return session


def http_get(session: requests.Session, url: str, rate: float = 0.5) -> Optional[str]:
    """发送GET请求"""
    try:
        response = session.get(url, timeout=30)
        time.sleep(rate)
        if response.status_code == 200:
            return response.text
        print(f"[WARN] GET {url} -> {response.status_code}", file=sys.stderr)
    except Exception as e:
        print(f"[ERR] GET {url}: {e}", file=sys.stderr)
    return None


def extract_year_from_season(season: str) -> Optional[int]:
    """从季节名称中提取年份"""
    match = re.search(r"20\d{2}", season)
    return int(match.group()) if match else None


def extract_category(season: str) -> Optional[str]:
    """提取秀场类别"""
    season_lower = season.lower()
    if "ready-to-wear" in season_lower or "ready to wear" in season_lower:
        return "Ready-to-Wear"
    elif "couture" in season_lower:
        return "Couture"
    elif "menswear" in season_lower:
        return "Menswear"
    elif "resort" in season_lower:
        return "Resort"
    elif "pre-fall" in season_lower:
        return "Pre-Fall"
    return None


def get_show_links_from_designer(
    session: requests.Session,
    designer_url: str,
    start_year: int,
    end_year: int,
    rate: float,
) -> List[str]:
    """从设计师页面获取所有秀场链接"""
    html = http_get(session, designer_url, rate)
    if not html:
        return []

    soup = BeautifulSoup(html, "lxml")
    show_links = set()

    # 从页面中提取所有秀场链接
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if "/fashion-shows/" in href and "/designer/" not in href:
            # 检查年份范围
            for year in range(start_year, end_year + 1):
                if str(year) in href:
                    full_url = (
                        href
                        if href.startswith("http")
                        else f"https://www.vogue.com{href}"
                    )
                    show_links.add(full_url)
                    break

    # 尝试从 JSON 脚本中提取更多链接
    for script in soup.find_all("script"):
        if script.get("id") == "__NEXT_DATA__" or "json" in (
            script.get("type") or ""
        ).lower():
            try:
                data = json.loads(script.string or "{}")
                extract_urls_from_json(data, show_links, start_year, end_year)
            except Exception:
                pass

    return sorted(show_links)


def extract_urls_from_json(
    obj, urls: set, start_year: int, end_year: int
) -> None:
    """递归从JSON中提取URL"""
    if isinstance(obj, dict):
        for value in obj.values():
            if isinstance(value, str) and "vogue.com/fashion-shows/" in value:
                if "/designer/" not in value:
                    for year in range(start_year, end_year + 1):
                        if str(year) in value:
                            urls.add(value.split("?")[0])
                            break
            else:
                extract_urls_from_json(value, urls, start_year, end_year)
    elif isinstance(obj, list):
        for item in obj:
            extract_urls_from_json(item, urls, start_year, end_year)


def parse_show_page(
    session: requests.Session, show_url: str, designer: str, rate: float
) -> Optional[ShowInfo]:
    """解析秀场页面，获取标题和封面图"""
    html = http_get(session, show_url, rate)
    if not html:
        return None

    soup = BeautifulSoup(html, "lxml")

    # 提取标题
    title = None
    # 尝试从 h1 获取
    h1 = soup.find("h1")
    if h1:
        title = h1.get_text(strip=True)
    # 尝试从 meta 标签获取
    if not title:
        og_title = soup.find("meta", property="og:title")
        if og_title:
            title = og_title.get("content", "")
    # 尝试从 title 标签获取
    if not title:
        title_tag = soup.find("title")
        if title_tag:
            title = title_tag.get_text(strip=True)

    # 提取封面图
    cover_image = None
    # 优先从 og:image 获取
    og_image = soup.find("meta", property="og:image")
    if og_image:
        cover_image = og_image.get("content", "")
    # 备选：从页面第一张大图获取
    if not cover_image:
        for img in soup.find_all("img"):
            src = img.get("src") or img.get("data-src")
            if src and ("assets.vogue.com" in src or "photos.vogue.com" in src):
                # 跳过小图标
                if any(skip in src.lower() for skip in ["logo", "icon", "avatar"]):
                    continue
                cover_image = src
                break

    # 从URL提取季节信息
    path_parts = urlparse(show_url).path.split("/")
    season_slug = path_parts[2] if len(path_parts) > 2 else ""
    season = season_slug.replace("-", " ").title()

    # 清理标题
    if title:
        # 移除 " | Vogue" 后缀
        title = re.sub(r"\s*\|\s*Vogue.*$", "", title)
        title = title.strip()

    if not title:
        title = f"{designer} {season}"

    return ShowInfo(
        designer=designer,
        season=season,
        title=title,
        cover_image=cover_image or "",
        show_url=show_url,
        year=extract_year_from_season(season),
        category=extract_category(season),
    )


def scrape_shows(
    input_csv: str,
    output_json: str,
    start_year: int,
    end_year: int,
    rate: float,
    max_shows_per_brand: int = 0,
) -> None:
    """爬取所有秀场信息"""
    print(f"读取品牌列表: {input_csv}")
    df = pd.read_csv(input_csv)

    brand_col = df.columns[0]
    slug_col = "vogue_slug"

    if slug_col not in df.columns:
        print(f"错误: CSV缺少 '{slug_col}' 列，请先运行预处理脚本", file=sys.stderr)
        return

    print(f"找到 {len(df)} 个品牌")
    print(f"年份范围: {start_year} - {end_year}")
    print("-" * 50)

    session = build_session()
    all_shows: List[ShowInfo] = []

    for idx, row in df.iterrows():
        brand_name = str(row[brand_col]).strip()
        brand_slug = str(row[slug_col]).strip()

        if not brand_slug or brand_slug == "nan":
            continue

        designer_url = f"https://www.vogue.com/fashion-shows/designer/{brand_slug}"
        print(f"\n[{idx + 1}/{len(df)}] {brand_name}")

        # 获取秀场链接
        show_links = get_show_links_from_designer(
            session, designer_url, start_year, end_year, rate
        )

        if not show_links:
            print(f"  未找到秀场")
            continue

        print(f"  找到 {len(show_links)} 个秀场")

        # 限制每个品牌的秀场数量
        if max_shows_per_brand > 0:
            show_links = show_links[:max_shows_per_brand]

        # 解析每个秀场
        for show_url in show_links:
            show_info = parse_show_page(session, show_url, brand_name, rate)
            if show_info:
                all_shows.append(show_info)
                print(f"    ✓ {show_info.season}")

    # 保存为JSON
    print(f"\n" + "=" * 50)
    print(f"总共获取 {len(all_shows)} 个秀场")

    output_data = [asdict(show) for show in all_shows]

    with open(output_json, "w", encoding="utf-8") as f:
        json.dump(output_data, f, ensure_ascii=False, indent=2)

    print(f"✅ 已保存到: {output_json}")


def main():
    parser = argparse.ArgumentParser(description="Vogue Runway 秀场信息爬虫")
    parser.add_argument("--input", "-i", required=True, help="预处理后的品牌CSV文件")
    parser.add_argument("--output", "-o", default="shows.json", help="输出JSON文件")
    parser.add_argument("--start-year", type=int, default=2014, help="起始年份")
    parser.add_argument("--end-year", type=int, default=2025, help="结束年份")
    parser.add_argument("--rate", type=float, default=0.5, help="请求间隔(秒)")
    parser.add_argument(
        "--max-shows", type=int, default=0, help="每个品牌最多获取的秀场数(0=全部)"
    )

    args = parser.parse_args()

    scrape_shows(
        args.input,
        args.output,
        args.start_year,
        args.end_year,
        args.rate,
        args.max_shows,
    )


if __name__ == "__main__":
    main()
