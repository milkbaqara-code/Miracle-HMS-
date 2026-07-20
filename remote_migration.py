import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.database import engine
from sqlalchemy import text

def run():
    with engine.begin() as conn:
        try:
            conn.execute(text("ALTER TABLE miracle_knowledge ADD COLUMN root_cause TEXT"))
            print("Added root_cause")
        except Exception as e:
            print("root_cause error:", e)

        try:
            conn.execute(text("ALTER TABLE miracle_knowledge ADD COLUMN correction TEXT"))
            print("Added correction")
        except Exception as e:
            print("correction error:", e)

        try:
            conn.execute(text("ALTER TABLE miracle_knowledge ADD COLUMN prevention_rule TEXT"))
            print("Added prevention_rule")
        except Exception as e:
            print("prevention_rule error:", e)

        try:
            conn.execute(text("ALTER TABLE miracle_knowledge ADD COLUMN status VARCHAR(32) DEFAULT 'PENDING_INJECTION' NOT NULL"))
            print("Added status")
        except Exception as e:
            print("status error:", e)

if __name__ == "__main__":
    run()
