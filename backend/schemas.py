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
    tags: Optional[str] = None
    status: Optional[str] = None  # 'pending' or 'done'; defaults set in API

class TransactionCreate(TransactionBase):
    pass

class Transaction(TransactionBase):
    id: int
    status: str
    is_deleted: bool

    class Config:
        from_attributes = True

class StatusUpdate(BaseModel):
    status: str = Field(..., pattern="^(pending|done)$")

class MonthlySummary(BaseModel):
    total_income: Decimal
    total_expense: Decimal
    balance: Decimal

class BudgetBase(BaseModel):
    month: int
    year: int
    amount: Decimal = Field(..., gt=0)

class BudgetCreate(BudgetBase):
    pass

class Budget(BudgetBase):
    id: int
    class Config:
        from_attributes = True

class CategoryBudgetBase(BaseModel):
    category: str
    month: int
    year: int
    amount: Decimal = Field(..., gt=0)

class CategoryBudgetCreate(CategoryBudgetBase):
    pass

class CategoryBudget(CategoryBudgetBase):
    id: int
    class Config:
        from_attributes = True

class RecurringTransactionBase(BaseModel):
    type: str = Field(..., pattern="^(income|expense)$")
    amount: Decimal = Field(..., gt=0)
    category: str
    description: Optional[str] = None
    frequency: str = Field(..., pattern="^(daily|weekly|monthly|yearly)$")
    next_date: date

class RecurringTransactionCreate(RecurringTransactionBase):
    pass

class RecurringTransaction(RecurringTransactionBase):
    id: int
    class Config:
        from_attributes = True
