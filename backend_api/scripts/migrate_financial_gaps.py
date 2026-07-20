#!/usr/bin/env python3
"""
Migration: Add tables and columns for financial gaps.
SQLite-compatible syntax with pure ASCII logs.
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.core.database import engine

def run_migration():
    print("[START] Running SQLite Financial Gaps Schema Migration...")
    with engine.connect() as conn:
        # Create currency_rates
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS currency_rates (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                code VARCHAR(10) UNIQUE NOT NULL,
                rate_to_usd DOUBLE NOT NULL,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """))
        print("[OK] Table 'currency_rates' created or verified.")

        # Create tax_rates
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS tax_rates (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                code VARCHAR(30) UNIQUE NOT NULL,
                name VARCHAR(100) NOT NULL,
                rate DOUBLE NOT NULL,
                gl_account_code INT NOT NULL,
                is_active BOOLEAN DEFAULT TRUE
            )
        """))
        print("[OK] Table 'tax_rates' created or verified.")

        # Create tax_rules
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS tax_rules (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                rule_name VARCHAR(100) NOT NULL,
                transaction_type VARCHAR(50) NOT NULL,
                division VARCHAR(50) NOT NULL,
                tax_rate_code VARCHAR(30) NOT NULL,
                effective_from DATE NOT NULL,
                effective_to DATE,
                FOREIGN KEY (tax_rate_code) REFERENCES tax_rates(code)
            )
        """))
        print("[OK] Table 'tax_rules' created or verified.")

        # Create inventory_lots
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS inventory_lots (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                product_id VARCHAR(100) NOT NULL,
                purchase_qty DOUBLE NOT NULL,
                remaining_qty DOUBLE NOT NULL,
                unit_cost DOUBLE NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """))
        print("[OK] Table 'inventory_lots' created or verified.")

        # Create system_audit_logs
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS system_audit_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                operator VARCHAR(100) NOT NULL,
                action VARCHAR(50) NOT NULL,
                table_name VARCHAR(100) NOT NULL,
                record_id VARCHAR(100) NOT NULL,
                field_name VARCHAR(100),
                old_value TEXT,
                new_value TEXT
            )
        """))
        print("[OK] Table 'system_audit_logs' created or verified.")

        # Add columns to journal_entries and ledger_lines
        for tbl in ["journal_entries", "ledger_lines"]:
            # Check currency_code
            try:
                conn.execute(text(f"SELECT currency_code FROM {tbl} LIMIT 1"))
                print(f"[OK] Column 'currency_code' already exists on {tbl}.")
            except Exception:
                try:
                    conn.execute(text(f"ALTER TABLE {tbl} ADD COLUMN currency_code VARCHAR(10) DEFAULT 'USD'"))
                    print(f"[OK] Added column 'currency_code' to {tbl}.")
                except Exception as e:
                    print(f"[ERROR] Failed adding currency_code to {tbl}: {e}")
            
            # Check exchange_rate
            try:
                conn.execute(text(f"SELECT exchange_rate FROM {tbl} LIMIT 1"))
                print(f"[OK] Column 'exchange_rate' already exists on {tbl}.")
            except Exception:
                try:
                    conn.execute(text(f"ALTER TABLE {tbl} ADD COLUMN exchange_rate DOUBLE DEFAULT 1.0"))
                    print(f"[OK] Added column 'exchange_rate' to {tbl}.")
                except Exception as e:
                    print(f"[ERROR] Failed adding exchange_rate to {tbl}: {e}")

        # Add declining_factor to fixed_assets
        try:
            conn.execute(text("SELECT declining_factor FROM fixed_assets LIMIT 1"))
            print("[OK] Column 'declining_factor' already exists on fixed_assets.")
        except Exception:
            try:
                conn.execute(text("ALTER TABLE fixed_assets ADD COLUMN declining_factor DOUBLE DEFAULT 2.0"))
                print("[OK] Added column 'declining_factor' to fixed_assets.")
            except Exception as e:
                print(f"[ERROR] Failed adding declining_factor to fixed_assets: {e}")

        conn.commit()
    print("[FINISHED] Schema migration complete.")

if __name__ == '__main__':
    run_migration()
