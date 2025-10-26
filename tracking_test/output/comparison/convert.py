
import pandas as pd
import os

def convert_excel_to_csv(excel_path, csv_path):
    """Converts all sheets of an Excel file to a single CSV file."""
    print(f"Attempting to read Excel file from: {excel_path}")
    if not os.path.exists(excel_path):
        print(f"ERROR: Excel file not found at '{excel_path}'")
        return

    try:
        with pd.ExcelFile(excel_path) as xls:
            df_all = pd.DataFrame()
            for sheet_name in xls.sheet_names:
                df = pd.read_excel(xls, sheet_name=sheet_name)
                df['sheet_name'] = sheet_name  # Add a column to identify the sheet
                df_all = pd.concat([df_all, df], ignore_index=True)
        
        df_all.to_csv(csv_path, index=False)
        print(f"Successfully converted {excel_path} to {csv_path}")

    except Exception as e:
        print(f"An error occurred: {e}")


if __name__ == '__main__':
    excel_file = "tracking_log.xlsx"
    csv_file = "tracking_log.csv"
    
    convert_excel_to_csv(excel_file, csv_file)
