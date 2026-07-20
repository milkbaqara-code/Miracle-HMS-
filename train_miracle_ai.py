#!/usr/bin/env python3
"""
MIRACLE HMS — TRAIN AI COMMAND
================================
Run this any time to force a full AI brain refresh.
Zero LLM tokens. Pure Python extraction from source code.

Usage:
  python train_miracle_ai.py           # Full sync
  python train_miracle_ai.py --watch   # Start live watcher
  python train_miracle_ai.py --status  # Show current knowledge stats
"""
import sys
import os
import sqlite3
from pathlib import Path

# Ensure the backend is on the Python path
BACKEND = Path(__file__).parent / "backend_api"
sys.path.insert(0, str(BACKEND))

PROJECT_ROOT = Path(__file__).parent
DB_PATH = PROJECT_ROOT / "miracle_os_master.db"


def show_status():
    """Show current AI brain knowledge stats."""
    conn = sqlite3.connect(str(DB_PATH))
    c = conn.cursor()

    c.execute("SELECT COUNT(*) FROM miracle_knowledge WHERE status='ACTIVE'")
    total = c.fetchone()[0]

    c.execute("""
        SELECT category, importance_score, substr(insight, 1, 80)
        FROM miracle_knowledge
        WHERE status='ACTIVE'
        ORDER BY importance_score DESC
        LIMIT 20
    """)
    rows = c.fetchall()

    c.execute("""
        SELECT
            CASE
                WHEN category LIKE 'ZONE_%' THEN 'ZONE_KNOWLEDGE'
                WHEN category LIKE 'API_ENGINE_%' THEN 'API_ENGINES'
                WHEN category LIKE 'UI_PAGE_%' THEN 'UI_PAGES'
                WHEN category LIKE 'GLOSSARY_%' THEN 'HMS_GLOSSARY'
                WHEN category LIKE 'HMS_WORKFLOW_%' THEN 'WORKFLOWS'
                WHEN category LIKE 'HMS_%' THEN 'HMS_CLINICAL'
                WHEN category LIKE 'DB_SCHEMA_%' THEN 'DB_SCHEMA'
                ELSE 'OTHER'
            END as cat_group,
            COUNT(*) as cnt
        FROM miracle_knowledge
        WHERE status='ACTIVE'
        GROUP BY cat_group
        ORDER BY cnt DESC
    """)
    groups = c.fetchall()
    conn.close()

    print("\n" + "=" * 70)
    print("  MIRACLE HMS AI BRAIN — KNOWLEDGE STATUS")
    print("=" * 70)
    print(f"\n  Total active knowledge entries: {total}")
    print("\n  BY CATEGORY:")
    for g, cnt in groups:
        bar = "#" * min(cnt, 40)
        print(f"    {g:<25} {cnt:>4}  {bar}")
    print("\n  TOP ENTRIES BY IMPORTANCE:")
    for cat, score, preview in rows[:10]:
        print(f"    [{score:>3}] {cat:<45} {preview[:50]}...")
    print("=" * 70 + "\n")


def main():
    args = sys.argv[1:]

    if "--status" in args:
        show_status()
        return

    # Import and run the brain sync engine
    sys.path.insert(0, str(BACKEND / "app" / "core"))
    from brain_sync import run_full_sync, run_watcher

    if "--watch" in args:
        print("\n[*] Starting Miracle HMS Brain Sync Watcher...")
        print("   The AI will automatically learn from every code change.")
        print("   Press Ctrl+C to stop.\n")
        run_watcher()
    else:
        print("\n[BRAIN] Miracle HMS Brain -- Full Sync")
        print("   Reading your entire codebase at 0 LLM token cost...")
        print("   Zones | Routers | Pages | Models | Accounts | HR\n")
        engine = run_full_sync()
        show_status()
        print("[OK] AI brain is now up to date. No tokens used.\n")


if __name__ == "__main__":
    main()
