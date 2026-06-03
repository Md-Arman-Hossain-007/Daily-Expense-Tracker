from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import extract, func
from typing import List
from decimal import Decimal
import models
import schemas
from database import engine, get_db

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Daily Budget Tracker API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3010"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/transactions/", response_model=schemas.Transaction)
def create_transaction(transaction: schemas.TransactionCreate, db: Session = Depends(get_db)):
    data = transaction.model_dump()
    # Income is always 'done'; expense defaults to 'pending'
    if data.get('status') is None:
        data['status'] = 'done' if data['type'] == 'income' else 'pending'
    db_transaction = models.Transaction(**data)
    db.add(db_transaction)
    db.commit()
    db.refresh(db_transaction)
    return db_transaction

@app.get("/transactions/", response_model=List[schemas.Transaction])
def read_transactions(
    skip: int = 0, limit: int = 100,
    month: int = Query(None, description="Month (1-12)"),
    year: int = Query(None, description="Year (e.g., 2024)"),
    db: Session = Depends(get_db)
):
    query = db.query(models.Transaction).filter(models.Transaction.is_deleted == False)
    if month and year:
        query = query.filter(extract('month', models.Transaction.date) == month,
                             extract('year', models.Transaction.date) == year)
    transactions = query.order_by(models.Transaction.date.desc()).offset(skip).limit(limit).all()
    return transactions
@app.delete("/transactions/{transaction_id}")
def delete_transaction(transaction_id: int, db: Session = Depends(get_db)):
    db_transaction = db.query(models.Transaction).filter(models.Transaction.id == transaction_id).first()
    if db_transaction is None:
        raise HTTPException(status_code=404, detail="Transaction not found")
    db_transaction.is_deleted = True
    db.commit()
    return {"ok": True}

@app.post("/transactions/{transaction_id}/undo")
def undo_delete_transaction(transaction_id: int, db: Session = Depends(get_db)):
    db_transaction = db.query(models.Transaction).filter(models.Transaction.id == transaction_id).first()
    if db_transaction is None:
        raise HTTPException(status_code=404, detail="Transaction not found")
    db_transaction.is_deleted = False
    db.commit()
    return {"ok": True}

@app.put("/transactions/{transaction_id}", response_model=schemas.Transaction)
def update_transaction(transaction_id: int, transaction: schemas.TransactionCreate, db: Session = Depends(get_db)):
    db_transaction = db.query(models.Transaction).filter(models.Transaction.id == transaction_id).first()
    if db_transaction is None:
        raise HTTPException(status_code=404, detail="Transaction not found")
    for key, value in transaction.model_dump().items():
        if value is not None:
            setattr(db_transaction, key, value)
    db.commit()
    db.refresh(db_transaction)
    return db_transaction

@app.patch("/transactions/{transaction_id}/status", response_model=schemas.Transaction)
def update_transaction_status(transaction_id: int, status_update: schemas.StatusUpdate, db: Session = Depends(get_db)):
    db_transaction = db.query(models.Transaction).filter(models.Transaction.id == transaction_id).first()
    if db_transaction is None:
        raise HTTPException(status_code=404, detail="Transaction not found")
    db_transaction.status = status_update.status
    db.commit()
    db.refresh(db_transaction)
    return db_transaction

@app.get("/summary/", response_model=schemas.MonthlySummary)
def get_monthly_summary(
    month: int = Query(..., description="Month (1-12)"),
    year: int = Query(..., description="Year (e.g., 2024)"),
    db: Session = Depends(get_db)
):
    # Income always counts (income is always 'done')
    income = db.query(func.sum(models.Transaction.amount)).filter(
        models.Transaction.type == 'income',
        models.Transaction.is_deleted == False,
        extract('month', models.Transaction.date) == month,
        extract('year', models.Transaction.date) == year
    ).scalar() or Decimal('0.00')

    # Only count expenses that are marked as 'done'
    expense = db.query(func.sum(models.Transaction.amount)).filter(
        models.Transaction.type == 'expense',
        models.Transaction.status == 'done',
        models.Transaction.is_deleted == False,
        extract('month', models.Transaction.date) == month,
        extract('year', models.Transaction.date) == year
    ).scalar() or Decimal('0.00')

    balance = income - expense

    return schemas.MonthlySummary(
        total_income=income,
        total_expense=expense,
        balance=balance
    )

