"""
MIRACLE OS — DEPARTMENTAL ACCOUNTING AGI LAYER (Phase 6F)
==========================================================
Route prefix: /api/accounting/agi/*
Access: ACCOUNTS, GM, ADMIN, CDO

Functions:
  1. Void Pattern Anomaly Detection   — flags staff with ≥3 voids in 24h
  2. Revenue Spike / Drop Alert       — compares today vs 7-day average
  3. Batch Stall Detector             — flags batches stuck in SUBMITTED >24h
  4. Monthly P&L Auto-Summary         — narrative summary for executive report
  5. Department Health Score          — composite KPI score 0-100

Governed by:
  Iron Law 66 — Master Ledger append-only
  Iron Law 72 — Department isolation
  MIRACLE_ACCOUNTING_BIBLE.md Chapter 6 (AGI Oversight Layer)

MySQL Compliance Notes (fixed 2026-06-20):
  - All SQLite julianday() replaced with TIMESTAMPDIFF(HOUR, col, NOW())
  - All datetime('now', '-Xh') replaced with DATE_SUB(NOW(), INTERVAL X HOUR)
  - All derived table subqueries aliased for ONLY_FULL_GROUP_BY compliance
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone, date, timedelta
import logging

from app.core.database import get_db

logger = logging.getLogger("MasterOS.AGI.Accounting")

router = APIRouter(tags=["ZONE 11-F: Accounting AGI Layer"])


def _utcnow() -> str:
    return datetime.now(timezone.utc).isoformat()


# ==============================================================================
# SECTION 1: VOID PATTERN ANOMALY DETECTION
# ==============================================================================

@router.get("/agi/void-anomalies")
def detect_void_anomalies(
    lookback_hours: int = 24,
    threshold: int = 3,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    AGI scan: Find staff members exceeding void threshold in lookback window.
    Threshold default: 3 voids in 24h = anomaly flag.
    Returns severity: LOW / MEDIUM / HIGH / CRITICAL
    MySQL-compatible: uses DATE_SUB/NOW() instead of SQLite datetime()
    """
    try:
        rows = db.execute(text(f"""
            SELECT
                v.requested_by     AS staff_id,
                v.requested_by_name AS staff_name,
                v.dept_id,
                d.name             AS dept_name,
                COUNT(*)           AS void_count,
                SUM(v.amount)      AS void_total,
                MIN(v.requested_at) AS first_void,
                MAX(v.requested_at) AS last_void,
                GROUP_CONCAT(DISTINCT v.reason_code) AS reason_codes
            FROM void_log v
            LEFT JOIN departments d ON d.id = v.dept_id
            WHERE v.requested_at >= DATE_SUB(NOW(), INTERVAL {lookback_hours} HOUR)
            GROUP BY v.requested_by, v.requested_by_name, v.dept_id, d.name
            HAVING COUNT(*) >= :threshold
            ORDER BY void_count DESC
        """), {"threshold": threshold}).fetchall()

        anomalies = []
        for r in rows:
            m = dict(r._mapping)
            count = int(m.get("void_count", 0))
            severity = "LOW" if count < 5 else "MEDIUM" if count < 8 else "HIGH" if count < 12 else "CRITICAL"
            anomalies.append({
                **m,
                "severity": severity,
                "alert": (
                    f"[{severity}] {m.get('staff_name')} has {count} voids in {lookback_hours}h "
                    f"at {m.get('dept_name')} totalling PKR {round(float(m.get('void_total') or 0), 2)}. "
                    f"Reason codes: {m.get('reason_codes')}. "
                    f"Immediate review recommended." if severity in ("HIGH", "CRITICAL") else
                    f"[{severity}] {m.get('staff_name')} has {count} voids at {m.get('dept_name')}. Monitor closely."
                )
            })

        return {
            "status": "SUCCESS",
            "scan_time": _utcnow(),
            "lookback_hours": lookback_hours,
            "threshold": threshold,
            "anomaly_count": len(anomalies),
            "anomalies": anomalies,
            "summary": (
                f"🚨 {len(anomalies)} void anomaly alerts detected." if anomalies
                else "✅ No void anomalies detected. All departments within normal parameters."
            )
        }
    except Exception as e:
        logger.error(f"[AGI] Void anomaly scan failed: {e}")
        return {"status": "ERROR", "detail": str(e)}


