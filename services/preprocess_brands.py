#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
品牌名预处理脚本
================
将原始品牌CSV转换为包含Vogue Runway URL slug的版本

用法:
    python preprocess_brands.py --input Sheet_20260107.csv --output processed_brands.csv
"""

import argparse
import re
import unicodedata
import pandas as pd
from pathlib import Path


def generate_vogue_slug(brand_name: str) -> str:
    """
    将品牌名转换为Vogue Runway的URL slug格式

    规则:
    1. 转为小写
    2. 移除重音符号（如 é -> e）
    3. 移除特殊字符（点、撇号、括号等）
    4. 将空格和连续特殊字符替换为单个连字符
    5. 移除首尾连字符

    示例:
    - "Acne Studios" -> "acne-studios"
    - "A.P.C." -> "apc"
    - "Comme des Garçons" -> "comme-des-garcons"
    - "Dolce & Gabbana" -> "dolce-gabbana"
    - "Yohji Yamamoto" -> "yohji-yamamoto"
    """
    if not brand_name or pd.isna(brand_name):
        return ""

    name = str(brand_name).strip()

    # 转为小写
    name = name.lower()

    # 移除重音符号 (é -> e, ü -> u, etc.)
    name = unicodedata.normalize("NFKD", name)
    name = "".join(c for c in name if not unicodedata.combining(c))

    # 特殊品牌名映射（处理一些特殊情况）
    special_mappings = {
        "d&g": "dolce-gabbana",
        "d.i.a": "dia",
        "y-3": "y-3",
        "ys": "ys",
        "l.g.b. (le grand bleu)": "lgb",
        "ma+": "maurizio-amadei",
        "mui mui": "miu-miu",  # 修正拼写
        "layer-0": "layer-0",
        "layer‐０": "layer-0",
    }

    # 检查特殊映射
    for key, value in special_mappings.items():
        if name == key:
            return value

    # 移除括号内容（但保留主要名称）
    name = re.sub(r"\s*\([^)]*\)\s*", " ", name)

    # 替换 & 为空格
    name = name.replace("&", " ")

    # 移除点、撇号和其他特殊字符
    name = re.sub(r"[.'\"!?@#$%^*+=<>{}[\]|\\:;,]", "", name)

    # 将连续的空格、连字符替换为单个连字符
    name = re.sub(r"[\s\-–—_]+", "-", name)

    # 移除首尾连字符
    name = name.strip("-")

    return name


def process_brands_csv(input_path: str, output_path: str) -> None:
    """处理品牌CSV文件，添加vogue_slug列"""

    print(f"读取文件: {input_path}")
    df = pd.read_csv(input_path)

    print(f"找到 {len(df)} 个品牌")

    # 获取品牌名列
    brand_col = df.columns[0]  # 假设第一列是品牌名
    print(f"品牌名列: {brand_col}")

    # 生成 vogue_slug
    df["vogue_slug"] = df[brand_col].apply(generate_vogue_slug)

    # 生成 Vogue URL
    df["vogue_url"] = df["vogue_slug"].apply(
        lambda slug: (
            f"https://www.vogue.com/fashion-shows/designer/{slug}" if slug else ""
        )
    )

    # 保存
    df.to_csv(output_path, index=False, encoding="utf-8")
    print(f"\n✅ 已保存到: {output_path}")

    # 打印一些示例
    print("\n示例转换结果:")
    print("-" * 60)
    sample = df[[brand_col, "vogue_slug", "vogue_url"]].head(10)
    for _, row in sample.iterrows():
        print(f"  {row[brand_col][:30]:<30} -> {row['vogue_slug']}")


def main():
    parser = argparse.ArgumentParser(description="预处理品牌CSV，生成Vogue URL slug")
    parser.add_argument("--input", "-i", required=True, help="输入CSV文件路径")
    parser.add_argument(
        "--output", "-o", default="processed_brands.csv", help="输出CSV文件路径"
    )
    args = parser.parse_args()

    process_brands_csv(args.input, args.output)


if __name__ == "__main__":
    main()