# --- Budget Endpoints ---
@app.get("/budgets/", response_model=schemas.Budget)
def get_budget(month: int = Query(...), year: int = Query(...), db: Session = Depends(get_db)):
    budget = db.query(models.Budget).filter(models.Budget.month == month, models.Budget.year == year).first()
    if not budget:
        # Return a zero budget if none exists
        return schemas.Budget(id=0, month=month, year=year, amount=Decimal('0.00'))
    return budget

@app.post("/budgets/", response_model=schemas.Budget)
def set_budget(budget: schemas.BudgetCreate, db: Session = Depends(get_db)):
    db_budget = db.query(models.Budget).filter(models.Budget.month == budget.month, models.Budget.year == budget.year).first()
    if db_budget:
        db_budget.amount = budget.amount
    else:
        db_budget = models.Budget(**budget.model_dump())
        db.add(db_budget)
    db.commit()
    db.refresh(db_budget)
    return db_budget

# --- Category Budget Endpoints ---
@app.get("/category-budgets/", response_model=List[schemas.CategoryBudget])
def get_category_budgets(month: int = Query(...), year: int = Query(...), db: Session = Depends(get_db)):
    return db.query(models.CategoryBudget).filter(models.CategoryBudget.month == month, models.CategoryBudget.year == year).all()

@app.post("/category-budgets/", response_model=schemas.CategoryBudget)
def set_category_budget(budget: schemas.CategoryBudgetCreate, db: Session = Depends(get_db)):
    db_budget = db.query(models.CategoryBudget).filter(
        models.CategoryBudget.category == budget.category,
        models.CategoryBudget.month == budget.month,
        models.CategoryBudget.year == budget.year
    ).first()
    if db_budget:
        db_budget.amount = budget.amount
    else:
        db_budget = models.CategoryBudget(**budget.model_dump())
        db.add(db_budget)
    db.commit()
    db.refresh(db_budget)
    return db_budget

# --- Recurring Transactions Endpoints ---
@app.get("/recurring/", response_model=List[schemas.RecurringTransaction])
def get_recurring_transactions(db: Session = Depends(get_db)):
    return db.query(models.RecurringTransaction).all()

@app.post("/recurring/", response_model=schemas.RecurringTransaction)
def create_recurring_transaction(tx: schemas.RecurringTransactionCreate, db: Session = Depends(get_db)):
    db_tx = models.RecurringTransaction(**tx.model_dump())
    db.add(db_tx)
    db.commit()
    db.refresh(db_tx)
    return db_tx

@app.delete("/recurring/{tx_id}")
def delete_recurring_transaction(tx_id: int, db: Session = Depends(get_db)):
    db_tx = db.query(models.RecurringTransaction).filter(models.RecurringTransaction.id == tx_id).first()
    if not db_tx:
        raise HTTPException(status_code=404, detail="Recurring transaction not found")
    db.delete(db_tx)
    db.commit()
    return {"ok": True}

from datetime import date, timedelta
from dateutil.relativedelta import relativedelta

@app.post("/recurring/apply")
def apply_recurring_transactions(db: Session = Depends(get_db)):
    """Check for recurring transactions whose next_date is today or in the past, and create transactions for them."""
    today = date.today()
    recurring_txs = db.query(models.RecurringTransaction).filter(models.RecurringTransaction.next_date <= today).all()
    count = 0
    for rtx in recurring_txs:
        # Create a new transaction
        new_tx = models.Transaction(
            type=rtx.type,
            amount=rtx.amount,
            category=rtx.category,
            description=f"{rtx.description} (Auto-generated)" if rtx.description else "Auto-generated recurring transaction",
            date=rtx.next_date,
            status='done' if rtx.type == 'income' else 'pending'
        )
        db.add(new_tx)
        
        # Calculate next date
        if rtx.frequency == 'daily':
            rtx.next_date += timedelta(days=1)
        elif rtx.frequency == 'weekly':
            rtx.next_date += timedelta(weeks=1)
        elif rtx.frequency == 'monthly':
            rtx.next_date += relativedelta(months=1)
        elif rtx.frequency == 'yearly':
            rtx.next_date += relativedelta(years=1)
            
        count += 1
        
    db.commit()
    return {"message": f"Applied {count} recurring transactions"}

