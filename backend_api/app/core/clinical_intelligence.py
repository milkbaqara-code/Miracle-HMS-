"""
MIRACLE HMS -- CLINICAL INTELLIGENCE LAYER (V4.0)
==================================================
Layer 1 Sensor Pillars -- runs at 0 LLM tokens.
Every function reads DIRECTLY from the database.
No estimation. No hallucination. Real data only.

HMS CLINICAL PILLARS:
  1. BED CENSUS         -- live bed status, BOR, CRITICAL count
  2. CLINICAL KPIs      -- ALOS, RevPAB, CPPD, TAT compliance
  3. REVENUE PULSE      -- OPD/IPD/Pharmacy/Lab today
  4. PHARMACY ALERTS    -- drugs below PAR level
  5. HR DUTY STATUS     -- on-duty doctors/nurses by department
  6. OUTSTANDING BILLS  -- patients with unpaid balances
  7. TICKET ESCALATIONS -- CRITICAL tickets needing action
  8. SYSTEM HEALTH      -- DB stats, session count, knowledge count
"""

from datetime import datetime, date, timezone, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func, text, case
from app.models.models import (
    AssetGrid, GuestFolio, SolveMission, Inventory,
    Employee, AccountingLedger, Reservation, GuestCRM,
    SystemConfig
)
import logging

logger = logging.getLogger("ClinicalIntelligence")


