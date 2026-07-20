# CDO FLAGSHIP ALIGNMENT
import os
from dotenv import load_dotenv
load_dotenv(override=True)

from fastapi import Request
from jose import jwt
from urllib.parse import quote_plus
from sqlalchemy import create_engine, MetaData, event
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.pool import QueuePool

# CDO KERNEL ALIGNMENT: Multi-Engine Support (SQLite/MySQL)
DB_TYPE = os.getenv("DB_TYPE", "sqlite").lower()

if DB_TYPE == "mysql":
    DB_USER = os.getenv("DB_USER", "root")
    DB_PASS = quote_plus(os.getenv("DB_PASS", ""))
    DB_HOST = os.getenv("DB_HOST", "localhost")
    DB_NAME = os.getenv("DB_NAME", "miracle_os")
    SQLALCHEMY_DATABASE_URL = f"mysql+pymysql://{DB_USER}:{DB_PASS}@{DB_HOST}/{DB_NAME}"
    connect_args = {}
else:
    # Default: SQLite Absolute Pathing for Sector 18 Sync (Pinned to Root)
    # Target: Miracle_Os_Master/miracle_hms_master.db
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    ROOT_DIR = os.path.dirname(BASE_DIR)
    DB_PATH = os.path.join(ROOT_DIR, "miracle_hms_master.db")
    SQLALCHEMY_DATABASE_URL = f"sqlite:///{DB_PATH}"
    connect_args = {"check_same_thread": False}

# ==========================================
# 1. THE NAMING CONVENTION (GENESIS BRIDGE)
# ==========================================
# This is the "DNA map" for the Self-Healing Genesis Engine.
# It ensures every index and constraint has a predictable, unhackable name.
naming_convention = {
    "ix": 'ix_%(column_0_label)s',
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s"
}

metadata = MetaData(naming_convention=naming_convention)

# ==========================================
# 2. THE TURBINE ENGINE (HIGH-CONCURRENCY)
# ==========================================
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    poolclass=QueuePool,
    pool_size=10,          # SHARED HOSTING SAFE: 10 concurrent connections
    max_overflow=10,       # Total 20 connections max
    pool_recycle=1800,     # Recycles stale connections every 30 mins
    pool_pre_ping=True,    # ZERO-DROP POLICY: Tests connection before query
    connect_args=connect_args
)

# ==========================================
# 3. GLOBAL SESSION FACTORY
# ==========================================
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# ==========================================
# 4. THE SOVEREIGN BASE CLASS
# ==========================================
# Attaching the metadata here allows the 'Genesis Engine' to auto-generate 
# and auto-heal tables with perfect constraint naming.
Base = declarative_base(metadata=metadata)

# ==========================================
# 5. DEPENDENCY INJECTION
# ==========================================
SECRET_KEY = "MIRACLE_OS_SUPREME_SECRET_KEY_CHANGE_IN_PROD"
ALGORITHM = "HS256"

# Cache of active engines for tenants to avoid opening/closing files on every query
engines_cache = {}

def get_tenant_db_path(tenant_id: str) -> str:
    import re
    if not re.match(r"^[A-Za-z0-9_-]+$", tenant_id):
        raise ValueError("Invalid tenant ID format")

    if os.name == "nt":
        # Local Windows Workspace path
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        parent_dir = os.path.dirname(base_dir)
        tenants_root = os.path.join(parent_dir, "miracle-tenants")
    else:
        # Production Linux VPS path
        tenants_root = "/home/miracle-tenants"

    tenant_dir = os.path.join(tenants_root, tenant_id)
    os.makedirs(tenant_dir, exist_ok=True)
    return os.path.join(tenant_dir, "miracle_os.db")

def get_db(request: Request = None):
    """
    Yields an atomic, thread-safe database session.
    Dynamically routes to tenant-isolated database if tenant_id is in JWT.
    """
    target_engine = engine

    if request:
        auth_header = request.headers.get("Authorization")
        token = None
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
        else:
            token = request.cookies.get("miracle_session_token")

        if token:
            try:
                # Decode the token (we verify with SECRET_KEY)
                payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
                tenant_id = payload.get("tenant_id")

                if tenant_id and tenant_id not in ["MASTER", "DEMO"]:
                    db_path = get_tenant_db_path(tenant_id)

                    # If this isolated DB doesn't exist, seed it by copying the master template DB
                    if not os.path.exists(db_path):
                        import shutil
                        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
                        parent_dir = os.path.dirname(base_dir)
                        template_path = os.path.join(parent_dir, "miracle_os_master.db")
                        if os.path.exists(template_path):
                            shutil.copy2(template_path, db_path)
                        else:
                            fallback_template = os.path.join(base_dir, "miracle_os_master.db")
                            if os.path.exists(fallback_template):
                                shutil.copy2(fallback_template, db_path)

                    # Retrieve or initialize the engine
                    if db_path not in engines_cache:
                        db_url = f"sqlite:///{db_path}"
                        engines_cache[db_path] = create_engine(
                            db_url,
                            poolclass=QueuePool,
                            pool_size=5,
                            max_overflow=5,
                            pool_recycle=1800,
                            pool_pre_ping=True,
                            connect_args={"check_same_thread": False}
                        )

                        @event.listens_for(engines_cache[db_path], "connect")
                        def set_tenant_sqlite_pragma(dbapi_connection, connection_record):
                            cursor = dbapi_connection.cursor()
                            cursor.execute("PRAGMA journal_mode=WAL")
                            cursor.execute("PRAGMA synchronous=NORMAL")
                            cursor.close()

                    target_engine = engines_cache[db_path]
            except Exception:
                pass

    db = sessionmaker(autocommit=False, autoflush=False, bind=target_engine)()
    try:
        yield db
    finally:
        db.close()

# ==========================================
# 6. KERNEL MONITORING (LOGGING)
# ==========================================
@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    """Enables WAL mode for zero-corruption safety and logs connection."""
    if DB_TYPE == "sqlite":
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.close()