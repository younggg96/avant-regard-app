#!/usr/bin/env python3
"""
将 buyer-stores.json 转换为 Excel 格式

使用方法:
    pip install pandas openpyxl
    python scripts/json_to_excel.py
"""

import json
from pathlib import Path

try:
    import pandas as pd
except ImportError:
    print("请先安装 pandas 和 openpyxl:")
    print("  pip install pandas openpyxl")
    exit(1)

# 项目根目录
project_root = Path(__file__).parent.parent

# 输入和输出路径
json_path = project_root / "src" / "data" / "buyer-stores.json"
excel_path = project_root / "src" / "data" / "buyer-stores.xlsx"


def load_json():
    """加载 JSON 数据"""
    with open(json_path, "r", encoding="utf-8") as f:
        return json.load(f)


def flatten_store(store: dict) -> dict:
    """展平店铺数据"""
    coords = store.get("coordinates", {})
    
    return {
        "ID": store.get("id", ""),
        "店铺名称": store.get("name", ""),
        "地址": store.get("address", ""),
        "城市": store.get("city", ""),
        "国家": store.get("country", ""),
        "纬度": coords.get("latitude", ""),
        "经度": coords.get("longitude", ""),
        "品牌": ", ".join(store.get("brands", [])),
        "风格": ", ".join(store.get("style", [])),
        "是否营业": "是" if store.get("isOpen", True) else "否（需预约）",
        "电话": ", ".join(store.get("phone", []) or []),
        "营业时间": store.get("hours", ""),
        "休息日": store.get("rest", ""),
        "描述": store.get("description", ""),
    }


def convert_to_excel():
    """转换为 Excel"""
    print(f"📂 读取 JSON 文件: {json_path}")
    stores = load_json()
    print(f"   共 {len(stores)} 条记录")
    
    # 展平数据
    flattened = [flatten_store(s) for s in stores]
    
    # 创建 DataFrame
    df = pd.DataFrame(flattened)
    
    # 写入 Excel
    print(f"📝 写入 Excel 文件: {excel_path}")
    
    with pd.ExcelWriter(excel_path, engine="openpyxl") as writer:
        df.to_excel(writer, sheet_name="买手店数据", index=False)
        
        # 调整列宽
        worksheet = writer.sheets["买手店数据"]
        column_widths = {
            "A": 12,   # ID
            "B": 30,   # 店铺名称
            "C": 60,   # 地址
            "D": 15,   # 城市
            "E": 12,   # 国家
            "F": 12,   # 纬度
            "G": 12,   # 经度
            "H": 50,   # 品牌
            "I": 30,   # 风格
            "J": 15,   # 是否营业
            "K": 25,   # 电话
            "L": 25,   # 营业时间
            "M": 15,   # 休息日
            "N": 40,   # 描述
        }
        
        for col, width in column_widths.items():
            worksheet.column_dimensions[col].width = width
    
    print(f"✅ 转换完成!")
    print(f"   文件位置: {excel_path}")


if __name__ == "__main__":
    convert_to_excel()