class ClinicalIntelligenceLayer:
    """
    Layer 1 of the 4-layer token hierarchy.
    All methods: 0 LLM tokens. Pure SQLAlchemy.
    """

    # ================================================================
    # PILLAR 1: BED CENSUS -- LIVE HOSPITAL BED STATUS
    # ================================================================
    @staticmethod
    def get_bed_census(db: Session) -> dict:
        """
        Real-time bed census from asset_grid table.
        BOR = Occupied / Total Active * 100
        Returns: total, occupied, available, critical, discharge_due, maintenance, BOR
        """
        try:
            total = db.query(func.count(AssetGrid.id)).filter(AssetGrid.is_active == True).scalar() or 0
            occupied = db.query(func.count(AssetGrid.id)).filter(
                AssetGrid.current_status == "IN-HOUSE", AssetGrid.is_active == True
            ).scalar() or 0
            available = db.query(func.count(AssetGrid.id)).filter(
                AssetGrid.current_status == "VACANT", AssetGrid.is_active == True
            ).scalar() or 0
            maintenance = db.query(func.count(AssetGrid.id)).filter(
                AssetGrid.current_status == "OUT-OF-ORDER", AssetGrid.is_active == True
            ).scalar() or 0
            discharge_due = db.query(func.count(AssetGrid.id)).filter(
                AssetGrid.current_status == "DIRTY", AssetGrid.is_active == True
            ).scalar() or 0

            # CRITICAL beds: linked to CRITICAL tickets
            critical = db.query(func.count(SolveMission.id)).filter(
                SolveMission.priority == "CRITICAL",
                SolveMission.status.in_(["PENDING", "ACTIVE"])
            ).scalar() or 0

            bor = round((occupied / total * 100), 1) if total > 0 else 0.0

            # Ward breakdown
            ward_breakdown = db.query(
                AssetGrid.category,
                func.count(AssetGrid.id).label("total"),
                func.sum(case((AssetGrid.current_status == "IN-HOUSE", 1), else_=0)).label("occupied")
            ).filter(AssetGrid.is_active == True).group_by(AssetGrid.category).all()

            wards = [
                {"ward": w.category, "total": w.total, "occupied": w.occupied or 0,
                 "bor": round((w.occupied or 0) / w.total * 100, 1) if w.total else 0}
                for w in ward_breakdown
            ]

            return {
                "total_beds": total,
                "occupied": occupied,
                "available": available,
                "maintenance": maintenance,
                "discharge_due": discharge_due,
                "critical_tickets": critical,
                "bor_percent": bor,
                "bor_status": "OVERCAPACITY" if bor > 95 else "HIGH" if bor > 80 else "NORMAL" if bor > 50 else "LOW",
                "ward_breakdown": wards
            }
        except Exception as e:
            logger.error(f"[BED CENSUS] Failed: {e}")
            return {"error": str(e), "bor_percent": 0}

    # ================================================================
    # PILLAR 2: CLINICAL KPIs -- ALOS, REVPAB, CPPD
    # ================================================================
    @staticmethod
    def get_clinical_kpis(db: Session) -> dict:
        """
        Hospital performance KPIs. All calculated from live DB.
        ALOS = avg nights per completed admission (CHECKED_OUT reservations)
        RevPAB = total revenue / total active bed-days
        CPPD = total payroll / total patient days
        """
        try:
            today = date.today()
            month_start = today.replace(day=1)

            # ALOS: Average Length of Stay this month
            alos_result = db.query(func.avg(Reservation.nights)).filter(
                Reservation.status == "CHECKED_IN",
                Reservation.start_date >= month_start.isoformat()
            ).scalar()
            alos = round(float(alos_result), 1) if alos_result else 0.0

            # Total patient days this month
            patient_days = db.query(func.sum(Reservation.nights)).filter(
                Reservation.start_date >= month_start.isoformat()
            ).scalar() or 0

            # Revenue this month from folios
            monthly_revenue = db.query(func.sum(GuestFolio.rate)).filter(
                GuestFolio.check_in_date >= month_start.isoformat()
            ).scalar() or 0.0

            # Total active beds
            total_beds = db.query(func.count(AssetGrid.id)).filter(
                AssetGrid.is_active == True
            ).scalar() or 1

            # Days in month so far
            days_elapsed = (today - month_start).days + 1
            available_bed_days = total_beds * days_elapsed

            # RevPAB
            revpab = round(float(monthly_revenue) / available_bed_days, 2) if available_bed_days > 0 else 0.0

            # Payroll this month
            total_payroll = db.query(func.sum(Employee.base_salary)).filter(
                Employee.status != "TERMINATED"
            ).scalar() or 0.0

            # CPPD
            cppd = round(float(total_payroll) / max(patient_days, 1), 2)

            # Today's admissions and discharges
            today_admissions = db.query(func.count(Reservation.id)).filter(
                Reservation.start_date == today.isoformat(),
                Reservation.status == "CHECKED_IN"
            ).scalar() or 0

            return {
                "alos_days": alos,
                "alos_benchmark": "GOOD" if alos < 7 else "REVIEW",
                "revpab": revpab,
                "cppd": cppd,
                "monthly_revenue": round(float(monthly_revenue), 2),
                "patient_days_mtd": int(patient_days),
                "payroll_ratio": round(float(total_payroll) / max(float(monthly_revenue), 1) * 100, 1),
                "today_admissions": today_admissions,
            }
        except Exception as e:
            logger.error(f"[CLINICAL KPIs] Failed: {e}")
            return {"error": str(e)}

    # ================================================================
    # PILLAR 3: REVENUE PULSE -- TODAY'S REVENUE BY DEPARTMENT
    # ================================================================
    @staticmethod
    def get_revenue_pulse(db: Session) -> dict:
        """
        Today's revenue broken down by source: OPD, IPD, Pharmacy, Lab.
        Reads from accounting_ledger where entry is today.
        """
        try:
            today = date.today().isoformat()

            # Revenue by account_code categories
            revenue_rows = db.query(
                AccountingLedger.account_code,
                func.sum(AccountingLedger.credit).label("revenue")
            ).filter(
                AccountingLedger.created_at >= today,
                AccountingLedger.credit > 0
            ).group_by(AccountingLedger.account_code).all()

            revenue_map = {r.account_code: round(float(r.revenue or 0), 2) for r in revenue_rows}

            # Outstanding patient balances
            outstanding = db.query(func.sum(GuestFolio.balance)).filter(
                GuestFolio.status == "IN_HOUSE",
                GuestFolio.balance > 0
            ).scalar() or 0.0

            # Total POS transactions today
            total_revenue = sum(revenue_map.values())

            return {
                "today": today,
                "revenue_by_department": revenue_map,
                "total_revenue_today": round(total_revenue, 2),
                "outstanding_patient_bills": round(float(outstanding), 2),
                "top_revenue_source": max(revenue_map, key=revenue_map.get) if revenue_map else "N/A"
            }
        except Exception as e:
            logger.error(f"[REVENUE PULSE] Failed: {e}")
            return {"error": str(e), "total_revenue_today": 0}

    # ================================================================
    # PILLAR 4: PHARMACY ALERTS -- BELOW PAR LEVEL DRUGS
    # ================================================================
    @staticmethod
    def get_pharmacy_alerts(db: Session) -> dict:
        """
        Drugs and consumables where stock < min_level (PAR).
        CRITICAL: patient safety risk. Escalate immediately.
        """
        try:
            below_par = db.query(Inventory).filter(
                Inventory.stock < Inventory.min_level,
                Inventory.min_level > 0,
                Inventory.stock >= 0
            ).order_by(
                (Inventory.min_level - Inventory.stock).desc()
            ).limit(20).all()

            alerts = []
            critical_count = 0
            for item in below_par:
                deficit = (item.min_level or 0) - (item.stock or 0)
                severity = "CRITICAL" if deficit > item.min_level * 0.5 else "WARNING"
                if severity == "CRITICAL":
                    critical_count += 1
                alerts.append({
                    "item": item.name,
                    "category": item.category,
                    "dept": item.dept,
                    "current_stock": item.stock,
                    "par_level": item.min_level,
                    "deficit": deficit,
                    "severity": severity
                })

            return {
                "total_below_par": len(alerts),
                "critical_count": critical_count,
                "alerts": alerts,
                "patient_safety_risk": critical_count > 0
            }
        except Exception as e:
            logger.error(f"[PHARMACY ALERTS] Failed: {e}")
            return {"error": str(e), "total_below_par": 0}

    # ================================================================
    # PILLAR 5: HR DUTY STATUS -- ON-DUTY STAFF BY DEPARTMENT
    # ================================================================
    @staticmethod
    def get_hr_duty_status(db: Session) -> dict:
        """
        On-duty staff count by department. Critical coverage gap detection.
        """
        try:
            duty_by_dept = db.query(
                Employee.dept,
                func.count(Employee.id).label("on_duty"),
                func.count(Employee.id).label("total")
            ).filter(
                Employee.status != "TERMINATED"
            ).group_by(Employee.dept).all()

            on_duty_by_dept = db.query(
                Employee.dept,
                func.count(Employee.id).label("count")
            ).filter(
                Employee.status == "ON-DUTY"
            ).group_by(Employee.dept).all()

            on_duty_map = {r.dept: r.count for r in on_duty_by_dept}
            total_map = {r.dept: r.total for r in duty_by_dept}

            # Critical departments check
            critical_clinical_depts = ["Physicians", "Surgeons", "ICU Nursing", "Ward Nursing", "ER Doctors"]
            coverage_gaps = [
                dept for dept in critical_clinical_depts
                if on_duty_map.get(dept, 0) == 0
            ]

            doctors_on_duty = sum(
                on_duty_map.get(dept, 0)
                for dept in ["Physicians", "Surgeons", "ER Doctors", "Outpatient (OPD)"]
            )
            nurses_on_duty = sum(
                on_duty_map.get(dept, 0)
                for dept in ["ICU Nursing", "Ward Nursing"]
            )

            total_staff_on_duty = sum(on_duty_map.values())
            total_staff = sum(total_map.values())

            return {
                "total_on_duty": total_staff_on_duty,
                "total_staff": total_staff,
                "doctors_on_duty": doctors_on_duty,
                "nurses_on_duty": nurses_on_duty,
                "coverage_gaps": coverage_gaps,
                "critical_gap": len(coverage_gaps) > 0,
                "by_department": {dept: on_duty_map.get(dept, 0) for dept in total_map}
            }
        except Exception as e:
            logger.error(f"[HR DUTY STATUS] Failed: {e}")
            return {"error": str(e), "doctors_on_duty": 0, "nurses_on_duty": 0}

    # ================================================================
    # PILLAR 6: OUTSTANDING BILLS
    # ================================================================
    @staticmethod
    def get_outstanding_bills(db: Session) -> dict:
        """Patients with unpaid or partially paid balances."""
        try:
            outstanding = db.query(GuestFolio).filter(
                GuestFolio.status == "IN_HOUSE",
                GuestFolio.balance > 0
            ).order_by(GuestFolio.balance.desc()).limit(10).all()

            total_outstanding = db.query(func.sum(GuestFolio.balance)).filter(
                GuestFolio.status == "IN_HOUSE", GuestFolio.balance > 0
            ).scalar() or 0.0

            overdue_count = db.query(func.count(GuestFolio.id)).filter(
                GuestFolio.status == "IN_HOUSE",
                GuestFolio.balance > 10000  # flag large outstanding amounts
            ).scalar() or 0

            return {
                "total_outstanding": round(float(total_outstanding), 2),
                "patient_count": len(outstanding),
                "overdue_large": overdue_count,
                "top_debtors": [
                    {"patient": f.guest_name, "balance": round(float(f.balance), 2),
                     "bed": f.room_number, "since": str(f.check_in_date)}
                    for f in outstanding[:5]
                ]
            }
        except Exception as e:
            logger.error(f"[OUTSTANDING BILLS] Failed: {e}")
            return {"error": str(e), "total_outstanding": 0}

    # ================================================================
    # PILLAR 7: TICKET ESCALATIONS
    # ================================================================
    @staticmethod
    def get_ticket_escalations(db: Session) -> dict:
        """CRITICAL and URGENT pending tickets -- patient safety first."""
        try:
            critical = db.query(SolveMission).filter(
                SolveMission.priority == "CRITICAL",
                SolveMission.status.in_(["PENDING", "ACTIVE"])
            ).order_by(SolveMission.created_at.asc()).limit(10).all()

            urgent = db.query(func.count(SolveMission.id)).filter(
                SolveMission.priority == "URGENT",
                SolveMission.status.in_(["PENDING", "ACTIVE"])
            ).scalar() or 0

            return {
                "critical_count": len(critical),
                "urgent_count": urgent,
                "patient_safety_risk": len(critical) > 0,
                "critical_tickets": [
                    {"id": t.id, "title": t.title, "dept": t.dept,
                     "bed": t.room_no, "since": str(t.created_at)[:16]}
                    for t in critical
                ]
            }
        except Exception as e:
            logger.error(f"[TICKET ESCALATIONS] Failed: {e}")
            return {"error": str(e), "critical_count": 0}

    # ================================================================
    # COMPOSITE: FULL CLINICAL COMMAND REPORT (all pillars)
    # ================================================================
    @staticmethod
    def get_full_clinical_command(db: Session) -> dict:
        """
        Single call that fires all 7 pillars simultaneously.
        Used for CDO/GM morning report and 'give me a status report' queries.
        All at Layer 1 -- 0 LLM tokens for data collection.
        """
        return {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "bed_census": ClinicalIntelligenceLayer.get_bed_census(db),
            "clinical_kpis": ClinicalIntelligenceLayer.get_clinical_kpis(db),
            "revenue_pulse": ClinicalIntelligenceLayer.get_revenue_pulse(db),
            "pharmacy_alerts": ClinicalIntelligenceLayer.get_pharmacy_alerts(db),
            "hr_duty": ClinicalIntelligenceLayer.get_hr_duty_status(db),
            "outstanding_bills": ClinicalIntelligenceLayer.get_outstanding_bills(db),
            "ticket_escalations": ClinicalIntelligenceLayer.get_ticket_escalations(db),
        }

    # ================================================================
    # LAYER 0: KNOWLEDGE BASE (instant how-to answers)
    # ================================================================
    KNOWLEDGE_BASE = {
        # Navigation
        "bed_management":    "Bed management is in Z-07 Clinical Command Grid. Every bed card shows live status: AVAILABLE, ADMITTED, CRITICAL, DISCHARGE_DUE, MAINTENANCE. Click a bed card to ADMIT, DISCHARGE, or ESCALATE.",
        "opd_appointments":  "OPD appointments are managed in Z-05. Use the 45-day tape chart to book, the Walk-In Queue for immediate patients, and Admission Management to convert OPD to IPD.",
        "patient_billing":   "Patient bills are in Z-08 Patient Billing. Bill = ward charges + nursing + pharmacy + lab + procedures. Settle via Cash, Card, UPI, Insurance (TPA). Discount needs CDO/GM approval.",
        "inventory_stock":   "Pharmacy and medical inventory is in Z-12 Clinical Inventory Vault. Use the Receiving Bay tab to log deliveries. PAR alerts fire automatically when stock drops below min_level.",
        "staff_payroll":     "HR and payroll is in Z-09 HR Engine. Attendance feeds from Z-18 Biometric Portal. NRS = Nursing department code. Payroll = Base + Allowances + Overtime - Deductions.",
        "accounts_finance":  "Financial accounts are in Z-11. Tabs: Revenue Vector (donut chart), P&L Statement, Cash Flow, AR Aging (overdue bills), GL Ledger, Bank Reconciliation.",
        "add_user":          "New system users are created in Z-21 Kernel Settings > User Management. Roles: CDO, GM, ADMIN, HR, ACC, DOCTOR, NURSE, WARD_ADMIN, PHARMACIST, LAB_TECH, STAFF.",
        "issue_tickets":     "Clinical and maintenance tickets are in Z-16 Issue Tickets. Priority: LOW, NORMAL, URGENT, CRITICAL. CRITICAL = patient safety. CRITICAL tickets auto-escalate to on-call.",
        "synapse_war_room":  "Synapse Nexus (Z-20) is the Hospital War Room: Neural Tree (org-chart), Kanban directives, AGI Arbitrator (auto task decomposition), WebRTC video calls, Clinical voice channels.",
        "policy_pricing":    "ALL service prices are set ONLY in Z-19 Policy Engine. OPD consultation rates, IPD ward daily rates, lab fees, procedure charges. Changing prices elsewhere is forbidden.",
        "patient_portal":    "The Patient Portal (Z-GUEST) at /guest lets patients view their appointment, bed number, itemised bill, order meals to their bed, message the nursing station, and view lab results.",
        "clinical_command":  "The Clinical Command Grid (Z-07) is the God View -- all hospital beds visible simultaneously. CRITICAL beds strobe red. On-call escalation button visible on each occupied bed card.",
        "nrs_definition":    "NRS = Nursing department staff code in Z-09 HR Engine. NRS staff are: Staff Nurses, Senior Nurses, Head Nurses, Nursing Assistants. Not an external software system.",
        "infra_dashboard":   "Sovereign Infra (Z-23) shows VPS CPU/RAM/Disk, PM2 process health, AI audit stream, and the BRAIN MANIFEST (knowledge injection gate). CDO access only.",
    }

    @staticmethod
    def classify_locally(query: str) -> dict:
        """
        LAYER 0 CLASSIFIER V4.0 -- HMS Clinical Edition
        Zero-token intent detection for common queries.
        Returns {intent, data} or {intent, tool} for analytics.
        """
        q = query.lower().strip()

        # ============================================================
        # A: HOW-TO / NAVIGATION (0 Tokens -- instant answers)
        # ============================================================
        how_to_triggers = ["how do i", "how to", "where is", "where do i", "how can i",
                           "where can i", "where are", "what is the", "how does"]
        is_how_to = any(t in q for t in how_to_triggers)

        if is_how_to:
            if any(w in q for w in ["bed", "ward", "command grid", "admit", "occupied bed"]):
                return {"intent": "HELP", "data": ClinicalIntelligenceLayer.KNOWLEDGE_BASE["bed_management"]}
            if any(w in q for w in ["opd", "appointment", "book appointment", "reserv"]):
                return {"intent": "HELP", "data": ClinicalIntelligenceLayer.KNOWLEDGE_BASE["opd_appointments"]}
            if any(w in q for w in ["billing", "invoice", "patient bill", "settle", "checkout"]):
                return {"intent": "HELP", "data": ClinicalIntelligenceLayer.KNOWLEDGE_BASE["patient_billing"]}
            if any(w in q for w in ["inventory", "stock", "pharmacy stock", "drug", "par"]):
                return {"intent": "HELP", "data": ClinicalIntelligenceLayer.KNOWLEDGE_BASE["inventory_stock"]}
            if any(w in q for w in ["payroll", "salary", "staff pay", "nrs", "hr engine"]):
                return {"intent": "HELP", "data": ClinicalIntelligenceLayer.KNOWLEDGE_BASE["staff_payroll"]}
            if any(w in q for w in ["account", "finance", "ledger", "p&l", "night audit"]):
                return {"intent": "HELP", "data": ClinicalIntelligenceLayer.KNOWLEDGE_BASE["accounts_finance"]}
            if any(w in q for w in ["add user", "create user", "new login", "add staff login"]):
                return {"intent": "HELP", "data": ClinicalIntelligenceLayer.KNOWLEDGE_BASE["add_user"]}
            if any(w in q for w in ["ticket", "issue", "maintenance request", "breakdown"]):
                return {"intent": "HELP", "data": ClinicalIntelligenceLayer.KNOWLEDGE_BASE["issue_tickets"]}
            if any(w in q for w in ["synapse", "war room", "org chart", "directive", "neural tree"]):
                return {"intent": "HELP", "data": ClinicalIntelligenceLayer.KNOWLEDGE_BASE["synapse_war_room"]}
            if any(w in q for w in ["price", "rate", "service rate", "sop", "policy"]):
                return {"intent": "HELP", "data": ClinicalIntelligenceLayer.KNOWLEDGE_BASE["policy_pricing"]}
            if any(w in q for w in ["patient portal", "guest portal", "meal order", "diet"]):
                return {"intent": "HELP", "data": ClinicalIntelligenceLayer.KNOWLEDGE_BASE["patient_portal"]}
            if any(w in q for w in ["nrs", "nursing code", "nurse department"]):
                return {"intent": "HELP", "data": ClinicalIntelligenceLayer.KNOWLEDGE_BASE["nrs_definition"]}
            if any(w in q for w in ["infra", "server", "infrastructure", "pm2"]):
                return {"intent": "HELP", "data": ClinicalIntelligenceLayer.KNOWLEDGE_BASE["infra_dashboard"]}

        # ============================================================
        # B: ANALYTICS QUERIES (Layer 1 -- 0 tokens via sensor pillars)
        # ============================================================

        # On-duty staff queries -- MUST go to ANALYTICS_STAFF not HELP
        if any(w in q for w in ["on duty", "who is working", "staff on duty", "doctors on duty",
                                  "nurses on duty", "which staff", "staff list", "duty roster"]):
            return {"intent": "ANALYTICS_STAFF", "tool": "get_human_capital_report"}

        # Bed occupancy / census
        if any(w in q for w in ["bed occupancy", "how many beds", "bor", "occupied beds",
                                  "beds available", "bed status", "bed census", "patient census"]):
            return {"intent": "ANALYTICS_BED_CENSUS", "tool": "get_bed_census"}

        # Clinical KPIs
        if any(w in q for w in ["alos", "average length", "cppd", "revpab", "kpi", "clinical metrics"]):
            return {"intent": "ANALYTICS_CLINICAL_KPIS", "tool": "get_clinical_kpis"}

        # Revenue
        if any(w in q for w in ["revenue today", "today revenue", "revenue pulse", "daily revenue",
                                  "how much did we earn", "income today"]):
            return {"intent": "ANALYTICS_FINANCE", "tool": "get_revenue_pulse"}

        # Pharmacy / stock alerts
        if any(w in q for w in ["below par", "par level", "drug alert", "stock alert",
                                  "pharmacy alert", "out of stock", "reorder"]):
            return {"intent": "ANALYTICS_PHARMACY", "tool": "get_pharmacy_alerts"}

        # Outstanding bills
        if any(w in q for w in ["outstanding bill", "unpaid bill", "patient owes", "overdue payment",
                                  "ar aging", "accounts receivable", "total outstanding"]):
            return {"intent": "ANALYTICS_BILLS", "tool": "get_outstanding_bills"}

        # CRITICAL tickets
        if any(w in q for w in ["critical ticket", "escalated ticket", "urgent ticket",
                                  "patient safety", "open critical"]):
            return {"intent": "ANALYTICS_TICKETS", "tool": "get_ticket_escalations"}

        # Full status report
        if any(w in q for w in ["status report", "morning report", "clinical report",
                                  "give me a report", "full report", "dashboard summary"]):
            return {"intent": "ANALYTICS_CORE", "tool": "get_full_clinical_command"}

        # General finance / ops
        if any(w in q for w in ["revenue", "profit", "financial", "p&l", "accounts"]):
            return {"intent": "ANALYTICS_FINANCE", "tool": "get_financial_vault"}
        if any(w in q for w in ["occupancy", "room status", "beds", "patient count"]):
            return {"intent": "ANALYTICS_OPS", "tool": "get_operational_grid"}
        if any(w in q for w in ["staff", "employee", "payroll", "hr", "headcount"]):
            return {"intent": "ANALYTICS_STAFF", "tool": "get_human_capital_report"}
        if any(w in q for w in ["patient", "crm", "loyalty", "ltv", "vip"]):
            return {"intent": "ANALYTICS_GUEST", "tool": "get_guest_intelligence"}
        if any(w in q for w in ["server", "cpu", "memory", "pm2", "infra", "system health"]):
            return {"intent": "ANALYTICS_SRE", "tool": "get_system_health"}
        if any(w in q for w in ["inventory", "stock", "supply", "drug"]):
            return {"intent": "ANALYTICS_INV", "tool": "get_inventory_health"}

        # Not locally classifiable -- send to Layer 3 (LLM)
        return {"intent": "SYNTHESIS", "tool": None}
