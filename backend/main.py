from fastapi import FastAPI, Depends, HTTPException, Query, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy import extract, func
from typing import List
from decimal import Decimal
import models, schemas, os, shutil, uuid
from database import engine, get_db
from auth import verify_password, hash_password, create_access_token, decode_token, ACCESS_TOKEN_EXPIRE_MINUTES
from datetime import timedelta

models.Base.metadata.create_all(bind=engine)

UPLOADS_DIR = "uploads"
os.makedirs(UPLOADS_DIR, exist_ok=True)

app = FastAPI(title="Daily Budget Tracker API")
app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")


app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3010"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/upload/")
async def upload_receipt(file: UploadFile = File(...)):
    ext = os.path.splitext(file.filename or "file")[1]
    filename = f"{uuid.uuid4().hex}{ext}"
    path = os.path.join(UPLOADS_DIR, filename)
    with open(path, "wb") as f:
        shutil.copyfileobj(file.file, f)
    return {"url": f"/uploads/{filename}"}

@app.post("/auth/register", response_model=schemas.TokenResponse)
def register(user_data: schemas.UserRegister, db: Session = Depends(get_db)):
    existing = db.query(models.User).filter(models.User.email == user_data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_pwd = hash_password(user_data.password)
    new_user = models.User(email=user_data.email, hashed_password=hashed_pwd)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    token = create_access_token({"sub": new_user.email}, timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    return {"access_token": token, "token_type": "bearer", "email": new_user.email}

@app.post("/auth/login", response_model=schemas.TokenResponse)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token({"sub": user.email}, timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    return {"access_token": token, "token_type": "bearer", "email": user.email}

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

@app.delete("/category-budgets/{category}")
def delete_category_and_transactions(category: str, month: int = Query(...), year: int = Query(...), db: Session = Depends(get_db)):
    # Delete the category budget
    db_budget = db.query(models.CategoryBudget).filter(
        models.CategoryBudget.category == category,
        models.CategoryBudget.month == month,
        models.CategoryBudget.year == year
    ).first()
    if db_budget:
        db.delete(db_budget)

    # Soft-delete all transactions in this category for the given month and year
    transactions = db.query(models.Transaction).filter(
        models.Transaction.category == category,
        extract('month', models.Transaction.date) == month,
        extract('year', models.Transaction.date) == year
    ).all()
    for tx in transactions:
        tx.is_deleted = True

    db.commit()
    return {"ok": True}

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

@app.get("/analytics/yearly-trends")
def get_yearly_trends(year: int = Query(None, description="Year to query (e.g. 2026)"), db: Session = Depends(get_db)):
    """Returns monthly income and expense totals for the given year (or current year)."""
    target_year = year or date.today().year
    trends = []
    
    for month in range(1, 13):
        month_name = date(target_year, month, 1).strftime("%b")
        
        income = db.query(func.sum(models.Transaction.amount)).filter(
            models.Transaction.type == 'income',
            models.Transaction.is_deleted == False,
            extract('month', models.Transaction.date) == month,
            extract('year', models.Transaction.date) == target_year
        ).scalar() or Decimal('0.00')

        expense = db.query(func.sum(models.Transaction.amount)).filter(
            models.Transaction.type == 'expense',
            models.Transaction.status == 'done',
            models.Transaction.is_deleted == False,
            extract('month', models.Transaction.date) == month,
            extract('year', models.Transaction.date) == target_year
        ).scalar() or Decimal('0.00')
        
        trends.append({
            "name": month_name,
            "income": float(income),
            "expense": float(expense)
        })
        
    return trends

@app.get("/analytics/mom-comparison")
def get_mom_comparison(
    month: int = Query(None, description="Month (1-12)"),
    year: int = Query(None, description="Year (e.g., 2026)"),
    db: Session = Depends(get_db)
):
    """Compares the selected month/year with the previous month."""
    today = date.today()
    target_month = month or today.month
    target_year = year or today.year
    
    current_date = date(target_year, target_month, 1)
    prev_date = current_date - relativedelta(months=1)
    prev_month = prev_date.month
    prev_year = prev_date.year
    
    def get_month_data(m: int, y: int):
        income = db.query(func.sum(models.Transaction.amount)).filter(
            models.Transaction.type == 'income',
            models.Transaction.is_deleted == False,
            extract('month', models.Transaction.date) == m,
            extract('year', models.Transaction.date) == y
        ).scalar() or Decimal('0.00')

        expense = db.query(func.sum(models.Transaction.amount)).filter(
            models.Transaction.type == 'expense',
            models.Transaction.status == 'done',
            models.Transaction.is_deleted == False,
            extract('month', models.Transaction.date) == m,
            extract('year', models.Transaction.date) == y
        ).scalar() or Decimal('0.00')
        
        cat_expenses = db.query(
            models.Transaction.category,
            func.sum(models.Transaction.amount)
        ).filter(
            models.Transaction.type == 'expense',
            models.Transaction.status == 'done',
            models.Transaction.is_deleted == False,
            extract('month', models.Transaction.date) == m,
            extract('year', models.Transaction.date) == y
        ).group_by(models.Transaction.category).all()
        
        cats_dict = {cat: float(amt) for cat, amt in cat_expenses}
        
        return float(income), float(expense), cats_dict

    curr_inc, curr_exp, curr_cats = get_month_data(target_month, target_year)
    prev_inc, prev_exp, prev_cats = get_month_data(prev_month, prev_year)
    
    def make_comparison(curr: float, prev: float):
        diff = curr - prev
        pct = (diff / prev * 100.0) if prev > 0 else (100.0 if diff > 0 else 0.0)
        return {
            "current": curr,
            "previous": prev,
            "diff": diff,
            "percentage": round(pct, 2)
        }
        
    income_comp = make_comparison(curr_inc, prev_inc)
    expense_comp = make_comparison(curr_exp, prev_exp)
    
    all_categories = set(curr_cats.keys()).union(set(prev_cats.keys()))
    cat_comparisons = []
    
    for cat in all_categories:
        c_val = curr_cats.get(cat, 0.0)
        p_val = prev_cats.get(cat, 0.0)
        c_diff = c_val - p_val
        c_pct = (c_diff / p_val * 100.0) if p_val > 0 else (100.0 if c_diff > 0 else 0.0)
        
        cat_comparisons.append({
            "category": cat,
            "current": c_val,
            "previous": p_val,
            "diff": c_diff,
            "percentage": round(c_pct, 2)
        })
        
    cat_comparisons.sort(key=lambda x: abs(x["diff"]), reverse=True)
    
    return {
        "current_month": current_date.strftime("%B %Y"),
        "previous_month": prev_date.strftime("%B %Y"),
        "income": income_comp,
        "expense": expense_comp,
        "categories": cat_comparisons
    }

@app.post("/transactions/bulk/", response_model=List[schemas.Transaction])
def create_transactions_bulk(transactions: List[schemas.TransactionCreate], db: Session = Depends(get_db)):
    """Bulk creates multiple transactions."""
    created_txs = []
    for transaction in transactions:
        data = transaction.model_dump()
        if data.get('status') is None:
            data['status'] = 'done' if data['type'] == 'income' else 'pending'
        db_transaction = models.Transaction(**data)
        db.add(db_transaction)
        created_txs.append(db_transaction)
    db.commit()
    for db_tx in created_txs:
        db.refresh(db_tx)
    return created_txs

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

@app.get("/analytics/rollover/")
def get_category_rollovers(month: int, year: int, db: Session = Depends(get_db)):
    """Calculates rollover surplus/debt for each category from the beginning of time up to (but not including) the given month/year."""
    # Target date for the beginning of the requested month
    from datetime import date
    target_date = date(year, month, 1)
    target_month_value = year * 12 + month
    
    # 1. Sum all past budgets per category
    past_budgets = db.query(
        models.CategoryBudget.category,
        func.sum(models.CategoryBudget.amount).label("total_budget")
    ).filter(
        (models.CategoryBudget.year * 12 + models.CategoryBudget.month) < target_month_value
    ).group_by(models.CategoryBudget.category).all()
    
    budget_map = {row.category: Decimal(str(row.total_budget)) for row in past_budgets}
    
    # 2. Sum all past expenses per category
    past_expenses = db.query(
        models.Transaction.category,
        func.sum(models.Transaction.amount).label("total_expense")
    ).filter(
        models.Transaction.type == 'expense',
        models.Transaction.status == 'done',
        models.Transaction.is_deleted == False,
        models.Transaction.date < target_date
    ).group_by(models.Transaction.category).all()
    
    expense_map = {row.category: Decimal(str(row.total_expense)) for row in past_expenses}
    
    # 3. Calculate rollover = budget - expense
    rollover_map = {}
    all_categories = set(budget_map.keys()).union(set(expense_map.keys()))
    
    for cat in all_categories:
        b = budget_map.get(cat, Decimal('0.00'))
        e = expense_map.get(cat, Decimal('0.00'))
        diff = b - e
        # Only carry over if we've actually ever set a budget for it, or if they have expenses we can still show the deficit
        rollover_map[cat] = float(diff)
        
    return rollover_map

@app.get("/analytics/forecast/")
def get_cashflow_forecast(days: int = 30, db: Session = Depends(get_db)):
    """Calculates projected daily balance for the next `days` days based on recurring transactions."""
    from datetime import date, timedelta
    from dateutil.relativedelta import relativedelta
    from decimal import Decimal
    
    today = date.today()
    
    # 1. Get current balance
    income_agg = db.query(func.sum(models.Transaction.amount)).filter(models.Transaction.type == 'income', models.Transaction.status == 'done', models.Transaction.is_deleted == False).scalar() or 0
    expense_agg = db.query(func.sum(models.Transaction.amount)).filter(models.Transaction.type == 'expense', models.Transaction.status == 'done', models.Transaction.is_deleted == False).scalar() or 0
    current_balance = Decimal(str(income_agg)) - Decimal(str(expense_agg))
    
    # 2. Get recurring transactions
    recurring_txs = db.query(models.RecurringTransaction).all()
    
    # 3. Simulate forward
    forecast = []
    running_balance = current_balance
    
    # Pre-calculate a list of next dates for each recurring transaction to avoid mutating DB objects
    recurring_sim = []
    for tx in recurring_txs:
        if tx.next_date:
            recurring_sim.append({
                "type": tx.type,
                "amount": Decimal(str(tx.amount)),
                "frequency": tx.frequency,
                "next_date": tx.next_date
            })

    for i in range(days + 1):
        current_sim_date = today + timedelta(days=i)
        
        daily_income = Decimal('0.00')
        daily_expense = Decimal('0.00')
        
        for sim_tx in recurring_sim:
            if sim_tx["next_date"] == current_sim_date:
                if sim_tx["type"] == 'income':
                    daily_income += sim_tx["amount"]
                else:
                    daily_expense += sim_tx["amount"]
                
                # Advance date
                if sim_tx["frequency"] == 'daily':
                    sim_tx["next_date"] += timedelta(days=1)
                elif sim_tx["frequency"] == 'weekly':
                    sim_tx["next_date"] += timedelta(days=7)
                elif sim_tx["frequency"] == 'monthly':
                    sim_tx["next_date"] += relativedelta(months=1)
                elif sim_tx["frequency"] == 'yearly':
                    sim_tx["next_date"] += relativedelta(years=1)
        
        running_balance += (daily_income - daily_expense)
        forecast.append({
            "date": current_sim_date.isoformat(),
            "projected_balance": float(running_balance)
        })
        
    return forecast

import json
from pydantic import BaseModel

from typing import Any, Dict

class BackupData(BaseModel):
    transactions: List[Dict[str, Any]]
    budgets: List[Dict[str, Any]]
    category_budgets: List[Dict[str, Any]]
    recurring_transactions: List[Dict[str, Any]]
    savings_goals: List[Dict[str, Any]] = []
    debts: List[Dict[str, Any]] = []

@app.get("/backup/")
def export_backup(db: Session = Depends(get_db)):
    transactions = [schemas.Transaction.model_validate(t).model_dump() for t in db.query(models.Transaction).filter(models.Transaction.is_deleted == False).all()]
    budgets = [schemas.Budget.model_validate(b).model_dump() for b in db.query(models.Budget).all()]
    cat_budgets = [schemas.CategoryBudget.model_validate(c).model_dump() for c in db.query(models.CategoryBudget).all()]
    recurring = [schemas.RecurringTransaction.model_validate(r).model_dump() for r in db.query(models.RecurringTransaction).all()]
    savings = [schemas.SavingsGoal.model_validate(s).model_dump() for s in db.query(models.SavingsGoal).all()]
    debts = [schemas.Debt.model_validate(d).model_dump() for d in db.query(models.Debt).all()]
    
    # Let FastAPI handle the Pydantic dicts automatically by returning a Dict
    return {
        "transactions": transactions,
        "budgets": budgets,
        "category_budgets": cat_budgets,
        "recurring_transactions": recurring,
        "savings_goals": savings,
        "debts": debts
    }

@app.post("/restore/")
def restore_backup(data: BackupData, db: Session = Depends(get_db)):
    # Clear existing
    db.query(models.Transaction).delete()
    db.query(models.Budget).delete()
    db.query(models.CategoryBudget).delete()
    db.query(models.RecurringTransaction).delete()
    db.query(models.SavingsGoal).delete()
    db.query(models.Debt).delete()
    
    # Insert new
    for tx in data.transactions:
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

    for s in data.savings_goals:
        s.pop('id', None)
        db.add(models.SavingsGoal(**s))

    for d in data.debts:
        d.pop('id', None)
        db.add(models.Debt(**d))
        
    db.commit()
    return {"message": "Backup restored successfully"}

# --- Savings Goals Endpoints ---
@app.get("/savings-goals/", response_model=List[schemas.SavingsGoal])
def get_savings_goals(db: Session = Depends(get_db)):
    return db.query(models.SavingsGoal).all()

@app.post("/savings-goals/", response_model=schemas.SavingsGoal)
def create_savings_goal(goal: schemas.SavingsGoalCreate, db: Session = Depends(get_db)):
    db_goal = models.SavingsGoal(**goal.model_dump())
    db.add(db_goal)
    db.commit()
    db.refresh(db_goal)
    return db_goal

@app.delete("/savings-goals/{goal_id}")
def delete_savings_goal(goal_id: int, db: Session = Depends(get_db)):
    db_goal = db.query(models.SavingsGoal).filter(models.SavingsGoal.id == goal_id).first()
    if not db_goal:
        raise HTTPException(status_code=404, detail="Savings goal not found")
    db.delete(db_goal)
    db.commit()
    return {"ok": True}

@app.patch("/savings-goals/{goal_id}/contribute", response_model=schemas.SavingsGoal)
def contribute_to_goal(goal_id: int, contribution: schemas.SavingsGoalContribute, db: Session = Depends(get_db)):
    db_goal = db.query(models.SavingsGoal).filter(models.SavingsGoal.id == goal_id).first()
    if not db_goal:
        raise HTTPException(status_code=404, detail="Savings goal not found")
    db_goal.current_amount = Decimal(str(db_goal.current_amount)) + contribution.amount
    db.commit()
    db.refresh(db_goal)
    return db_goal

@app.patch("/savings-goals/{goal_id}/withdraw", response_model=schemas.SavingsGoal)
def withdraw_from_goal(goal_id: int, contribution: schemas.SavingsGoalContribute, db: Session = Depends(get_db)):
    db_goal = db.query(models.SavingsGoal).filter(models.SavingsGoal.id == goal_id).first()
    if not db_goal:
        raise HTTPException(status_code=404, detail="Savings goal not found")
    new_amt = Decimal(str(db_goal.current_amount)) - contribution.amount
    db_goal.current_amount = max(Decimal('0.00'), new_amt)
    db.commit()
    db.refresh(db_goal)
    return db_goal

# --- Debt Tracker Endpoints ---
@app.get("/debts/", response_model=List[schemas.Debt])
def get_debts(db: Session = Depends(get_db)):
    return db.query(models.Debt).all()

@app.post("/debts/", response_model=schemas.Debt)
def create_debt(debt: schemas.DebtCreate, db: Session = Depends(get_db)):
    db_debt = models.Debt(**debt.model_dump())
    db.add(db_debt)
    db.commit()
    db.refresh(db_debt)
    return db_debt

@app.delete("/debts/{debt_id}")
def delete_debt(debt_id: int, db: Session = Depends(get_db)):
    db_debt = db.query(models.Debt).filter(models.Debt.id == debt_id).first()
    if not db_debt:
        raise HTTPException(status_code=404, detail="Debt not found")
    db.delete(db_debt)
    db.commit()
    return {"ok": True}
