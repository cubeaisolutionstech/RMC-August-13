import os
import time
import mysql.connector
import pandas as pd
import pyodbc
import pyodbc
print(pyodbc.drivers())

# --- CONFIG ---
FOLDER_PATH = r"D:\\Download\\construction\\construction-app\\src\\backend\\mdb"
MYSQL_HOST = "localhost"
MYSQL_USER = "root"
MYSQL_PASS = "Sanumysql@1mysql"
MYSQL_DB   = "construction"
TABLE_NAME = "weighbridge_data"

# Set this to True if you want to always drop & recreate the table fresh
RECREATE_TABLE = False  

processed_files = set()

def get_connection():
    """Connect to MySQL"""
    return mysql.connector.connect(
        host=MYSQL_HOST,
        user=MYSQL_USER,
        password=MYSQL_PASS,
        database=MYSQL_DB
    )

def read_mdb(file_path):
    """Read Tickets table from MDB file"""
    conn_str = (
        r"Driver={Microsoft Access Driver (*.mdb, *.accdb)};"
        f"DBQ={file_path};"
    )
    conn = pyodbc.connect(conn_str)
    cursor = conn.cursor()

    # Get all tables in MDB
    tables = [t.table_name for t in cursor.tables(tableType='TABLE')]
    if "Tickets" not in tables:
        raise Exception(f"'Tickets' table not found in {file_path}. Found: {tables}")

    # Read Tickets table into DataFrame
    df = pd.read_sql("SELECT * FROM Tickets", conn)
    conn.close()
    return df

def create_mysql_table(columns):
    """Create MySQL table with MDB columns"""
    conn = get_connection()
    cursor = conn.cursor()

    # Drop old table if recreate mode is enabled
    if RECREATE_TABLE:
        cursor.execute(f"DROP TABLE IF EXISTS {TABLE_NAME}")

    # Define MySQL columns (all as TEXT for flexibility)
    col_defs = ", ".join([f"`{col}` TEXT" for col in columns])
    create_stmt = f"""
    CREATE TABLE IF NOT EXISTS {TABLE_NAME} (
        id INT AUTO_INCREMENT PRIMARY KEY,
        {col_defs}
    )
    """
    cursor.execute(create_stmt)
    conn.commit()
    cursor.close()
    conn.close()

def insert_into_mysql(df):
    """Insert DataFrame rows into MySQL"""
    conn = get_connection()
    cursor = conn.cursor()

    cols = ", ".join([f"`{c}`" for c in df.columns])
    placeholders = ", ".join(["%s"] * len(df.columns))
    insert_stmt = f"INSERT INTO {TABLE_NAME} ({cols}) VALUES ({placeholders})"

    # Insert in batches for speed
    data = [tuple(row.astype(str)) for _, row in df.iterrows()]
    cursor.executemany(insert_stmt, data)

    conn.commit()
    cursor.close()
    conn.close()

def monitor_folder():
    """Monitor folder and sync new MDB files"""
    global processed_files
    table_created = False

    while True:
        for file in os.listdir(FOLDER_PATH):
            if file.endswith(".mdb") and file not in processed_files:
                file_path = os.path.join(FOLDER_PATH, file)
                print(f"Processing: {file_path}")

                df = read_mdb(file_path)

                if not table_created or RECREATE_TABLE:  
                    create_mysql_table(df.columns)
                    table_created = True

                insert_into_mysql(df)
                processed_files.add(file)
                print(f"✅ Data from {file} inserted into {TABLE_NAME}")

        time.sleep(3)  # Check every 3 seconds

def start_sync():
    """Start syncing MDB files to MySQL"""
    print(f"📂 Monitoring folder: {FOLDER_PATH}")
    print(f"🗄️  Target MySQL table: {TABLE_NAME}")
    monitor_folder()

# Run
if __name__ == "__main__":
    start_sync()