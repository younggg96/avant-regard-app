#!/usr/bin/env python3
"""
导入买手店数据到 Supabase

使用方法:
1. 确保已设置环境变量 SUPABASE_URL 和 SUPABASE_SERVICE_KEY
2. 运行: python scripts/import_buyer_stores.py

注意: 需要先在 Supabase 中执行 add_buyer_stores.sql 创建表结构
"""

import os
import sys
import json
from pathlib import Path

# 添加项目根目录到路径
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(project_root / "backend"))

from supabase import create_client, Client

# 从环境变量获取 Supabase 配置
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("错误: 请设置 SUPABASE_URL 和 SUPABASE_SERVICE_KEY 环境变量")
    print("例如:")
    print("  export SUPABASE_URL=https://xxx.supabase.co")
    print("  export SUPABASE_SERVICE_KEY=your-service-key")
    sys.exit(1)


def load_json_data() -> list:
    """加载 JSON 数据"""
    json_path = project_root / "src" / "data" / "buyer-stores.json"
    
    if not json_path.exists():
        print(f"错误: 找不到数据文件 {json_path}")
        sys.exit(1)
    
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    print(f"✅ 加载了 {len(data)} 条买手店数据")
    return data


def transform_store(store: dict) -> dict:
    """转换数据格式"""
    coordinates = store.get("coordinates", {})
    
    return {
        "id": store["id"],
        "name": store["name"],
        "address": store["address"],
        "city": store["city"],
        "country": store["country"],
        "latitude": coordinates.get("latitude", 0),
        "longitude": coordinates.get("longitude", 0),
        "brands": store.get("brands", []),
        "style": store.get("style", []),
        "is_open": store.get("isOpen", True),
        "phone": store.get("phone"),
        "hours": store.get("hours"),
        "rating": store.get("rating"),
        "description": store.get("description"),
        "images": store.get("images"),
        "rest": store.get("rest"),
    }


def import_to_supabase(stores: list, batch_size: int = 100) -> int:
    """导入数据到 Supabase"""
    client: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    
    # 转换数据格式
    transformed = [transform_store(s) for s in stores]
    
    total_imported = 0
    
    # 分批导入
    for i in range(0, len(transformed), batch_size):
        batch = transformed[i:i + batch_size]
        
        try:
            # 使用 upsert 避免重复导入冲突
            result = client.table("buyer_stores").upsert(batch).execute()
            count = len(result.data)
            total_imported += count
            print(f"  导入批次 {i // batch_size + 1}: {count} 条记录")
        except Exception as e:
            print(f"  ❌ 批次 {i // batch_size + 1} 导入失败: {e}")
            # 尝试逐条导入
            for store in batch:
                try:
                    client.table("buyer_stores").upsert(store).execute()
                    total_imported += 1
                except Exception as inner_e:
                    print(f"    ❌ 店铺 {store['id']} 导入失败: {inner_e}")
    
    return total_imported


def clear_existing_data():
    """清除现有数据"""
    client: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    
    try:
        # 删除所有数据
        client.table("buyer_stores").delete().neq("id", "").execute()
        print("✅ 已清除现有数据")
    except Exception as e:
        print(f"⚠️ 清除数据失败（可能表为空）: {e}")


def main():
    print("=" * 50)
    print("买手店数据导入工具")
    print("=" * 50)
    
    # 询问是否清除现有数据
    clear = input("\n是否清除现有数据? (y/N): ").strip().lower()
    if clear == "y":
        clear_existing_data()
    
    # 加载数据
    print("\n📂 加载 JSON 数据...")
    stores = load_json_data()
    
    # 导入数据
    print("\n📤 开始导入到 Supabase...")
    count = import_to_supabase(stores)
    
    print("\n" + "=" * 50)
    print(f"✅ 导入完成! 共导入 {count} 条记录")
    print("=" * 50)


if __name__ == "__main__":
    main()
