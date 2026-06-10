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
    status: str = Field(default='pending', pattern="^(pending|done)$")
    tags: Optional[str] = None
    currency: str = "BDT"
    receipt_url: Optional[str] = None

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

# --- Savings Goals ---
class SavingsGoalCreate(BaseModel):
    name: str
    target_amount: Decimal = Field(..., gt=0)
    current_amount: Optional[Decimal] = Decimal('0.00')
    deadline: Optional[date] = None
    color: Optional[str] = '#6366F1'
    notes: Optional[str] = None

class SavingsGoalContribute(BaseModel):
    amount: Decimal = Field(..., gt=0)

class SavingsGoal(BaseModel):
    id: int
    name: str
    target_amount: Decimal
    current_amount: Decimal
    deadline: Optional[date] = None
    color: str
    notes: Optional[str] = None

    class Config:
        from_attributes = True

# --- Debts ---
class DebtBase(BaseModel):
    person: str
    amount: Decimal = Field(..., gt=0)
    type: str = Field(..., pattern="^(lent|borrowed)$")
    description: Optional[str] = None

class DebtCreate(DebtBase):
    pass

class Debt(DebtBase):
    id: int
    class Config:
        from_attributes = True

# --- Auth ---
from pydantic import EmailStr

class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    email: str
