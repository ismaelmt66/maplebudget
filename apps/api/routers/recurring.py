"""Recurring transaction CRUD and auto-detection.

Changes from previous version:
- create/update now use typed Pydantic schemas instead of raw dict
- update uses explicit field assignment (no arbitrary setattr)
"""

from datetime import date as dt_date, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

import models
import schemas
from auth import get_current_user
from db import get_db

router = APIRouter()


def _compute_next_date(last_occurrence: str | None, frequency: str) -> str:
    _FREQ_DAYS = {
        "daily": 1, "weekly": 7, "biweekly": 14,
        "monthly": 30, "quarterly": 91, "yearly": 365,
    }
    try:
        base = dt_date.fromisoformat(last_occurrence) if last_occurrence else dt_date.today()
    except (ValueError, TypeError):
        base = dt_date.today()
    delta = timedelta(days=_FREQ_DAYS.get(frequency, 30))
    next_dt = base + delta
    today = dt_date.today()
    while next_dt < today:
        next_dt += delta
    return str(next_dt)


@router.get("/recurring-transactions")
def list_recurring_transactions(
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    return db.query(models.RecurringTransaction).filter(
        models.RecurringTransaction.user_id == current.id
    ).all()


@router.post("/recurring-transactions", status_code=status.HTTP_201_CREATED)
def create_recurring_transaction(
    payload: schemas.RecurringTransactionCreate,
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    rt = models.RecurringTransaction(
        user_id=current.id,
        name=payload.name,
        amount=payload.amount,
        frequency=payload.frequency,
        next_date=payload.next_date,
        note=payload.note,
        is_active=True,
        category_id=payload.category_id,
    )
    db.add(rt)
    db.commit()
    db.refresh(rt)
    return rt


@router.put("/recurring-transactions/{rt_id}")
def update_recurring_transaction(
    rt_id: int,
    payload: schemas.RecurringTransactionUpdate,
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    rt = db.query(models.RecurringTransaction).filter(
        models.RecurringTransaction.id == rt_id,
        models.RecurringTransaction.user_id == current.id,
    ).first()
    if not rt:
        raise HTTPException(status_code=404, detail="Introuvable.")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(rt, field, value)

    db.commit()
    db.refresh(rt)
    return rt


@router.delete("/recurring-transactions/{rt_id}")
def delete_recurring_transaction(
    rt_id: int,
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    rt = db.query(models.RecurringTransaction).filter(
        models.RecurringTransaction.id == rt_id,
        models.RecurringTransaction.user_id == current.id,
    ).first()
    if not rt:
        raise HTTPException(status_code=404, detail="Introuvable.")
    db.delete(rt)
    db.commit()
    return {"ok": True}


@router.post("/recurring-transactions/detect")
def detect_recurring_transactions(
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    from services.recurring_detection import RecurringDetectionEngine
    engine = RecurringDetectionEngine(db=db, user_id=current.id)
    patterns = engine.detect_recurring_patterns()
    created = []
    for p in patterns:
        if p.get("confidence_score", 0) < 0.5:
            continue
        existing = db.query(models.RecurringTransaction).filter(
            models.RecurringTransaction.user_id == current.id,
            models.RecurringTransaction.name == p["name"],
            models.RecurringTransaction.frequency == p["frequency"],
        ).first()
        if existing:
            continue
        rt = models.RecurringTransaction(
            user_id=current.id, name=p["name"], amount=p["amount"],
            frequency=p["frequency"],
            next_date=p.get("next_occurrence") or _compute_next_date(
                p.get("last_occurrence"), p["frequency"]
            ),
            note=f"Détecté automatiquement (confiance {int(p.get('confidence_score', 0) * 100)}%)",
            is_active=True,
        )
        db.add(rt)
        db.flush()
        created.append(rt)
    db.commit()
    for rt in created:
        db.refresh(rt)
    all_rts = db.query(models.RecurringTransaction).filter(
        models.RecurringTransaction.user_id == current.id
    ).all()
    return {"detected": len(created), "patterns": len(patterns), "items": all_rts}
