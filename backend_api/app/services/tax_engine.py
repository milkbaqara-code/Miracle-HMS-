from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from app.models.models import TaxRule, TaxRate, Account

DHAKA_TZ = timezone(timedelta(hours=6))

def calculate_transaction_taxes(
    db: Session,
    gross_amount: float,
    transaction_type: str,
    division: str
) -> Dict[str, Any]:
    """
    Sovereign Tax Rules Engine (Phase 21).
    Resolves tax rates for a transaction type + division combination.
    Falls back to standard (15% VAT + 10% SC) if no rules are configured in the database.
    """
    today = datetime.now(DHAKA_TZ).date()
    
    # Resolve active tax rules
    rules = db.query(TaxRule).join(TaxRate).filter(
        TaxRule.transaction_type == transaction_type.upper(),
        TaxRule.division == division.upper(),
        TaxRule.effective_from <= today,
        (TaxRule.effective_to == None) | (TaxRule.effective_to >= today)
    ).all()
    
    if not rules:
        # Standard Fallback: 15% VAT, 10% Service Charge
        # gross = net * 1.25
        net = round(gross_amount / 1.25, 2)
        vat = round(net * 0.15, 2)
        sc = round(net * 0.10, 2)
        
        # Adjust rounding errors
        net = round(gross_amount - vat - sc, 2)
        
        return {
            "gross": gross_amount,
            "net": net,
            "taxes": [
                {"code": 210000, "rate_code": "VAT_15", "amount": vat, "name": "VAT Payable (15%)"},
                {"code": 211000, "rate_code": "SC_10", "amount": sc, "name": "Service Charge Payable (10%)"}
            ]
        }
        
    # Calculate using configured rules
    total_rate = sum(r.tax_rate.rate for r in rules)
    net = round(gross_amount / (1.0 + total_rate), 2)
    
    taxes = []
    total_tax_calculated = 0.0
    for r in rules:
        tax_amount = round(net * r.tax_rate.rate, 2)
        total_tax_calculated += tax_amount
        taxes.append({
            "code": r.tax_rate.gl_account_code,
            "rate_code": r.tax_rate.code,
            "amount": tax_amount,
            "name": r.tax_rate.name
        })
        
    # Adjust rounding differences on net revenue
    net = round(gross_amount - total_tax_calculated, 2)
    
    return {
        "gross": gross_amount,
        "net": net,
        "taxes": taxes
    }
