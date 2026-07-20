import re

filepath = 'backend_api/app/routers/dept_accounting.py'
content = open(filepath, 'r', encoding='utf-8').read()

# Find and replace the update_department function
old_func_marker = '@router.patch("/dept/{dept_id}/update")\ndef update_department'
old_end_marker = '    return {"status": "SUCCESS", "message": f"Department {dept_id} updated."}'

start = content.find(old_func_marker)
end = content.find(old_end_marker) + len(old_end_marker)

if start == -1:
    print("ERROR: Could not find update_department function")
    exit(1)

new_func = '''@router.patch("/dept/{dept_id}/update")
def update_department(dept_id: str, data: dict, db: Session = Depends(get_db)) -> dict:
    """CDO only: Update department. Iron Law 72: Deactivation blocked if pending batches or positive till."""
    caller = get_caller_info(data)
    if caller["role"] not in ("CDO", "ADMIN"):
        raise HTTPException(status_code=403, detail="Only CDO/ADMIN can modify departments.")

    # === IRON LAW 72: Deactivation Safety Guards ===
    if data.get("active") == 0 or data.get("active") is False:
        # Guard A: Block if any in-flight batch
        pending = db.execute(text(
            "SELECT id, status FROM tx_batches WHERE dept_id=:d "
            "AND status IN ('OPEN','PENDING_CONSENT','CONSENTED','SUBMITTED','QUERIED') LIMIT 1"
        ), {"d": dept_id}).fetchone()
        if pending:
            raise HTTPException(
                status_code=409,
                detail=(
                    f"[IRON LAW 72] Deactivation blocked. Batch {pending[0]} status='{pending[1]}'. "
                    "All batches must be POSTED or REJECTED before deactivating this department."
                )
            )
        # Guard B: Block if positive till balance
        balance = _compute_till_balance(dept_id, db)
        if balance > 0:
            raise HTTPException(
                status_code=409,
                detail=(
                    f"[IRON LAW 72] Deactivation blocked. Till balance is PKR {round(balance, 2)}. "
                    "Perform a CASH_DROP to zero the till first."
                )
            )
        logger.info(f"[DEPT-ACC][LAW-72] {dept_id} passed deactivation guards: balance=0, no pending batches.")
    # === End Iron Law 72 ===

    updates = []
    params = {"id": dept_id, "ts": _utcnow()}
    for field in ("head_user_id", "head_name", "active", "price_tier"):
        if field in data:
            updates.append(f"{field} = :{field}")
            params[field] = data[field]
    if not updates:
        raise HTTPException(status_code=422, detail="No updatable fields provided.")
    updates.append("updated_at = :ts")
    db.execute(text(f"UPDATE departments SET {', '.join(updates)} WHERE id = :id"), params)
    db.commit()
    action = "DEACTIVATED (all historical data preserved)" if data.get("active") == 0 else "UPDATED"
    return {"status": "SUCCESS", "message": f"Department {dept_id} — {action}."}'''

new_content = content[:start] + new_func + content[end:]
open(filepath, 'w', encoding='utf-8').write(new_content)
print(f"Iron Law 72 guard injected. File size: {len(new_content)} chars")
