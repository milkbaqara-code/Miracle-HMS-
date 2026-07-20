#!/usr/bin/env python3
"""
Migration: Add posted_by, approved_by, and approval_notes columns to journal_entries table
Run once from backend_api/: python scripts/migrate_add_approval_cols.py
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.core.database import engine

def run_migration():
    print("MIRACLE OS -- JOURNAL ENTRIES APPROVAL COLUMNS MIGRATION")
    print("=" * 60)
    with engine.connect() as conn:
        cols_to_add = [
            ("posted_by", "VARCHAR(100)"),
            ("approved_by", "VARCHAR(100)"),
            ("approval_notes", "VARCHAR(500)")
        ]
        
        for col_name, col_type in cols_to_add:
            # Check if column already exists
            try:
                conn.execute(text(f"SELECT {col_name} FROM journal_entries LIMIT 1"))
                print(f"OK: Column '{col_name}' already exists. No migration needed for this column.")
            except Exception:
                # Column does not exist, add it
                try:
                    conn.execute(text(f"ALTER TABLE journal_entries ADD COLUMN {col_name} {col_type} NULL"))
                    conn.commit()
                    print(f"SUCCESS: Added '{col_name}' ({col_type}) column to journal_entries table.")
                except Exception as e:
                    print(f"FAILED: Failed to add column '{col_name}': {e}")
                    raise

if __name__ == '__main__':
    run_migration()
