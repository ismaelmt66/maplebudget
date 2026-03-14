from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional, List

from db import get_db
import models
import schemas
from auth import get_current_user

router = APIRouter()


@router.get("/dashboard", response_model=schemas.DashboardOut)
def dashboard(
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    q = (
        db.query(
            models.Category.id.label("category_id"),
            models.Category.name.label("name"),
            models.Category.type.label("type"),
            models.Category.budget_limit.label("budget_limit"),
            func.coalesce(func.sum(models.Transaction.amount), 0).label("total"),
            func.count(models.Transaction.id).label("count"),
        )
        .join(models.Transaction, models.Transaction.category_id == models.Category.id)
        .filter(models.Transaction.user_id == current.id)
        .group_by(models.Category.id, models.Category.name, models.Category.type, models.Category.budget_limit)
    )
    if from_date:
        q = q.filter(models.Transaction.date >= from_date)
    if to_date:
        q = q.filter(models.Transaction.date <= to_date)
    rows = q.all()
    by_category = [
        schemas.CategoryTotal(
            category_id=r.category_id, name=r.name, type=r.type,
            budget_limit=float(r.budget_limit) if r.budget_limit is not None else None,
            total=float(r.total), count=int(r.count),
        )
        for r in rows
    ]
    income_total = sum(x.total for x in by_category if x.type == "income")
    expense_total = sum(x.total for x in by_category if x.type == "expense")
    net = income_total - expense_total
    tx_count = (
        db.query(func.count(models.Transaction.id))
        .filter(models.Transaction.user_id == current.id)
        .scalar() or 0
    )
    return schemas.DashboardOut(
        income_total=income_total, expense_total=expense_total,
        net=net, tx_count=int(tx_count), by_category=by_category,
    )


@router.get("/dashboard/ai-forecast")
def dashboard_ai_forecast(
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    from services.ai_engine import FinancialAIEngine
    engine = FinancialAIEngine(db=db, user_id=current.id)
    return engine.predict_cashflow()


@router.get("/search", response_model=schemas.SearchResults)
def global_search(
    q: str,
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    if not q or len(q.strip()) < 2:
        return schemas.SearchResults(transactions=[], categories=[], goals=[])
    term = f"%{q.strip().lower()}%"
    tx_results = (
        db.query(models.Transaction, models.Category)
        .join(models.Category, models.Transaction.category_id == models.Category.id)
        .filter(
            models.Transaction.user_id == current.id,
            (func.lower(models.Transaction.note).like(term) |
             func.lower(models.Category.name).like(term))
        )
        .order_by(models.Transaction.date.desc())
        .limit(10)
        .all()
    )
    transactions = [
        {"id": t.id, "date": t.date, "amount": float(t.amount), "note": t.note,
         "category_name": c.name, "category_type": c.type}
        for t, c in tx_results
    ]
    cat_results = (
        db.query(models.Category)
        .filter(models.Category.user_id == current.id, func.lower(models.Category.name).like(term))
        .limit(5).all()
    )
    categories = [{"id": c.id, "name": c.name, "type": c.type} for c in cat_results]
    goal_results = (
        db.query(models.Goal)
        .filter(models.Goal.user_id == current.id, func.lower(models.Goal.title).like(term))
        .limit(5).all()
    )
    goals = [
        {"id": g.id, "title": g.title, "target_amount": float(g.target_amount),
         "current_amount": float(g.current_amount)}
        for g in goal_results
    ]
    return schemas.SearchResults(transactions=transactions, categories=categories, goals=goals)
