from pydantic import BaseModel, Field
from datetime import date
from decimal import Decimal
from typing import Optional

class TransactionBase(BaseModel):
    type: str = Field(..., pattern="^(income|expense)$")
    amount: Decimal = Field(..., gt=0)
    category: str
    description: Optional[str] = None
    date: date

class TransactionCreate(TransactionBase):
    pass

class Transaction(TransactionBase):
    id: int

    class Config:
        from_attributes = True

class MonthlySummary(BaseModel):
    total_income: Decimal
    total_expense: Decimal
    balance: Decimal
