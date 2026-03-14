"""Transaction CRUD, export, recurring processing, and AI categorization.

Business logic for suggest-category and process-recurring has been
extracted to services/transaction_service.py.
"""

import csv
import io
from datetime import date as dt_date

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional, List

import models
import schemas
from auth import get_current_user
from cache import invalidate_ai_analysis_cache
from db import get_db
from pagination import PaginationParams, paginated_response

router = APIRouter()


@router.post("/transactions", response_model=schemas.TransactionOut, status_code=201)
def create_transaction(
    payload: schemas.TransactionCreate,
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    cat = (
        db.query(models.Category)
        .filter(models.Category.id == payload.category_id, models.Category.user_id == current.id)
        .first()
    )
    if not cat:
        raise HTTPException(status_code=400, detail="Invalid category")
    t = models.Transaction(
        amount=payload.amount, date=payload.date, note=payload.note,
        category_id=payload.category_id, user_id=current.id,
        is_recurring=payload.is_recurring, recurrence_interval=payload.recurrence_interval,
    )
    db.add(t)
    db.commit()
    db.refresh(t)
    invalidate_ai_analysis_cache(current.id)
    return t


@router.get("/transactions")
def list_transactions(
    params: PaginationParams = Depends(),
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    query = (
        db.query(models.Transaction)
        .filter(models.Transaction.user_id == current.id)
        .order_by(models.Transaction.id.desc())
    )
    return paginated_response(query, params)


@router.put("/transactions/{tx_id}", response_model=schemas.TransactionOut)
def update_transaction(
    tx_id: int,
    payload: schemas.TransactionUpdate,
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    t = db.query(models.Transaction).filter(
        models.Transaction.id == tx_id, models.Transaction.user_id == current.id
    ).first()
    if not t:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if payload.category_id is not None:
        cat = db.query(models.Category).filter(
            models.Category.id == payload.category_id, models.Category.user_id == current.id
        ).first()
        if not cat:
            raise HTTPException(status_code=400, detail="Invalid category")
        t.category_id = payload.category_id
    if payload.amount is not None:
        t.amount = payload.amount
    if payload.date is not None:
        t.date = payload.date
    if payload.note is not None:
        t.note = payload.note
    db.commit()
    db.refresh(t)
    invalidate_ai_analysis_cache(current.id)
    return t


@router.delete("/transactions/{tx_id}")
def delete_transaction(
    tx_id: int,
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    t = db.query(models.Transaction).filter(
        models.Transaction.id == tx_id, models.Transaction.user_id == current.id
    ).first()
    if not t:
        raise HTTPException(status_code=404, detail="Transaction not found")
    db.delete(t)
    db.commit()
    invalidate_ai_analysis_cache(current.id)
    return {"deleted": True, "id": tx_id}


@router.get("/transactions/export/csv")
def export_transactions_csv(
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    query = (
        db.query(models.Transaction, models.Category)
        .join(models.Category, models.Transaction.category_id == models.Category.id)
        .filter(models.Transaction.user_id == current.id)
    )
    if from_date:
        query = query.filter(models.Transaction.date >= from_date)
    if to_date:
        query = query.filter(models.Transaction.date <= to_date)
    txs = query.order_by(models.Transaction.date.desc()).all()

    output = io.StringIO()
    output.write("\ufeff")
    writer = csv.writer(output)
    writer.writerow(["Date", "Montant", "Type", "Catégorie", "Note"])
    for t, c in txs:
        writer.writerow([t.date, f"{float(t.amount):.2f}", c.type, c.name, t.note or ""])

    output.seek(0)
    filename = f"nexledger-transactions-{dt_date.today().strftime('%Y-%m-%d')}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.post("/transactions/process-recurring")
def process_recurring_transactions(
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    from services.transaction_service import process_recurring_transactions as _process
    return _process(db, current.id)


@router.post("/transactions/suggest-category", response_model=schemas.SuggestCategoryResponse)
def suggest_category(
    payload: schemas.SuggestCategoryRequest,
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    from services.transaction_service import suggest_category as _suggest
    return _suggest(db, current.id, payload.description)
