import sys
from pathlib import Path

# Add backend_api to path so we can import app modules
sys.path.append(str(Path(__file__).resolve().parent))

from app.core.database import SessionLocal
from app.models.models import Inventory
from sqlalchemy import text

def run_seed():
    db = SessionLocal()
    print("--- STARTING GENESIS SEED ON VPS (CLINICAL REBRANDED) ---")

    print("Purging old luxury resort inventory records...")
    db.execute(text("DELETE FROM inventory"))
    db.commit()

    clinical_items = [
        # --- Pharmaceuticals / Medications (Pharmacy) ---
        {
            "product_id": "INV-205",
            "name": "Paracetamol 500mg Tablets",
            "type": "PRODUCT",
            "dept": "DEPT_POS",  # Pharmacy
            "cat": "CONSUMABLE",
            "pp": 10.0,
            "rp": 25.0,
            "stock": 500,
            "p_unit": "BOX",
            "s_unit": "TAB",
            "factor": 10.0,
            "margin": "15.0",
            "bom": [],
            "min_level": 50,
            "img": "https://lh3.googleusercontent.com/d/1Jwpi5s2TGq-xK_GyQ7Uu2w55pqlejq7h"
        },
        {
            "product_id": "DRG-AMO",
            "name": "Amoxicillin 500mg Capsules",
            "type": "PRODUCT",
            "dept": "DEPT_POS",
            "cat": "CONSUMABLE",
            "pp": 45.0,
            "rp": 90.0,
            "stock": 250,
            "p_unit": "BOX",
            "s_unit": "CAP",
            "factor": 20.0,
            "margin": "45.0",
            "bom": [],
            "min_level": 30,
            "img": "https://lh3.googleusercontent.com/d/1Jwpi5s2TGq-xK_GyQ7Uu2w55pqlejq7h"
        },
        {
            "product_id": "DRG-INS",
            "name": "Insulin Glargine 100 U/mL",
            "type": "PRODUCT",
            "dept": "DEPT_POS",
            "cat": "CONSUMABLE",
            "pp": 300.0,
            "rp": 650.0,
            "stock": 80,
            "p_unit": "PACK",
            "s_unit": "PEN",
            "factor": 5.0,
            "margin": "350.0",
            "bom": [],
            "min_level": 15,
            "img": "https://lh3.googleusercontent.com/d/1Jwpi5s2TGq-xK_GyQ7Uu2w55pqlejq7h"
        },
        {
            "product_id": "DRG-ATO",
            "name": "Atorvastatin 20mg Tablets",
            "type": "PRODUCT",
            "dept": "DEPT_POS",
            "cat": "CONSUMABLE",
            "pp": 25.0,
            "rp": 60.0,
            "stock": 400,
            "p_unit": "BOX",
            "s_unit": "TAB",
            "factor": 30.0,
            "margin": "35.0",
            "bom": [],
            "min_level": 40,
            "img": "https://lh3.googleusercontent.com/d/1Jwpi5s2TGq-xK_GyQ7Uu2w55pqlejq7h"
        },
        
        # --- Medical & Surgical Consumables (Medical Supplies Store) ---
        {
            "product_id": "SUR-MASK",
            "name": "N95 Surgical Respirator Masks",
            "type": "PRODUCT",
            "dept": "DEPT_BOUTIQUE",  # Rebranded as Medical Supplies
            "cat": "CONSUMABLE",
            "pp": 15.0,
            "rp": 40.0,
            "stock": 1000,
            "p_unit": "BOX",
            "s_unit": "PCS",
            "factor": 50.0,
            "margin": "25.0",
            "bom": [],
            "min_level": 100,
            "img": "https://lh3.googleusercontent.com/d/1Jwpi5s2TGq-xK_GyQ7Uu2w55pqlejq7h"
        },
        {
            "product_id": "SUR-GLOV",
            "name": "Sterile Latex Surgical Gloves",
            "type": "PRODUCT",
            "dept": "DEPT_BOUTIQUE",
            "cat": "CONSUMABLE",
            "pp": 35.0,
            "rp": 80.0,
            "stock": 800,
            "p_unit": "BOX",
            "s_unit": "PAIR",
            "factor": 100.0,
            "margin": "45.0",
            "bom": [],
            "min_level": 50,
            "img": "https://lh3.googleusercontent.com/d/1Jwpi5s2TGq-xK_GyQ7Uu2w55pqlejq7h"
        },
        {
            "product_id": "SUR-SYR",
            "name": "Disposable Syringes 5mL",
            "type": "PRODUCT",
            "dept": "DEPT_BOUTIQUE",
            "cat": "CONSUMABLE",
            "pp": 8.0,
            "rp": 20.0,
            "stock": 1200,
            "p_unit": "BOX",
            "s_unit": "PCS",
            "factor": 100.0,
            "margin": "12.0",
            "bom": [],
            "min_level": 200,
            "img": "https://lh3.googleusercontent.com/d/1Jwpi5s2TGq-xK_GyQ7Uu2w55pqlejq7h"
        },

        # --- Diagnostics Reagents (LIS Labs) ---
        {
            "product_id": "LAB-REAG",
            "name": "Clinical Chemistry Reagent Pack",
            "type": "RAW",
            "dept": "DEPT_WELLNESS",  # LIS Diagnostic Labs
            "cat": "PERISHABLE",
            "pp": 1200.0,
            "rp": 2500.0,
            "stock": 35,
            "p_unit": "KIT",
            "s_unit": "TEST",
            "factor": 100.0,
            "margin": "1300.0",
            "bom": [],
            "min_level": 5,
            "img": "https://lh3.googleusercontent.com/d/1Jwpi5s2TGq-xK_GyQ7Uu2w55pqlejq7h"
        },
        {
            "product_id": "LAB-BLOOD",
            "name": "Blood Typing ABO/Rh Cards",
            "type": "PRODUCT",
            "dept": "DEPT_WELLNESS",
            "cat": "CONSUMABLE",
            "pp": 150.0,
            "rp": 350.0,
            "stock": 120,
            "p_unit": "BOX",
            "s_unit": "PCS",
            "factor": 50.0,
            "margin": "200.0",
            "bom": [],
            "min_level": 20,
            "img": "https://lh3.googleusercontent.com/d/1Jwpi5s2TGq-xK_GyQ7Uu2w55pqlejq7h"
        },

        # --- Dietary Ingredients (Patient Dietary & Meals) ---
        {
            "product_id": "NUT-ENT",
            "name": "Enteral Nutrition Feed Formula",
            "type": "PRODUCT",
            "dept": "DEPT_GASTRONOMY",  # Patient Dietary & Meals
            "cat": "CONSUMABLE",
            "pp": 120.0,
            "rp": 250.0,
            "stock": 150,
            "p_unit": "CAN",
            "s_unit": "ML",
            "factor": 400.0,
            "margin": "130.0",
            "bom": [],
            "min_level": 30,
            "img": "https://lh3.googleusercontent.com/d/1Jwpi5s2TGq-xK_GyQ7Uu2w55pqlejq7h"
        },
        {
            "product_id": "NUT-DEX",
            "name": "Dextrose 5% IV Solution 500mL",
            "type": "PRODUCT",
            "dept": "DEPT_GASTRONOMY",
            "cat": "CONSUMABLE",
            "pp": 40.0,
            "rp": 95.0,
            "stock": 300,
            "p_unit": "CASE",
            "s_unit": "BOTTLE",
            "factor": 24.0,
            "margin": "55.0",
            "bom": [],
            "min_level": 50,
            "img": "https://lh3.googleusercontent.com/d/1Jwpi5s2TGq-xK_GyQ7Uu2w55pqlejq7h"
        },

        # --- Medical Equipment Assets (Medical Equipment Rental) ---
        {
            "product_id": "EQP-WHEEL",
            "name": "Foldable Orthopedic Wheelchair",
            "type": "SERVICE",
            "dept": "DEPT_RENTAL",  # Rental Store
            "cat": "FIXED",
            "pp": 8000.0,
            "rp": 15000.0,
            "stock": 15,
            "p_unit": "UNIT",
            "s_unit": "UNIT",
            "factor": 1.0,
            "margin": "7000.0",
            "bom": [],
            "min_level": 2,
            "img": "https://lh3.googleusercontent.com/d/1Jwpi5s2TGq-xK_GyQ7Uu2w55pqlejq7h"
        },
        {
            "product_id": "EQP-OXY",
            "name": "Portable Oxygen Concentrator 5L",
            "type": "SERVICE",
            "dept": "DEPT_RENTAL",
            "cat": "FIXED",
            "pp": 25000.0,
            "rp": 45000.0,
            "stock": 8,
            "p_unit": "UNIT",
            "s_unit": "UNIT",
            "factor": 1.0,
            "margin": "20000.0",
            "bom": [],
            "min_level": 1,
            "img": "https://lh3.googleusercontent.com/d/1Jwpi5s2TGq-xK_GyQ7Uu2w55pqlejq7h"
        }
    ]

    for item in clinical_items:
        new_inv = Inventory(
            product_id=item["product_id"],
            name=item["name"],
            type=item["type"],
            dept=item["dept"],
            cat=item["cat"],
            pp=item["pp"],
            rp=item["rp"],
            stock=item["stock"],
            p_unit=item["p_unit"],
            s_unit=item["s_unit"],
            factor=item["factor"],
            margin=item["margin"],
            bom=item["bom"],
            min_level=item["min_level"],
            img=item["img"]
        )
        db.add(new_inv)

    db.commit()
    db.close()
    print("--- GENESIS SEED COMPLETE (CLINICAL REBRANDED) ---")

if __name__ == "__main__":
    run_seed()
