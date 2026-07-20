# backend_api/app/schemas/schemas.py
from pydantic import BaseModel
from typing import List, Optional, Dict
from datetime import datetime

class AccountBase(BaseModel):
    code: int
    name: str
    type: str

    class Config:
        from_attributes = True

class TrialBalanceAccount(AccountBase):
    debit: float
    credit: float
    balance: float

class TrialBalanceResponse(BaseModel):
    status: str
    total_variance: float
    accounts: List[TrialBalanceAccount]

class LedgerLineItem(BaseModel):
    id: int
    ref: str
    type: str # DEBIT / CREDIT
    category: str
    amount: float
    description: str
    timestamp: datetime
    operator: str

class LiveLedgerResponse(BaseModel):
    status: str
    data: List[LedgerLineItem]
    metrics: Dict[str, float]

class BalanceSheetItem(BaseModel):
    name: str
    balance: float

class BalanceSheetResponse(BaseModel):
    status: str
    data: Dict[str, List[BalanceSheetItem]]
    totals: Dict[str, float]
    is_balanced: bool

class PnLDetail(BaseModel):
    name: str
    type: str
    amount: float

class PnLResponse(BaseModel):
    total_revenue: float
    total_expense: float
    net_profit: float
    details: List[PnLDetail]
