import os
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.core.database import engine
from sqlalchemy import text

print("Applying schema migrations...")

queries = [
    "ALTER TABLE journal_entries ADD COLUMN posted_by VARCHAR(100) NULL;",
    "ALTER TABLE journal_entries ADD COLUMN approved_by VARCHAR(100) NULL;",
    "ALTER TABLE journal_entries ADD COLUMN approval_notes VARCHAR(500) NULL;",
    
    # Also add Employee new columns just in case
    "ALTER TABLE employees ADD COLUMN full_name VARCHAR(255) NULL;",
    "ALTER TABLE employees ADD COLUMN last_name VARCHAR(100) NULL;",
    "ALTER TABLE employees ADD COLUMN position VARCHAR(100) NULL;",
]

with engine.connect() as conn:
    for q in queries:
        try:
            conn.execute(text(q))
            print(f"Success: {q}")
        except Exception as e:
            if "Duplicate column name" in str(e):
                print(f"Already exists: {q}")
            else:
                print(f"Error executing {q}: {e}")
    conn.commit()

print("Schema migrations complete!")
