import json
import logging
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.miracle_ai_models import MiracleKnowledge

router = APIRouter(prefix="/api/bot/v2/surgical-fixes", tags=["AI Brain"])
logger = logging.getLogger("SurgicalFixes")

# Path to the centralized manifest (Relative to backend_api/app/routers)
MANIFEST_PATH = Path(__file__).parent.parent.parent.parent / "miracle_surgical_fixes.json"

@router.get("/status")
def get_sync_status(db: Session = Depends(get_db)):
    """Compares the local JSON manifest with the AI brain (database)."""
    try:
        if not MANIFEST_PATH.exists():
            return {"error": "Manifest file missing", "path": str(MANIFEST_PATH)}
        
        with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
            manifest = json.load(f)
        
        # Get all anti-hallucination rules from DB
        brain_rules = db.query(MiracleKnowledge).filter(
            MiracleKnowledge.category == "ANTI_HALLUCINATION"
        ).all()
        
        # Use 'prevention_rule' text as the matching key (since we don't have IDs in DB yet)
        brain_texts = [r.prevention_rule for r in brain_rules]
        
        results = []
        for fix in manifest:
            # Check if this fix is already in the brain
            status = "DEPLOYED" if any(fix["fix"] in bt for bt in brain_texts) else "PENDING"
            results.append({
                "id": fix["id"],
                "category": fix["category"],
                "summary": fix["fix"][:60] + "...",
                "status": status,
                "severity": fix.get("severity", "MEDIUM")
            })
            
        return {
            "total_manifest": len(manifest),
            "total_deployed": len([r for r in results if r["status"] == "DEPLOYED"]),
            "fixes": results
        }
    except Exception as e:
        logger.error(f"Sync status error: {e}")
        raise HTTPException(500, detail=str(e))

@router.post("/sync-all")
def sync_brain_with_manifest(db: Session = Depends(get_db)):
    """Injects all PENDING fixes from manifest into the AI brain."""
    try:
        if not MANIFEST_PATH.exists():
            raise HTTPException(404, detail="Manifest file missing")
            
        with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
            manifest = json.load(f)
            
        brain_rules = db.query(MiracleKnowledge).filter(
            MiracleKnowledge.category == "ANTI_HALLUCINATION"
        ).all()
        brain_texts = [r.prevention_rule for r in brain_rules]
        
        new_injections = 0
        for fix in manifest:
            if not any(fix["fix"] in bt for bt in brain_texts):
                new_rule = MiracleKnowledge(
                    source_role="CDO_MANIFEST",
                    category="ANTI_HALLUCINATION",
                    insight=f"Manifest sync: {fix['fix']}",
                    root_cause=f"Manifest-driven system instruction for {fix['category']}.",
                    correction=fix["fix"],
                    prevention_rule=f"SOVEREIGN_SYSTEM_FIX ({fix['id']}): {fix['fix']}",
                    importance_score=10
                )
                db.add(new_rule)
                new_injections += 1
        
        if new_injections > 0:
            db.commit()
            
        return {"message": f"Brain sync complete. {new_injections} new fixes injected.", "injected_count": new_injections}
    except Exception as e:
        db.rollback()
        logger.error(f"Sync execution error: {e}")
        raise HTTPException(500, detail=str(e))
