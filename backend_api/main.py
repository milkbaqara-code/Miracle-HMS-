"""
Cineplex Go — cinema Enterprise OS
FastAPI Backend — Auto-assembled by Miracle Sovereign Assembler
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import sqlite3
import os

app = FastAPI(
    title="Cineplex Go API",
    description="cinema Enterprise Management OS — powered by Miracle OS",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3004", "http://localhost:3000",
                   "http://localhost:8000", "http://127.0.0.1:8000"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["*"],
)

DB_PATH = "miracle_os_master.db"

@app.get("/health")
def health():
    return {"status": "ok", "brand": "Cineplex Go", "industry": "cinema"}

@app.get("/api/summary")
def get_summary():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [r[0] for r in cur.fetchall()]
    summary = {}
    for t in tables:
        try:
            cur.execute(f"SELECT COUNT(*) FROM {t}")
            summary[t] = cur.fetchone()[0]
        except:
            summary[t] = 0
    conn.close()
    return {"brand": "Cineplex Go", "industry": "cinema", "tables": summary}
