#!/usr/bin/env python3
"""
Migration: Add gender column to employees table
Run once from backend_api/: python scripts/migrate_add_gender.py
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.core.database import engine

def run_migration():
    print("MIRACLE OS -- GENDER COLUMN MIGRATION")
    print("=" * 45)
    with engine.connect() as conn:
        # Check if column already exists
        try:
            conn.execute(text("SELECT gender FROM employees LIMIT 1"))
            print("OK: Gender column already exists. No migration needed.")
            return
        except Exception:
            pass  # Column does not exist, proceed

        # Add gender column
        try:
            conn.execute(text("""
                ALTER TABLE employees
                ADD COLUMN gender VARCHAR(20) DEFAULT 'UNSPECIFIED'
            """))
            conn.commit()
            print("SUCCESS: Added 'gender' column to employees table.")
            print("   Default value: UNSPECIFIED")
            print("   Allowed values: MALE | FEMALE | UNSPECIFIED")
        except Exception as e:
            print(f"FAILED: Migration error: {e}")
            raise

if __name__ == '__main__':
    run_migration()
