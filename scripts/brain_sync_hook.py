#!/usr/bin/env python3
"""
MIRACLE HMS — POST-DEPLOY BRAIN SYNC HOOK
==========================================
Auto-runs after every deployment to keep the AI brain current.

Install once:
  Copy this file to: .git/hooks/post-commit
  Make executable (Linux/Mac): chmod +x .git/hooks/post-commit
  Windows: Git runs .py hooks automatically via Python

On Windows PowerShell — add to your deploy script:
  python train_miracle_ai.py
"""
import subprocess
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent.parent  # from .git/hooks/

def main():
    print("[BRAIN-SYNC] Post-commit hook triggered...")
    try:
        result = subprocess.run(
            [sys.executable, str(PROJECT_ROOT / "train_miracle_ai.py")],
            capture_output=True, text=True, timeout=120,
            cwd=str(PROJECT_ROOT)
        )
        print(result.stdout)
        if result.returncode == 0:
            print("[BRAIN-SYNC] AI brain synced successfully.")
        else:
            print(f"[BRAIN-SYNC] Sync warning: {result.stderr[:200]}")
    except Exception as e:
        print(f"[BRAIN-SYNC] Hook error (non-fatal): {e}")

if __name__ == "__main__":
    main()
