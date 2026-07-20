import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import SessionLocal
from app.models.models import AssetGrid

def run():
    db = SessionLocal()
    try:
        # Delete existing assets
        db.query(AssetGrid).delete()
        
        master_assets = []
        for i in range(1, 6): master_assets.append({"id": f"RS-0{i}", "category": "ROYAL SUITE", "rate": 500000.0})
        for i in range(1, 6): master_assets.append({"id": f"PS-0{i}", "category": "PRESIDENTIAL SUITE", "rate": 200000.0})
        for i in range(1, 11): master_assets.append({"id": f"V-{i:02d}", "category": "PRIVATE VILLA", "rate": 150000.0})
        for i in range(1, 11): master_assets.append({"id": f"LTR-{i:02d}", "category": "LUXURY RESIDENCE", "rate": 100000.0})
        for i in range(1, 6): master_assets.append({"id": f"OB-0{i}", "category": "OVERWATER BUNGALOW", "rate": 250000.0})
        
        for asset in master_assets:
            new_asset = AssetGrid(
                room_id=asset["id"],
                category=asset["category"],
                base_rate=asset["rate"],
                is_active=True,
                current_status="AVAILABLE",
                current_guest="NONE"
            )
            db.add(new_asset)
        
        db.commit()
        print("AssetGrid successfully migrated to Sovereign 30-room Architecture.")
    except Exception as e:
        db.rollback()
        print(f"Migration Failed: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    run()
