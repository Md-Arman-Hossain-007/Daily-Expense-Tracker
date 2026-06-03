from sqlalchemy import Column, Integer, String, Date, Numeric, Text
from database import Base

class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    type = Column(String(10), index=True) # 'income' or 'expense'
    amount = Column(Numeric(10, 2), nullable=False)
    category = Column(String(50), index=True, nullable=False)
    description = Column(Text, nullable=True)
    date = Column(Date, index=True, nullable=False)
