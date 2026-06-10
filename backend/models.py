from sqlalchemy import Column, Integer, String, Date, Numeric, Text, Boolean
from database import Base

class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    type = Column(String(10), index=True) # 'income' or 'expense'
    amount = Column(Numeric(10, 2), nullable=False)
    category = Column(String(50), index=True, nullable=False)
    description = Column(Text, nullable=True)
    date = Column(Date, index=True, nullable=False)
    status = Column(String(10), default='pending', index=True) # 'pending' or 'done'
    tags = Column(String(200), nullable=True) # comma-separated tags
    currency = Column(String(10), default='BDT')
    receipt_url = Column(Text, nullable=True)
    is_deleted = Column(Boolean, default=False, index=True)

class Budget(Base):
    __tablename__ = "budgets"
    id = Column(Integer, primary_key=True, index=True)
    month = Column(Integer, nullable=False)
    year = Column(Integer, nullable=False)
    amount = Column(Numeric(10, 2), nullable=False)

class CategoryBudget(Base):
    __tablename__ = "category_budgets"
    id = Column(Integer, primary_key=True, index=True)
    category = Column(String(50), nullable=False)
    month = Column(Integer, nullable=False)
    year = Column(Integer, nullable=False)
    amount = Column(Numeric(10, 2), nullable=False)

class RecurringTransaction(Base):
    __tablename__ = "recurring_transactions"
    id = Column(Integer, primary_key=True, index=True)
    type = Column(String(10), index=True) # 'income' or 'expense'
    amount = Column(Numeric(10, 2), nullable=False)
    category = Column(String(50), nullable=False)
    description = Column(Text, nullable=True)
    frequency = Column(String(20), nullable=False) # 'daily', 'weekly', 'monthly', 'yearly'
    next_date = Column(Date, nullable=False)

class SavingsGoal(Base):
    __tablename__ = "savings_goals"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    target_amount = Column(Numeric(12, 2), nullable=False)
    current_amount = Column(Numeric(12, 2), default=0)
    deadline = Column(Date, nullable=True)
    color = Column(String(20), default='#6366F1')
    notes = Column(Text, nullable=True)

class Debt(Base):
    __tablename__ = "debts"
    id = Column(Integer, primary_key=True, index=True)
    person = Column(String(100), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    type = Column(String(20), nullable=False) # 'lent' or 'borrowed'
    description = Column(Text, nullable=True)

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(200), unique=True, index=True, nullable=False)
    hashed_password = Column(Text, nullable=False)
