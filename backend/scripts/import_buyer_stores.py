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
    """加载 JSON 数据。

    历史路径假设过 `backend/src/data/buyer-stores.json`，实际仓库里这份
    种子数据放在 `frontend/src/data/buyer-stores.json`（前端 mock 期遗留）。
    这里按优先级回退几个候选路径，省得未来再有人踩同一个坑。
    """
    # `project_root` = backend/，所以 ../frontend/... 才是真实位置
    candidates = [
        project_root.parent / "frontend" / "src" / "data" / "buyer-stores.json",
        project_root / "src" / "data" / "buyer-stores.json",
    ]

    json_path = next((p for p in candidates if p.exists()), None)
    if json_path is None:
        print("错误: 找不到 buyer-stores.json，尝试过的位置:")
        for p in candidates:
            print(f"  - {p}")
        sys.exit(1)

    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    print(f"✅ 从 {json_path} 加载了 {len(data)} 条买手店数据")
    return data


def transform_store(store: dict) -> dict:
    """前端 JSON → DB 列名格式。

    迁移 018 把 latitude/longitude 改成可空，所以缺坐标时传 None 比传
    `0` 更安全（0,0 落在几内亚湾，会污染 bbox / nearby 查询结果）。
    """
    coordinates = store.get("coordinates") or {}
    lat = coordinates.get("latitude")
    lng = coordinates.get("longitude")

    return {
        "id": store["id"],
        "name": store["name"],
        "address": store["address"],
        "city": store["city"],
        "country": store["country"],
        "latitude": lat,
        "longitude": lng,
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
    """CLI 入口。

    支持的开关：
      --clear   导入前清空 buyer_stores（仅用于全量重灌；用户提交的店铺也会被
                清理，谨慎使用）
      --yes     跳过所有交互确认，CI / 脚本里友好
    """
    clear_flag = "--clear" in sys.argv
    yes_flag = "--yes" in sys.argv or "-y" in sys.argv

    print("=" * 50)
    print("买手店数据导入工具")
    print("=" * 50)

    if clear_flag:
        if not yes_flag:
            confirm = input(
                "\n⚠️  --clear 会删除 buyer_stores 表里所有现有数据"
                "（包括用户提交的店铺）。确认继续? (y/N): "
            ).strip().lower()
            if confirm != "y":
                print("已取消")
                return
        clear_existing_data()

    print("\n📂 加载 JSON 数据...")
    stores = load_json_data()

    print("\n📤 开始导入到 Supabase（upsert，按 id 去重）...")
    count = import_to_supabase(stores)

    print("\n" + "=" * 50)
    print(f"✅ 导入完成! 本次 upsert 影响 {count} 条记录")
    print("=" * 50)


if __name__ == "__main__":
    main()
