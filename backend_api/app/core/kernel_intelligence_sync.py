# backend_api/app/core/kernel_intelligence_sync.py
import json
import logging
from pathlib import Path
from sqlalchemy.orm import Session
from app.models.miracle_ai_models import MiracleKnowledge

logger = logging.getLogger("KernelSync")

def sync_kernel_knowledge(db: Session, kernel_path: Path):
    """
    V12.0: SELF-GROWING KNOWLEDGE BASE
    Reads miracle_kernel.json and auto-injects all panel buttons, workflows,
    and business synonyms into the AI's wisdom ledger.
    Runs on PM2 startup to ensure the AI learns about new panels instantly.
    """
    if not kernel_path.exists():
        logger.error(f"🚨 KERNEL SYNC FAILED: Kernel file not found at {kernel_path}")
        return

    try:
        with open(kernel_path, "r", encoding="utf-8") as f:
            kernel = json.load(f)
    except Exception as e:
        logger.error(f"🚨 KERNEL SYNC FAILED: Invalid JSON - {e}")
        return
    
    synced_count = 0
    
    for zone_code, zone_data in kernel.items():
        if not isinstance(zone_data, dict):
            continue
        zone_name = zone_data.get("name", zone_code)
        buttons = ", ".join(zone_data.get("exact_buttons", []))
        workflow = zone_data.get("operational_knowledge", "")
        
        # We only sync zones that have defined workflows or buttons
        if not workflow and not buttons:
            continue
            
        insight = (
            f"PANEL [{zone_code}] — {zone_name}: "
            f"Available buttons: {buttons}. "
            f"Workflow: {workflow}"
        )
        
        # Check if this zone knowledge already exists
        existing = db.query(MiracleKnowledge).filter(
            MiracleKnowledge.category == "PANEL_LEARNING",
            MiracleKnowledge.business_context == zone_code
        ).first()
        
        if existing:
            # Update existing to ensure we have the latest buttons/workflows
            if existing.insight != insight:
                existing.insight = insight
                existing.importance_score = 9
                synced_count += 1
        else:
            # Inject new knowledge
            new_knowledge = MiracleKnowledge(
                source_role="KERNEL_SYNC",
                category="PANEL_LEARNING",
                insight=insight,
                business_context=zone_code,
                importance_score=9,
                status="ACTIVE"
            )
            db.add(new_knowledge)
            synced_count += 1
            
    try:
        db.commit()
        if synced_count > 0:
            logger.info(f"🧠 KERNEL SYNC COMPLETE: {synced_count} zones auto-learned by Miracle AI.")
        else:
            logger.info("🧠 KERNEL SYNC: Knowledge base already up-to-date with kernel.")
    except Exception as e:
        db.rollback()
        logger.error(f"🚨 KERNEL SYNC DB COMMIT FAILED: {e}")
