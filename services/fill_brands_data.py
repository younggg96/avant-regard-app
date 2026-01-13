#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
填充 brands.json 缺失数据的爬虫脚本
====================================
从 Vogue 设计师页面获取缺失的 coverImage、website、latestSeason 等信息

用法:
    python fill_brands_data.py
    python fill_brands_data.py --dry-run  # 只显示需要更新的品牌，不实际爬取
    python fill_brands_data.py --rate 1.0  # 设置请求间隔为1秒

依赖:
    pip install requests beautifulsoup4 lxml
"""

import argparse
import json
import os
import re
import sys
import time
from typing import Dict, List, Optional, Any
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

# 路径配置
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BRANDS_JSON_PATH = os.path.join(SCRIPT_DIR, "..", "src", "data", "brands.json")

# HTTP 配置
DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
}


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
        print(f"  [WARN] GET {url} -> {response.status_code}", file=sys.stderr)
    except Exception as e:
        print(f"  [ERR] GET {url}: {e}", file=sys.stderr)
    return None


def extract_designer_info(html: str, brand_name: str) -> Dict[str, Any]:
    """从设计师页面提取信息"""
    soup = BeautifulSoup(html, "lxml")
    result = {}

    # 1. 提取封面图 (coverImage)
    # 优先从 og:image 获取
    og_image = soup.find("meta", property="og:image")
    if og_image and og_image.get("content"):
        result["coverImage"] = og_image["content"]

    # 备选：从页面第一张大图获取
    if not result.get("coverImage"):
        for img in soup.find_all("img"):
            src = img.get("src") or img.get("data-src")
            if src and ("assets.vogue.com" in src or "photos.vogue.com" in src):
                # 跳过小图标
                if any(
                    skip in src.lower() for skip in ["logo", "icon", "avatar", "thumb"]
                ):
                    continue
                result["coverImage"] = src
                break

    # 2. 提取最新季节 (latestSeason)
    # 尝试从页面标题中提取
    title_tag = soup.find("title")
    if title_tag:
        title_text = title_tag.get_text(strip=True)
        # 匹配如 "Fall 2024 Ready-to-Wear" 格式
        season_match = re.search(
            r"(Spring|Fall|Resort|Pre-Fall)\s+\d{4}\s+(Ready[- ]to[- ]Wear|Couture|Menswear|Ready To Wear)",
            title_text,
            re.IGNORECASE,
        )
        if season_match:
            result["latestSeason"] = season_match.group().replace("-", " ").title()

    # 从 og:title 尝试
    if not result.get("latestSeason"):
        og_title = soup.find("meta", property="og:title")
        if og_title and og_title.get("content"):
            title_text = og_title["content"]
            season_match = re.search(
                r"(Spring|Fall|Resort|Pre-Fall)\s+\d{4}\s+(Ready[- ]to[- ]Wear|Couture|Menswear|Ready To Wear)",
                title_text,
                re.IGNORECASE,
            )
            if season_match:
                result["latestSeason"] = season_match.group().replace("-", " ").title()

    # 3. 尝试从页面链接中找到最新的秀场
    show_links = []
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if "/fashion-shows/" in href and "/designer/" not in href:
            # 提取年份和季节
            match = re.search(
                r"(spring|fall|resort|pre-fall)-(\d{4})-(ready-to-wear|couture|menswear)",
                href,
                re.IGNORECASE,
            )
            if match:
                season_name = match.group(1).title()
                year = int(match.group(2))
                category = match.group(3).replace("-", " ").title()
                show_links.append(
                    {
                        "season": f"{season_name} {year} {category}",
                        "year": year,
                        "href": href,
                    }
                )

    # 找最新的秀场
    if show_links and not result.get("latestSeason"):
        show_links.sort(key=lambda x: x["year"], reverse=True)
        result["latestSeason"] = show_links[0]["season"]

    # 4. 尝试从 JSON-LD 或 __NEXT_DATA__ 中提取更多信息
    for script in soup.find_all("script"):
        script_type = script.get("type", "")
        script_id = script.get("id", "")

        if script_type == "application/ld+json" or script_id == "__NEXT_DATA__":
            try:
                data = json.loads(script.string or "{}")
                extract_from_json(data, result)
            except Exception:
                pass

    # 5. 尝试从页面中找官网链接
    # 查找包含品牌相关的外部链接
    for a in soup.find_all("a", href=True):
        href = a["href"]
        text = a.get_text(strip=True).lower()

        # 跳过Vogue内部链接
        if "vogue.com" in href:
            continue

        # 查找官网链接（通常标记为 "official site", "website" 或品牌名）
        if any(
            kw in text
            for kw in ["official", "website", "site", brand_name.lower().split()[0]]
        ):
            if href.startswith("http") and not any(
                skip in href
                for skip in ["instagram", "twitter", "facebook", "youtube", "tiktok"]
            ):
                result["website"] = href
                break

    return result


def extract_from_json(obj: Any, result: Dict[str, Any]) -> None:
    """递归从JSON中提取有用信息"""
    if isinstance(obj, dict):
        # 查找 url/website 字段
        if "url" in obj and isinstance(obj["url"], str):
            url = obj["url"]
            if url.startswith("http") and "vogue.com" not in url:
                if not any(
                    skip in url
                    for skip in [
                        "instagram",
                        "twitter",
                        "facebook",
                        "youtube",
                        "tiktok",
                    ]
                ):
                    if not result.get("website"):
                        result["website"] = url

        # 查找 image 字段
        if "image" in obj and isinstance(obj["image"], str):
            if "assets.vogue.com" in obj["image"] or "photos.vogue.com" in obj["image"]:
                if not result.get("coverImage"):
                    result["coverImage"] = obj["image"]

        for value in obj.values():
            extract_from_json(value, result)

    elif isinstance(obj, list):
        for item in obj:
            extract_from_json(item, result)


def find_brands_with_missing_data(brands: List[Dict]) -> List[Dict]:
    """找出需要填充数据的品牌"""
    missing = []
    for brand in brands:
        needs_update = False
        missing_fields = []

        if not brand.get("coverImage"):
            needs_update = True
            missing_fields.append("coverImage")
        if not brand.get("latestSeason"):
            needs_update = True
            missing_fields.append("latestSeason")
        # website 可能本来就没有，不强制
        if not brand.get("website"):
            missing_fields.append("website")

        if needs_update:
            brand["_missing_fields"] = missing_fields
            missing.append(brand)

    return missing


def scrape_and_fill(brands_path: str, rate: float = 0.5, dry_run: bool = False) -> None:
    """主爬取逻辑"""
    # 读取 brands.json
    print(f"读取品牌数据: {brands_path}")
    with open(brands_path, "r", encoding="utf-8") as f:
        brands = json.load(f)

    print(f"总共 {len(brands)} 个品牌")

    # 找出缺失数据的品牌
    missing_brands = find_brands_with_missing_data(brands)
    print(f"需要更新: {len(missing_brands)} 个品牌")

    if dry_run:
        print("\n[DRY RUN] 以下品牌需要更新:")
        for brand in missing_brands:
            print(f"  - {brand['name']}: 缺少 {brand['_missing_fields']}")
        return

    if not missing_brands:
        print("所有品牌数据都已完整!")
        return

    print("-" * 60)

    session = build_session()
    updated_count = 0

    # 创建 id -> brand 的映射，方便更新
    brand_map = {brand["id"]: brand for brand in brands}

    for idx, brand in enumerate(missing_brands):
        brand_id = brand["id"]
        brand_name = brand["name"]
        vogue_url = brand.get("vogueUrl")

        if not vogue_url:
            print(f"[{idx + 1}/{len(missing_brands)}] {brand_name}: 无 Vogue URL，跳过")
            continue

        print(f"[{idx + 1}/{len(missing_brands)}] {brand_name}")
        print(f"  URL: {vogue_url}")

        # 爬取页面
        html = http_get(session, vogue_url, rate)
        if not html:
            print(f"  ✗ 无法获取页面")
            continue

        # 提取信息
        info = extract_designer_info(html, brand_name)

        if not info:
            print(f"  ✗ 未提取到有用信息")
            continue

        # 更新品牌数据
        original_brand = brand_map[brand_id]
        updates = []

        if info.get("coverImage") and not original_brand.get("coverImage"):
            original_brand["coverImage"] = info["coverImage"]
            updates.append("coverImage")

        if info.get("latestSeason") and not original_brand.get("latestSeason"):
            original_brand["latestSeason"] = info["latestSeason"]
            updates.append("latestSeason")

        if info.get("website") and not original_brand.get("website"):
            original_brand["website"] = info["website"]
            updates.append("website")

        if updates:
            updated_count += 1
            print(f"  ✓ 更新: {', '.join(updates)}")
            for field in updates:
                value = original_brand.get(field, "")
                if len(str(value)) > 60:
                    value = str(value)[:60] + "..."
                print(f"    {field}: {value}")
        else:
            print(f"  - 未找到新数据")

    print("\n" + "=" * 60)
    print(f"更新了 {updated_count} 个品牌")

    # 保存更新后的数据
    if updated_count > 0:
        # 清理临时字段
        for brand in brands:
            brand.pop("_missing_fields", None)

        with open(brands_path, "w", encoding="utf-8") as f:
            json.dump(brands, f, ensure_ascii=False, indent=2)

        print(f"✅ 已保存到: {brands_path}")
    else:
        print("无需保存（没有更新）")


def main():
    parser = argparse.ArgumentParser(description="填充 brands.json 缺失数据")
    parser.add_argument(
        "--input",
        "-i",
        default=BRANDS_JSON_PATH,
        help=f"brands.json 文件路径 (默认: {BRANDS_JSON_PATH})",
    )
    parser.add_argument(
        "--rate", "-r", type=float, default=0.5, help="请求间隔(秒)，默认0.5秒"
    )
    parser.add_argument(
        "--dry-run", action="store_true", help="只显示需要更新的品牌，不实际爬取"
    )

    args = parser.parse_args()

    # 确保路径存在
    if not os.path.exists(args.input):
        print(f"错误: 文件不存在: {args.input}", file=sys.stderr)
        sys.exit(1)

    scrape_and_fill(args.input, args.rate, args.dry_run)


if __name__ == "__main__":
    main()
