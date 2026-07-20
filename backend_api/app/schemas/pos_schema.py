# backend_api/app/schemas/pos_schema.py
import uuid
from pydantic import BaseModel, Field, ConfigDict, model_validator
from typing import List, Optional
from datetime import datetime, timezone

# ==========================================
# 1. BILL OF MATERIALS (BOM) SCHEMA
# ==========================================
class BOMItemSchema(BaseModel):
    """Represents a raw ingredient to be deducted from inventory (Zone 12)."""
    rawId: str = Field(..., alias="rawId")
    name: str
    qty: float = Field(..., gt=0)
    unit: str
    unitCost: float = Field(..., ge=0)

    model_config = ConfigDict(populate_by_name=True)

# ==========================================
# 2. CART ITEM SCHEMA (INVENTORY SYNCED)
# ==========================================
class CartItemSchema(BaseModel):
    """Represents a single product or service in the cart."""
    id: str
    name: str
    type: str = Field(default="PRODUCT") # RAW, PRODUCT, SERVICE
    qty: float = Field(..., gt=0) 
    isFOC: bool = Field(default=False, alias="isFOC") 
    rp: float = Field(..., ge=0)   # Unit Retail Price
    cogs: float = Field(..., ge=0) # Unit Cost of Goods Sold
    bom: List[BOMItemSchema] = []

    model_config = ConfigDict(populate_by_name=True)

# ==========================================
# 3. FINANCIALS SCHEMA (ACCOUNTING SYNCED)
# ==========================================
class FinancialsSchema(BaseModel):
    """Sovereign financial snapshot for Zone 18 Ledger sync."""
    subtotal: float = Field(..., ge=0)
    totalCOGS: float = Field(..., ge=0, alias="totalCOGS")
    discount: float = Field(default=0.0, ge=0)
    vat: float = Field(..., ge=0)
    sc: float = Field(..., ge=0)  # Service Charge
    grand: float = Field(..., ge=0)
    trueProfit: float = Field(..., alias="trueProfit")

    model_config = ConfigDict(populate_by_name=True)

# ==========================================
# 4. MASTER CHECKOUT PAYLOAD (THE SOVEREIGN CONTRACT)
# ==========================================
class POSCheckoutPayload(BaseModel):
    """The absolute contract between Cashier Terminal and Kernel."""
    
    # 🛡️ MASTER FIX: UUID suffix prevents ID collisions across multiple terminals
    transaction_id: str = Field(default_factory=lambda: f"TXN-{int(datetime.now().timestamp())}-{uuid.uuid4().hex[:4].upper()}")
    
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    cashier_pin: str = Field(..., min_length=4)
    terminal_id: str
    
    guest_type: str = Field(..., pattern="^(WALK_IN|HOTEL_GUEST|VIP_MEMBER|GUEST_APP)$")
    guest_ref: Optional[str] = Field(default="N/A")
    payment_method: str = Field(..., pattern="^(CASH|CREDIT_CARD|ROOM_CHARGE|COIN)$")
    
    financials: FinancialsSchema
    items: List[CartItemSchema]

    # 🛡️ CDO MASTER VALIDATOR: Mathematical Integrity Check
    @model_validator(mode='after')
    def validate_sovereign_logic(self):
        """
        THUMB RULE 1 & 5: Ensures physical and financial truth.
        1. Prevents Room Charge without valid ID.
        2. Validates that 'Grand Total' is not manipulated by frontend.
        """
        # A. Room Security
        if (self.guest_type == 'HOTEL_GUEST' or self.payment_method == 'ROOM_CHARGE'):
            if not self.guest_ref or self.guest_ref.strip() in ["", "N/A", "UNKNOWN"]:
                raise ValueError("Room Number (guest_ref) is mandatory for Room Charges.")

        # B. Financial Math Lock (Margin of error: 0.01 for float precision)
        calculated_subtotal = sum(item.rp * item.qty for item in self.items if not item.isFOC)
        if abs(calculated_subtotal - self.financials.subtotal) > 0.01:
            raise ValueError("Financial Discrepancy: Subtotal mismatch detected.")

        return self

    model_config = ConfigDict(
        populate_by_name=True,
        json_schema_extra={
            "example": {
                "cashier_pin": "8890",
                "terminal_id": "RS-RESTAURANT",
                "guest_type": "HOTEL_GUEST",
                "guest_ref": "402",
                "payment_method": "ROOM_CHARGE",
                "financials": {
                    "subtotal": 1200.0,
                    "totalCOGS": 400.0,
                    "discount": 0,
                    "vat": 180.0,
                    "sc": 120.0,
                    "grand": 1500.0,
                    "trueProfit": 800.0
                },
                "items": [
                    {
                        "id": "SPA-OIL-01",
                        "name": "Luxury Massage Oil",
                        "type": "PRODUCT",
                        "qty": 1,
                        "rp": 1200.0,
                        "cogs": 400.0,
                        "bom": []
                    }
                ]
            }
        }
    )