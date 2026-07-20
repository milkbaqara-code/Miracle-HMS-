import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import engine, Base
from app.models.models import StaffVault, VaultFile
from sqlalchemy import text

def migrate():
    print("Initiating Sovereign Vault V2 Migration...")
    
    with engine.connect() as conn:
        print("Checking Employee presence fields...")
        try:
            conn.execute(text("ALTER TABLE employees ADD COLUMN is_online BOOLEAN DEFAULT FALSE"))
            print("Added is_online to employees.")
        except Exception as e:
            if "Duplicate column name" in str(e):
                print("is_online already exists.")
            else:
                print(f"Error adding is_online: {e}")
                
        try:
            conn.execute(text("ALTER TABLE employees ADD COLUMN last_seen DATETIME NULL"))
            print("Added last_seen to employees.")
        except Exception as e:
            if "Duplicate column name" in str(e):
                print("last_seen already exists.")
            else:
                print(f"Error adding last_seen: {e}")
        
        conn.commit()

    print("Creating StaffVault and VaultFile tables...")
    Base.metadata.create_all(bind=engine, tables=[StaffVault.__table__, VaultFile.__table__])
    print("Migration Complete.")

if __name__ == "__main__":
    migrate()
