"""
Migration script to add missing columns to the SQLite database.
SQLite does not support UNIQUE columns in ALTER TABLE, so we just add them without the constraint.
"""
import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "app.db")
print(f"Migrating database: {DB_PATH}")

conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

# Check current columns in transactions table
cursor.execute("PRAGMA table_info(transactions)")
cols = {row[1] for row in cursor.fetchall()}
print("Current transactions columns:", sorted(cols))

# Migrations to apply - without UNIQUE constraint (SQLite limitation on ALTER TABLE)
migrations = {
    "transactions": [
        ("external_id", "TEXT"),
        ("bank_connection_id", "INTEGER"),
    ],
}

for table, columns in migrations.items():
    cursor.execute(f"PRAGMA table_info({table})")
    existing = {row[1] for row in cursor.fetchall()}
    for column, col_type in columns:
        if column not in existing:
            print(f"  Adding {table}.{column}...")
            cursor.execute(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}")
            print("  Done.")
        else:
            print(f"  {table}.{column} already exists.")

# Ensure bank_connections table exists
cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='bank_connections'")
if not cursor.fetchone():
    print("Creating bank_connections table...")
    cursor.execute("""
        CREATE TABLE bank_connections (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            institution_name TEXT NOT NULL,
            access_token TEXT NOT NULL,
            item_id TEXT NOT NULL,
            cursor TEXT,
            user_id INTEGER NOT NULL REFERENCES users(id)
        )
    """)
    print("Created bank_connections table.")
else:
    print("bank_connections table already exists.")

# Ensure allocation_rules table exists
cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='allocation_rules'")
if not cursor.fetchone():
    print("Creating allocation_rules table...")
    cursor.execute("""
        CREATE TABLE allocation_rules (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            source_type TEXT NOT NULL,
            source_category_id INTEGER REFERENCES categories(id),
            target_asset_id INTEGER NOT NULL REFERENCES assets(id),
            allocation_percent NUMERIC(5,2) NOT NULL,
            is_active INTEGER NOT NULL DEFAULT 1,
            user_id INTEGER NOT NULL REFERENCES users(id)
        )
    """)
    print("Created allocation_rules table.")
else:
    print("allocation_rules table already exists.")

# Ensure assets table exists
cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='assets'")
if not cursor.fetchone():
    print("Creating assets + asset_history tables...")
    cursor.execute("""
        CREATE TABLE assets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            type TEXT NOT NULL,
            balance NUMERIC(12,2) NOT NULL DEFAULT 0,
            user_id INTEGER NOT NULL REFERENCES users(id)
        )
    """)
    cursor.execute("""
        CREATE TABLE asset_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            asset_id INTEGER NOT NULL REFERENCES assets(id),
            date TEXT NOT NULL,
            balance NUMERIC(12,2) NOT NULL
        )
    """)
    print("Created assets + asset_history tables.")
else:
    print("assets table already exists.")

conn.commit()
conn.close()
print("\nMigration complete! All tables and columns are up to date.")
