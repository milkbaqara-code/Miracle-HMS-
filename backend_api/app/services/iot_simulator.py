import time
import random
from sqlalchemy import create_engine, text
import json
from datetime import datetime

# --- CONFIGURATION ---
DATABASE_URL = "postgresql://postgres:password@localhost:5432/postgres"
engine = create_engine(DATABASE_URL)

FAULT_TYPES = [
    {"subject": "AC UNIT: THERMOSTAT FAILURE", "dept": "MN", "priority": "NORMAL", "steps": ["Check Power", "Calibrate Sensor"]},
    {"subject": "IOT LOCK: BATTERY CRITICAL", "dept": "IT", "priority": "CRITICAL", "steps": ["Replace Battery", "Reset Logic"]},
    {"subject": "MINIBAR: DEFROST SENSOR FAULT", "dept": "MN", "priority": "LOW", "steps": ["Visual Inspect", "Clear Drain"]},
    {"subject": "WIFI NODE: SIGNAL DROP", "dept": "IT", "priority": "CRITICAL", "steps": ["Power Cycle", "Firmware Sync"]}
]

def simulate_hardware_fault():
    """Injects a random hardware signal into the Solve Radar."""
    try:
        with engine.begin() as conn:
            # 1. Pick a random room that exists in your vault
            rooms = conn.execute(text("SELECT id FROM inventory_master WHERE type = 'RAW'")).fetchall()
            if not rooms:
                print("⚠️ No rooms found in vault. Simulation halted.")
                return
            
            target_room = random.choice(rooms)[0]
            fault = random.choice(FAULT_TYPES)
            
            # Format SOP steps for JSONB
            sop_json = json.dumps([{"step": s, "done": False} for s in fault["steps"]])

            # 2. Inject the Signal
            conn.execute(text("""
                INSERT INTO solve_missions (room_no, dept, subject, priority, sop_steps)
                VALUES (:rm, :dept, :sub, :pri, :sop)
            """), {
                "rm": target_room,
                "dept": fault["dept"],
                "sub": fault["subject"],
                "pri": fault["priority"],
                "sop": sop_json
            })
            
            print(f"📡 SIGNAL INJECTED: {fault['subject']} in Room {target_room} at {datetime.now().strftime('%H:%M:%S')}")

    except Exception as e:
        print(f"❌ Simulator Fault: {e}")

# --- THE SIMULATION LOOP ---
if __name__ == "__main__":
    print("🚀 MIRACLE OS IoT SENSOR SIMULATOR ACTIVE...")
    print("Monitoring hardware nodes every 30 seconds...")
    while True:
        # 20% chance of a fault happening every 30 seconds
        if random.random() < 0.20:
            simulate_hardware_fault()
        time.sleep(30)