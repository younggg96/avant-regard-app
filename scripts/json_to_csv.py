#!/usr/bin/env python3
"""
将 brands.json 和 shows.json 转换为 CSV 格式，用于手动导入 Supabase
"""
import json
import csv
import os

# 设置路径
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(SCRIPT_DIR, "..", "src", "data")
OUTPUT_DIR = SCRIPT_DIR


def convert_brands_to_csv():
    """将 brands.json 转换为 CSV"""
    input_path = os.path.join(DATA_DIR, "brands.json")
    output_path = os.path.join(OUTPUT_DIR, "brands.csv")

    with open(input_path, "r", encoding="utf-8") as f:
        brands = json.load(f)

    # CSV 列名（对应 Supabase 表字段）
    fieldnames = [
        "name",
        "category",
        "founded_year",
        "founder",
        "country",
        "website",
        "cover_image",
        "latest_season",
        "vogue_slug",
        "vogue_url",
    ]

    with open(output_path, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()

        for brand in brands:
            row = {
                "name": brand.get("name", ""),
                "category": brand.get("category", ""),
                "founded_year": brand.get("foundedYear", ""),
                "founder": brand.get("founder", ""),
                "country": brand.get("country", ""),
                "website": brand.get("website", ""),
                "cover_image": brand.get("coverImage", ""),
                "latest_season": brand.get("latestSeason", ""),
                "vogue_slug": brand.get("vogueSlug", ""),
                "vogue_url": brand.get("vogueUrl", ""),
            }
            writer.writerow(row)

    print(f"✅ brands.csv 已生成: {output_path}")
    print(f"   共 {len(brands)} 条记录")


def convert_shows_to_csv():
    """将 shows.json 转换为 CSV"""
    input_path = os.path.join(DATA_DIR, "shows.json")
    output_path = os.path.join(OUTPUT_DIR, "shows.csv")

    with open(input_path, "r", encoding="utf-8") as f:
        shows = json.load(f)

    # CSV 列名（对应 Supabase 表字段）
    fieldnames = [
        "brand_name",
        "season",
        "title",
        "cover_image",
        "show_url",
        "year",
        "category",
    ]

    with open(output_path, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()

        for show in shows:
            row = {
                "brand_name": show.get("brand", ""),
                "season": show.get("season", ""),
                "title": show.get("title", ""),
                "cover_image": show.get("cover_image", ""),
                "show_url": show.get("show_url", ""),
                "year": show.get("year", ""),
                "category": show.get("category", ""),
            }
            writer.writerow(row)

    print(f"✅ shows.csv 已生成: {output_path}")
    print(f"   共 {len(shows)} 条记录")


if __name__ == "__main__":
    print("开始转换 JSON 到 CSV...")
    print("-" * 40)
    convert_brands_to_csv()
    convert_shows_to_csv()
    print("-" * 40)
    print("转换完成！CSV 文件位于 scripts/ 目录下")
