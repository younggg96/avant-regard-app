#!/usr/bin/env python3
"""
数据导入脚本 - 将 shows.json 和 brands.json 导入到 Supabase 数据库
"""

import json
import os
import sys

# 添加项目根目录到路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from supabase import create_client, Client

# Supabase 配置（请根据实际环境修改）
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

def get_supabase_client() -> Client:
    """获取 Supabase 客户端"""
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise ValueError("请设置 SUPABASE_URL 和 SUPABASE_SERVICE_KEY 环境变量")
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def import_brands(supabase: Client, brands_file: str):
    """导入品牌数据"""
    print(f"📦 开始导入品牌数据: {brands_file}")
    
    with open(brands_file, 'r', encoding='utf-8') as f:
        brands = json.load(f)
    
    print(f"   找到 {len(brands)} 个品牌")
    
    imported = 0
    skipped = 0
    errors = 0
    
    for brand in brands:
        try:
            # 检查是否已存在
            existing = supabase.table("brands").select("id").eq("name", brand["name"]).execute()
            
            if existing.data:
                skipped += 1
                continue
            
            # 准备插入数据
            insert_data = {
                "name": brand["name"],
                "category": brand.get("category"),
                "founded_year": brand.get("foundedYear"),
                "founder": brand.get("founder"),
                "country": brand.get("country"),
                "website": brand.get("website"),
                "cover_image": brand.get("coverImage"),
                "latest_season": brand.get("latestSeason"),
                "vogue_slug": brand.get("vogueSlug"),
                "vogue_url": brand.get("vogueUrl"),
            }
            
            supabase.table("brands").insert(insert_data).execute()
            imported += 1
            
            if imported % 50 == 0:
                print(f"   已导入 {imported} 个品牌...")
                
        except Exception as e:
            errors += 1
            print(f"   ❌ 导入品牌 '{brand.get('name')}' 失败: {e}")
    
    print(f"✅ 品牌导入完成: 成功 {imported}, 跳过 {skipped}, 失败 {errors}")
    return imported


def import_shows(supabase: Client, shows_file: str):
    """导入秀场数据"""
    print(f"🎭 开始导入秀场数据: {shows_file}")
    
    with open(shows_file, 'r', encoding='utf-8') as f:
        shows = json.load(f)
    
    print(f"   找到 {len(shows)} 个秀场")
    
    imported = 0
    skipped = 0
    errors = 0
    
    for show in shows:
        try:
            # 检查是否已存在（通过 show_url）
            show_url = show.get("show_url")
            if show_url:
                existing = supabase.table("shows").select("id").eq("show_url", show_url).execute()
                if existing.data:
                    skipped += 1
                    continue
            
            # 准备插入数据
            insert_data = {
                "brand_name": show.get("brand"),
                "season": show.get("season"),
                "title": show.get("title"),
                "cover_image": show.get("cover_image"),
                "show_url": show.get("show_url"),
                "year": show.get("year"),
                "category": show.get("category"),
            }
            
            supabase.table("shows").insert(insert_data).execute()
            imported += 1
            
            if imported % 50 == 0:
                print(f"   已导入 {imported} 个秀场...")
                
        except Exception as e:
            errors += 1
            print(f"   ❌ 导入秀场 '{show.get('brand')} - {show.get('season')}' 失败: {e}")
    
    print(f"✅ 秀场导入完成: 成功 {imported}, 跳过 {skipped}, 失败 {errors}")
    return imported


def main():
    """主函数"""
    print("=" * 60)
    print("Avant Regard 数据导入工具")
    print("=" * 60)
    
    # 获取数据文件路径
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    
    brands_file = os.path.join(project_root, "src", "data", "brands.json")
    shows_file = os.path.join(project_root, "src", "data", "shows.json")
    
    # 检查文件是否存在
    if not os.path.exists(brands_file):
        print(f"❌ 品牌数据文件不存在: {brands_file}")
        return
    
    if not os.path.exists(shows_file):
        print(f"❌ 秀场数据文件不存在: {shows_file}")
        return
    
    # 获取 Supabase 客户端
    try:
        supabase = get_supabase_client()
        print("✅ 已连接到 Supabase")
    except Exception as e:
        print(f"❌ 连接 Supabase 失败: {e}")
        return
    
    # 导入数据
    print()
    import_brands(supabase, brands_file)
    
    print()
    import_shows(supabase, shows_file)
    
    print()
    print("=" * 60)
    print("数据导入完成！")
    print("=" * 60)


if __name__ == "__main__":
    main()
