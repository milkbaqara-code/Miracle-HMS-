# api/schemas.py
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

# --- STAFF SCHEMAS ---
class StaffBase(BaseModel):
    name: str
    position: str
    role: str

class StaffResponse(StaffBase):
    id: str
    photo_path: Optional[str] = "NONE"

    class Config:
        from_attributes = True 

# --- CATALOG SCHEMAS (Ecommerce POS & Guest Cloud) ---
class CatalogItemBase(BaseModel):
    item_name: str
    description: Optional[str] = None
    price: float = Field(ge=0.0, description="Retail price cannot be negative")
    vector_code: str
    is_service: bool = True
    image_url: Optional[str] = "NONE"

class CatalogItemResponse(CatalogItemBase):
    product_id: str
    allowance_category: str
    is_pos_visible: bool
    is_active: bool

    class Config:
        from_attributes = True

# --- INVENTORY SCHEMAS ---
class InventoryResponse(BaseModel):
    product_id: str
    item: str
    vector_code: str
    stock: float
    purchase_price: float
    unit: str
    last_restock: Optional[str]

    class Config:
        from_attributes = True