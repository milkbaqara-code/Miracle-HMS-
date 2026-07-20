# backend_api/app/workers/background_job_worker.py
import asyncio
import logging
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.core.database import SessionLocal

logger = logging.getLogger("BACKGROUND-JOB-WORKER")

async def run_background_job_worker():
    await asyncio.sleep(10)  # Wait for full server stabilization
    logger.info("⚙️ BACKGROUND JOB WORKER: Started loop.")
    while True:
        try:
            db = SessionLocal()
            try:
                from app.models.models import BackgroundJob
                # Find the next pending background job
                job = db.query(BackgroundJob).filter(BackgroundJob.status == "PENDING").order_by(BackgroundJob.created_at.asc()).first()
                if job:
                    job.status = "PROCESSING"
                    db.commit()  # Commit immediately to mark it as PROCESSING and avoid duplicate runs
                    
                    # Process the job
                    success, error_msg = await process_single_job(db, job)
                    
                    # Fetch fresh instance to update
                    job = db.query(BackgroundJob).filter(BackgroundJob.id == job.id).first()
                    if success:
                        job.status = "COMPLETED"
                    else:
                        job.status = "FAILED"
                        job.error_log = error_msg
                    job.processed_at = datetime.now(timezone.utc)
                    db.commit()
            except Exception as e:
                db.rollback()
                logger.error(f"🚨 BACKGROUND JOB WORKER INNER ERROR: {e}", exc_info=True)
            finally:
                db.close()
        except Exception as e:
            logger.error(f"🚨 BACKGROUND JOB WORKER OUTER ERROR: {e}", exc_info=True)
        await asyncio.sleep(5)  # Poll every 5 seconds

async def process_single_job(db: Session, job) -> tuple[bool, str | None]:
    try:
        if job.job_type == "checkout_disbursement":
            p = job.payload
            from app.routers.accounting_engine import record_owner_yield_disbursement
            # Execute yield disbursement within transaction
            record_owner_yield_disbursement(
                db=db,
                room_id=p["room_id"],
                gross_yield=p["gross_yield"],
                management_fee_pct=p["management_fee_pct"],
                period_label=p["period_label"],
                posted_by=p["posted_by"],
                linked_employee_id=p.get("linked_employee_id")
            )
            logger.info(f"✅ [BACKGROUND WORKER] Completed checkout disbursement for Room {p['room_id']}")
            return True, None
            
        elif job.job_type == "checkout_synapse_directives":
            p = job.payload
            from app.models.models import StrategicDirective, DirectiveNode
            room_id = p["room_id"]
            pool_name = p.get("pool_name")
            floor_num = p.get("floor_num")
            category = p.get("category", "ROOM")
            hk_granularity = p.get("hk_granularity", "ALL")
            
            directive_title = f"HOUSEKEEPING: Room {room_id} Checkout Prep"
            if pool_name:
                directive_title = f"HOUSEKEEPING: Pool {pool_name} — Room {room_id} Checkout"

            hk_directive = StrategicDirective(
                title=directive_title,
                description=(
                    f"Checkout triggered housekeeping prep for Room {room_id} "
                    f"(Floor {floor_num}, Category: {category}). "
                    f"Guest departed. Clean, inspect, restock, and set to AVAILABLE."
                ),
                status="ACTIVE",
                priority="NORMAL",
                issued_by="SYSTEM_PMS",
                target_dept="HK",
                tagged_operatives=[],
            )
            db.add(hk_directive)
            db.flush()  # get id

            nodes_to_create = []
            if hk_granularity in ("ALL", "PER_ROOM"):
                nodes_to_create.append(DirectiveNode(
                    directive_id=hk_directive.id,
                    task_name=f"Clean & Inspect Room {room_id}",
                    target_dept="HK",
                    requires_verification=True,
                ))

            if hk_granularity in ("ALL", "PER_FLOOR") and floor_num:
                nodes_to_create.append(DirectiveNode(
                    directive_id=hk_directive.id,
                    task_name=f"Floor {floor_num} Corridor & Common Area Check",
                    target_dept="HK",
                ))

            if hk_granularity in ("ALL", "PER_WING"):
                try:
                    r_num = int(room_id)
                except ValueError:
                    r_num = 0
                wing = "WING-A" if (r_num % 2 == 0) else "WING-B"
                nodes_to_create.append(DirectiveNode(
                    directive_id=hk_directive.id,
                    task_name=f"{wing} Linen & Supply Restocking",
                    target_dept="HK",
                ))

            for node in nodes_to_create:
                db.add(node)
            
            db.flush()
            logger.info(f"✅ [BACKGROUND WORKER] Created HK directive for Room {room_id} with {len(nodes_to_create)} nodes.")
            return True, None
            
        else:
            return False, f"Unknown job type: {job.job_type}"
            
    except Exception as e:
        import traceback
        err_msg = f"{e}\n{traceback.format_exc()}"
        logger.error(f"🚨 [BACKGROUND WORKER] Job {job.id} ({job.job_type}) failed: {err_msg}")
        return False, err_msg
