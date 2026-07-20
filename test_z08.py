import sys
import os
sys.path.append(os.path.abspath('backend_api'))

from app.core.database import SessionLocal
from app.routers.bot_router_v2 import build_live_context

def test_z08():
    db = SessionLocal()
    try:
        ctx = build_live_context('Z-08', db)
        print("Z-08 context:", ctx)
    except Exception as e:
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == '__main__':
    test_z08()