# --- Analytics & Insights Endpoints ---
from fastapi.responses import StreamingResponse
import csv
import io

@app.get("/analytics/trends")
def get_spending_trends(db: Session = Depends(get_db)):
    """Returns income and expense totals for the last 6 months."""
    today = date.today()
    trends = []
    
    for i in range(5, -1, -1):
        target_date = today - relativedelta(months=i)
        month = target_date.month
        year = target_date.year
        month_name = target_date.strftime("%b")
        
        income = db.query(func.sum(models.Transaction.amount)).filter(
            models.Transaction.type == 'income',
            models.Transaction.is_deleted == False,
            extract('month', models.Transaction.date) == month,
            extract('year', models.Transaction.date) == year
        ).scalar() or Decimal('0.00')

        expense = db.query(func.sum(models.Transaction.amount)).filter(
            models.Transaction.type == 'expense',
            models.Transaction.status == 'done',
            models.Transaction.is_deleted == False,
            extract('month', models.Transaction.date) == month,
            extract('year', models.Transaction.date) == year
        ).scalar() or Decimal('0.00')
        
        trends.append({
            "name": f"{month_name} {year}",
            "income": float(income),
            "expense": float(expense)
        })
        
    return trends

@app.get("/export/csv")
def export_transactions_csv(db: Session = Depends(get_db)):
    """Exports all transactions as a CSV file."""
    transactions = db.query(models.Transaction).filter(models.Transaction.is_deleted == False).order_by(models.Transaction.date.desc()).all()
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "Date", "Type", "Category", "Amount", "Status", "Description"])
    
    for tx in transactions:
        writer.writerow([
            tx.id,
            tx.date,
            tx.type,
            tx.category,
            tx.amount,
            tx.status,
            tx.description or ""
        ])
    
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=budget_tracker_export.csv"}
    )

import json
from pydantic import BaseModel
from typing import Any, Dict

class BackupData(BaseModel):
    transactions: List[Dict[str, Any]]
    budgets: List[Dict[str, Any]]
    category_budgets: List[Dict[str, Any]]
    recurring_transactions: List[Dict[str, Any]]

@app.get("/backup/")
def export_backup(db: Session = Depends(get_db)):
    transactions = [schemas.Transaction.model_validate(t).model_dump() for t in db.query(models.Transaction).filter(models.Transaction.is_deleted == False).all()]
    budgets = [schemas.Budget.model_validate(b).model_dump() for b in db.query(models.Budget).all()]
    cat_budgets = [schemas.CategoryBudget.model_validate(c).model_dump() for c in db.query(models.CategoryBudget).all()]
    recurring = [schemas.RecurringTransaction.model_validate(r).model_dump() for r in db.query(models.RecurringTransaction).all()]
    
    # We must convert dates and decimals to strings/floats for JSON serialization
    # Let FastAPI handle the Pydantic dicts automatically by returning a Dict
    return {
        "transactions": transactions,
        "budgets": budgets,
        "category_budgets": cat_budgets,
        "recurring_transactions": recurring
    }

@app.post("/restore/")
def restore_backup(data: BackupData, db: Session = Depends(get_db)):
    # Clear existing
    db.query(models.Transaction).delete()
    db.query(models.Budget).delete()
    db.query(models.CategoryBudget).delete()
    db.query(models.RecurringTransaction).delete()
    
    # Insert new
    for tx in data.transactions:
        # Avoid passing 'id' to let DB auto-increment, unless we explicitly want to keep IDs
        tx.pop('id', None)
        db.add(models.Transaction(**tx))
        
    for b in data.budgets:
        b.pop('id', None)
        db.add(models.Budget(**b))
        
    for cb in data.category_budgets:
        cb.pop('id', None)
        db.add(models.CategoryBudget(**cb))
        
    for r in data.recurring_transactions:
        r.pop('id', None)
        db.add(models.RecurringTransaction(**r))
        
    db.commit()
    return {"message": "Backup restored successfully"}