# ==============================================================================
# SECTION 2: REVENUE SPIKE / DROP ALERT
# ==============================================================================

@router.get("/agi/revenue-alerts")
def revenue_spike_detection(
    spike_threshold_pct: float = 50.0,
    drop_threshold_pct: float = 30.0,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    AGI scan: Compare today's revenue vs 7-day rolling average per department.
    Flag if today > avg + spike_threshold_pct% or today < avg - drop_threshold_pct%.
    MySQL-compatible: subqueries aliased for strict mode.
    """
    try:
        today = date.today().isoformat()
        seven_days_ago = (date.today() - timedelta(days=7)).isoformat()
        yesterday = (date.today() - timedelta(days=1)).isoformat()

        depts = db.execute(text("SELECT id, name FROM departments WHERE active=1")).fetchall()
        alerts = []

        for dept in depts:
            dept_id, dept_name = dept[0], dept[1]

            # Today's revenue
            today_rev = float(db.execute(text("""
                SELECT COALESCE(SUM(amount), 0)
                FROM till_transactions
                WHERE dept_id=:d AND direction='IN' AND type LIKE 'REVENUE%'
                AND status='ACTIVE' AND DATE(created_at)=:today
            """), {"d": dept_id, "today": today}).scalar() or 0)

            # 7-day daily average — subquery aliased for MySQL strict mode
            avg_data = db.execute(text("""
                SELECT AVG(daily_rev) FROM (
                    SELECT DATE(created_at) AS day, SUM(amount) AS daily_rev
                    FROM till_transactions
                    WHERE dept_id=:d AND direction='IN' AND type LIKE 'REVENUE%'
                    AND status='ACTIVE'
                    AND DATE(created_at) BETWEEN :from_date AND :yesterday
                    GROUP BY DATE(created_at)
                ) AS revenue_days
            """), {
                "d": dept_id,
                "from_date": seven_days_ago,
                "yesterday": yesterday
            }).scalar()

            avg_rev = float(avg_data or 0)

            if avg_rev == 0 and today_rev == 0:
                continue

            if avg_rev > 0:
                pct_change = ((today_rev - avg_rev) / avg_rev) * 100
            else:
                pct_change = 100.0 if today_rev > 0 else 0.0

            alert_type = None
            if pct_change >= spike_threshold_pct:
                alert_type = "SPIKE"
            elif pct_change <= -drop_threshold_pct:
                alert_type = "DROP"

            if alert_type:
                alerts.append({
                    "dept_id": dept_id,
                    "dept_name": dept_name,
                    "alert_type": alert_type,
                    "today_revenue": round(today_rev, 2),
                    "7day_avg": round(avg_rev, 2),
                    "pct_change": round(pct_change, 1),
                    "severity": "HIGH" if abs(pct_change) >= 80 else "MEDIUM",
                    "message": (
                        f"📈 SPIKE: {dept_name} revenue PKR {round(today_rev, 2)} "
                        f"is {round(pct_change, 1)}% above 7-day avg of PKR {round(avg_rev, 2)}."
                        if alert_type == "SPIKE" else
                        f"📉 DROP: {dept_name} revenue PKR {round(today_rev, 2)} "
                        f"is {abs(round(pct_change, 1))}% below 7-day avg of PKR {round(avg_rev, 2)}."
                    )
                })

        return {
            "status": "SUCCESS",
            "scan_time": _utcnow(),
            "alert_count": len(alerts),
            "alerts": alerts,
            "summary": (
                f"⚠️ {len(alerts)} revenue anomaly alert(s) across departments." if alerts
                else "✅ All department revenues within normal parameters."
            )
        }
    except Exception as e:
        logger.error(f"[AGI] Revenue alert scan failed: {e}")
        return {"status": "ERROR", "detail": str(e)}


# ==============================================================================
# SECTION 3: STALLED BATCH DETECTOR
# ==============================================================================

@router.get("/agi/stalled-batches")
def stalled_batch_detector(
    stall_hours: int = 24,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    AGI scan: Find batches stuck in SUBMITTED/PENDING_CONSENT/CONSENTED for >stall_hours.
    MySQL-compatible: uses TIMESTAMPDIFF(HOUR, ...) instead of julianday()
    """
    try:
        rows = db.execute(text("""
            SELECT b.id, b.dept_id, d.name AS dept_name,
                   b.batch_number, b.status, b.tx_count,
                   b.total_revenue, b.total_expense,
                   b.dept_head_name, b.updated_at,
                   TIMESTAMPDIFF(HOUR, b.updated_at, NOW()) AS hours_stalled
            FROM tx_batches b
            LEFT JOIN departments d ON d.id = b.dept_id
            WHERE b.status IN ('SUBMITTED', 'PENDING_CONSENT', 'CONSENTED', 'QUERIED')
            AND TIMESTAMPDIFF(HOUR, b.updated_at, NOW()) > :stall_hours
            ORDER BY hours_stalled DESC
        """), {"stall_hours": stall_hours}).fetchall()

        stalled = []
        for r in rows:
            m = dict(r._mapping)
            hours = float(m.get("hours_stalled") or 0)
            severity = "LOW" if hours < 48 else "MEDIUM" if hours < 72 else "HIGH"
            stalled.append({
                **m,
                "severity": severity,
                "action_required": (
                    "Dept Head PIN consent required"         if m["status"] == "PENDING_CONSENT" else
                    "Dept Head must submit to Gateway"       if m["status"] == "CONSENTED" else
                    "Accounts must review and approve/reject" if m["status"] == "SUBMITTED" else
                    "Dept Head must respond to Gateway query"
                )
            })

        return {
            "status": "SUCCESS",
            "scan_time": _utcnow(),
            "stall_threshold_hours": stall_hours,
            "stalled_count": len(stalled),
            "stalled_batches": stalled,
            "summary": (
                f"🔴 {len(stalled)} batch(es) stalled >{stall_hours}h. Escalation required." if stalled
                else f"✅ No stalled batches. All flows moving normally."
            )
        }
    except Exception as e:
        logger.error(f"[AGI] Stalled batch scan failed: {e}")
        return {"status": "ERROR", "detail": str(e)}


# ==============================================================================
# SECTION 4: MONTHLY P&L AUTO-SUMMARY (Executive Narrative)
# ==============================================================================

@router.get("/agi/monthly-summary")
def monthly_pl_summary(
    year: Optional[int] = None,
    month: Optional[int] = None,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    AGI: Generate executive narrative P&L summary for a given month.
    Reads from till_transactions (not master_ledger) for live accuracy.
    """
    try:
        today = date.today()
        yr = year or today.year
        mo = month or today.month
        month_start = f"{yr}-{mo:02d}-01"
        if mo == 12:
            month_end = f"{yr+1}-01-01"
        else:
            month_end = f"{yr}-{mo+1:02d}-01"

        # Company-wide totals
        totals = db.execute(text("""
            SELECT
                COALESCE(SUM(CASE WHEN direction='IN' AND type LIKE 'REVENUE%' AND status='ACTIVE' THEN amount END), 0) AS gross_rev,
                COALESCE(SUM(CASE WHEN direction='OUT' AND type='EXPENSE_CASH' AND status='ACTIVE' THEN amount END), 0) AS total_exp,
                COUNT(CASE WHEN status='VOIDED' THEN 1 END) AS void_count,
                COALESCE(SUM(CASE WHEN status='VOIDED' THEN amount END), 0) AS void_amt,
                COUNT(DISTINCT dept_id) AS active_depts
            FROM till_transactions
            WHERE DATE(created_at) >= :s AND DATE(created_at) < :e
        """), {"s": month_start, "e": month_end}).fetchone()

        # Per-department breakdown
        dept_rows = db.execute(text("""
            SELECT
                t.dept_id, d.name AS dept_name,
                COALESCE(SUM(CASE WHEN t.direction='IN' AND t.type LIKE 'REVENUE%' AND t.status='ACTIVE' THEN t.amount END), 0) AS rev,
                COALESCE(SUM(CASE WHEN t.direction='OUT' AND t.type='EXPENSE_CASH' AND t.status='ACTIVE' THEN t.amount END), 0) AS exp,
                COUNT(CASE WHEN t.status='VOIDED' THEN 1 END) AS voids
            FROM till_transactions t
            LEFT JOIN departments d ON d.id=t.dept_id
            WHERE DATE(t.created_at) >= :s AND DATE(t.created_at) < :e
            GROUP BY t.dept_id, d.name
            ORDER BY rev DESC
        """), {"s": month_start, "e": month_end}).fetchall()

        gross_rev = float(totals[0] or 0)
        total_exp = float(totals[1] or 0)
        void_amt  = float(totals[3] or 0)
        net_rev   = gross_rev - void_amt
        net_income = net_rev - total_exp
        margin_pct = round((net_income / net_rev * 100) if net_rev else 0, 1)

        dept_data = [dict(r._mapping) for r in dept_rows]
        for d in dept_data:
            d["net"] = float(d["rev"]) - float(d["exp"])

        star_dept    = max(dept_data, key=lambda x: x["net"], default=None) if dept_data else None
        laggard_dept = min(dept_data, key=lambda x: x["net"], default=None) if dept_data else None

        import calendar
        month_name = calendar.month_name[mo]
        performance_grade = (
            "EXCEPTIONAL" if margin_pct >= 60 else
            "STRONG"      if margin_pct >= 40 else
            "MODERATE"    if margin_pct >= 20 else
            "WEAK"        if margin_pct >= 0  else
            "LOSS-MAKING"
        )

        narrative = f"""
MIRACLE OS — EXECUTIVE P&L SUMMARY
Month: {month_name} {yr}
Generated: {_utcnow()[:10]}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PERFORMANCE GRADE: {performance_grade}

HEADLINE FIGURES:
  Gross Revenue      PKR {gross_rev:>15,.2f}
  Void Adjustments   PKR {void_amt:>15,.2f} ({int(totals[2])} transactions)
  Net Revenue        PKR {net_rev:>15,.2f}
  Total Expenses     PKR {total_exp:>15,.2f}
  Net Operating Income PKR {net_income:>13,.2f}
  Gross Margin       {margin_pct}%

DEPARTMENTAL BREAKDOWN:
""".strip()

        for d in dept_data:
            narrative += f"\n  {d['dept_name']:<25} Rev: PKR {float(d['rev']):>12,.2f}  Exp: PKR {float(d['exp']):>10,.2f}  Net: PKR {d['net']:>10,.2f}"

        if star_dept:
            narrative += f"\n\nSTAR DEPARTMENT: {star_dept['dept_name']} with net PKR {star_dept['net']:,.2f}"
        if laggard_dept and laggard_dept != star_dept:
            narrative += f"\nATTENTION REQUIRED: {laggard_dept['dept_name']} with net PKR {laggard_dept['net']:,.2f}"

        narrative += f"\n\nVOID ANALYSIS: {int(totals[2])} voids totalling PKR {void_amt:,.2f} this month."
        narrative += f"\n{'━' * 60}\nPowered by Miracle OS AGI Accounting Engine (Phase 6F)"

        return {
            "status": "SUCCESS",
            "month": f"{month_name} {yr}",
            "generated_at": _utcnow(),
            "performance_grade": performance_grade,
            "financials": {
                "gross_revenue": round(gross_rev, 2),
                "void_adjustments": round(void_amt, 2),
                "net_revenue": round(net_rev, 2),
                "total_expenses": round(total_exp, 2),
                "net_operating_income": round(net_income, 2),
                "gross_margin_pct": margin_pct,
                "active_departments": int(totals[4] or 0),
                "void_count": int(totals[2] or 0)
            },
            "departments": dept_data,
            "star_department": star_dept,
            "attention_department": laggard_dept if laggard_dept != star_dept else None,
            "narrative": narrative
        }
    except Exception as e:
        logger.error(f"[AGI] Monthly summary failed: {e}")
        return {"status": "ERROR", "detail": str(e)}


# ==============================================================================
# SECTION 5: DEPARTMENT HEALTH SCORE (Composite KPI 0-100)
# ==============================================================================

@router.get("/agi/health-scores")
def department_health_scores(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """
    AGI: Compute a composite health score (0–100) for each department.
    Scoring:
      Revenue trend     — 30 pts  (today vs 7-day avg, positive = higher score)
      Void rate         — 25 pts  (lower voids = higher score)
      Batch hygiene     — 25 pts  (no stalled batches = full score)
      Expense ratio     — 20 pts  (lower expense/revenue = higher score)
    MySQL-compatible: TIMESTAMPDIFF, aliased subqueries.
    """
    try:
        today = date.today().isoformat()
        seven_days_ago = (date.today() - timedelta(days=7)).isoformat()
        yesterday = (date.today() - timedelta(days=1)).isoformat()
        depts = db.execute(text("SELECT id, name FROM departments WHERE active=1")).fetchall()
        scores = []

        for dept in depts:
            dept_id, dept_name = dept[0], dept[1]

            # 1. Revenue trend score (30 pts)
            today_rev = float(db.execute(text("""
                SELECT COALESCE(SUM(amount),0) FROM till_transactions
                WHERE dept_id=:d AND direction='IN' AND type LIKE 'REVENUE%'
                AND status='ACTIVE' AND DATE(created_at)=:today
            """), {"d": dept_id, "today": today}).scalar() or 0)

            avg_rev_raw = db.execute(text("""
                SELECT AVG(daily_rev) FROM (
                    SELECT SUM(amount) AS daily_rev FROM till_transactions
                    WHERE dept_id=:d AND direction='IN' AND type LIKE 'REVENUE%'
                    AND status='ACTIVE'
                    AND DATE(created_at) BETWEEN :from_d AND :yesterday
                    GROUP BY DATE(created_at)
                ) AS daily_agg
            """), {"d": dept_id, "from_d": seven_days_ago, "yesterday": yesterday}).scalar()

            avg_rev = float(avg_rev_raw or 0)
            if avg_rev > 0:
                trend_pct = ((today_rev - avg_rev) / avg_rev) * 100
                rev_score = min(30, max(0, 15 + (trend_pct / 100 * 15)))
            else:
                rev_score = 15.0 if today_rev > 0 else 5.0

            # 2. Void rate score (25 pts)
            void_data = db.execute(text("""
                SELECT COUNT(*), COALESCE(SUM(amount),0) FROM void_log
                WHERE dept_id=:d AND DATE(requested_at) >= :from_d
            """), {"d": dept_id, "from_d": seven_days_ago}).fetchone()
            void_count = int(void_data[0] or 0)
            void_score = max(0, 25 - (void_count * 4))

            # 3. Batch hygiene score (25 pts) — MySQL TIMESTAMPDIFF
            stalled = db.execute(text("""
                SELECT COUNT(*) FROM tx_batches
                WHERE dept_id=:d
                AND status IN ('PENDING_CONSENT','CONSENTED','SUBMITTED','QUERIED')
                AND TIMESTAMPDIFF(HOUR, updated_at, NOW()) > 24
            """), {"d": dept_id}).scalar() or 0
            batch_score = max(0, 25 - (int(stalled) * 10))

            # 4. Expense ratio score (20 pts)
            exp_data = db.execute(text("""
                SELECT
                    COALESCE(SUM(CASE WHEN direction='IN' AND type LIKE 'REVENUE%' AND status='ACTIVE' THEN amount END),0) AS rev,
                    COALESCE(SUM(CASE WHEN direction='OUT' AND type='EXPENSE_CASH' AND status='ACTIVE' THEN amount END),0) AS exp
                FROM till_transactions WHERE dept_id=:d AND DATE(created_at)=:today
            """), {"d": dept_id, "today": today}).fetchone()
            rev_t = float(exp_data[0] or 0)
            exp_t = float(exp_data[1] or 0)
            if rev_t > 0:
                exp_ratio = exp_t / rev_t
                exp_score = max(0, 20 - (exp_ratio * 20))
            else:
                exp_score = 10.0

            total = round(rev_score + void_score + batch_score + exp_score, 1)
            grade = "A" if total >= 85 else "B" if total >= 70 else "C" if total >= 50 else "D" if total >= 30 else "F"

            scores.append({
                "dept_id": dept_id,
                "dept_name": dept_name,
                "score": total,
                "grade": grade,
                "breakdown": {
                    "revenue_trend": round(rev_score, 1),
                    "void_hygiene": round(void_score, 1),
                    "batch_flow": round(batch_score, 1),
                    "expense_ratio": round(exp_score, 1),
                },
                "status": "EXCELLENT" if total >= 85 else "HEALTHY" if total >= 70 else "NEEDS_ATTENTION" if total >= 50 else "CRITICAL"
            })

        scores.sort(key=lambda x: x["score"], reverse=True)
        avg_score = round(sum(s["score"] for s in scores) / len(scores), 1) if scores else 0

        return {
            "status": "SUCCESS",
            "generated_at": _utcnow(),
            "overall_health": avg_score,
            "overall_grade": "A" if avg_score >= 85 else "B" if avg_score >= 70 else "C" if avg_score >= 50 else "D",
            "department_scores": scores,
            "top_performer": scores[0] if scores else None,
            "needs_attention": [s for s in scores if s["score"] < 50]
        }
    except Exception as e:
        logger.error(f"[AGI] Health score computation failed: {e}")
        return {"status": "ERROR", "detail": str(e)}


# ==============================================================================
# SECTION 6: FULL INTELLIGENCE DASHBOARD (all scans in one call)
# ==============================================================================

@router.get("/agi/intelligence-report")
def full_intelligence_report(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """
    AGI: Master intelligence report — runs all 4 scans and returns unified dashboard data.
    Called by the AGI Accounts page every 5 minutes via polling.
    All sub-scans are wrapped in try/except so one failure doesn't kill the whole report.
    """
    def safe(fn, **kwargs):
        try:
            return fn(**kwargs, db=db)
        except Exception as e:
            logger.error(f"[AGI] Sub-scan failed: {e}")
            return {"status": "ERROR", "detail": str(e)}

    void_scan   = safe(detect_void_anomalies)
    rev_scan    = safe(revenue_spike_detection)
    batch_scan  = safe(stalled_batch_detector)
    health_scan = safe(department_health_scores)
    monthly     = safe(monthly_pl_summary)

    total_alerts = (
        void_scan.get("anomaly_count", 0) +
        rev_scan.get("alert_count", 0) +
        batch_scan.get("stalled_count", 0)
    )

    system_status = (
        "CRITICAL" if total_alerts >= 5 else
        "WARNING"  if total_alerts >= 2 else
        "HEALTHY"
    )

    return {
        "status": "SUCCESS",
        "generated_at": _utcnow(),
        "system_status": system_status,
        "total_alerts": total_alerts,
        "void_intelligence": void_scan,
        "revenue_intelligence": rev_scan,
        "batch_intelligence": batch_scan,
        "health_scores": health_scan,
        "monthly_summary": monthly,
        "headline": (
            f"🚨 SYSTEM CRITICAL — {total_alerts} active alerts require immediate action."
            if system_status == "CRITICAL" else
            f"⚠️ {total_alerts} alert(s) detected. Review recommended."
            if system_status == "WARNING" else
            f"✅ All systems operating normally. Overall health: {health_scan.get('overall_health', 0)}/100."
        )
    }
