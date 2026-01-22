#!/usr/bin/env python3
"""Convert Excel file to CSV format."""

import pandas as pd
import os

def convert_excel_to_csv():
    # Input and output paths
    script_dir = os.path.dirname(os.path.abspath(__file__))
    excel_file = os.path.join(script_dir, "Avant regard录入品牌近十年秀场数据 (1).xlsx")
    csv_file = os.path.join(script_dir, "avant_regard_brand_show_data.csv")
    
    # Read Excel file
    print(f"Reading Excel file: {excel_file}")
    
    # Read all sheets
    xl = pd.ExcelFile(excel_file)
    print(f"Available sheets: {xl.sheet_names}")
    
    # If there's only one sheet, read it directly
    if len(xl.sheet_names) == 1:
        df = pd.read_excel(excel_file)
    else:
        # Read first sheet by default, or combine all sheets
        df = pd.read_excel(excel_file, sheet_name=0)
    
    # Display basic info
    print(f"\nDataFrame shape: {df.shape}")
    print(f"Columns: {df.columns.tolist()}")
    print(f"\nFirst 5 rows:")
    print(df.head())
    
    # Save to CSV
    df.to_csv(csv_file, index=False, encoding='utf-8-sig')
    print(f"\nCSV file saved to: {csv_file}")
    
    return df

if __name__ == "__main__":
    convert_excel_to_csv()
