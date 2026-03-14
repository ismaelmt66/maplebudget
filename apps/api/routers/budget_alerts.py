from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from datetime import date as dt_date

from db import get_db
import models
import schemas
from auth import get_current_user

router = APIRouter()


@router.get("/budget-alerts/summary")
def budget_alerts_summary(
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    today = dt_date.today()
    month_prefix = f"{today.year}-{str(today.month).zfill(2)}"
    alerts = db.query(models.BudgetAlert).filter(models.BudgetAlert.user_id == current.id).all()
    over = 0
    warning = 0
    total_limit = 0.0
    total_spent = 0.0
    for a in alerts:
        spent = float(db.query(func.sum(models.Transaction.amount)).filter(
            models.Transaction.user_id == current.id,
            models.Transaction.category_id == a.category_id,
            models.Transaction.date.startswith(month_prefix),
        ).scalar() or 0)
        pct = (spent / float(a.monthly_limit) * 100) if a.monthly_limit > 0 else 0
        if pct >= 100:
            over += 1
        elif pct >= 80:
            warning += 1
        total_limit += float(a.monthly_limit)
        total_spent += spent
    return {
        "total_alerts": len(alerts), "over_budget_count": over,
        "warning_count": warning, "total_budget": total_limit, "total_spent": total_spent,
    }


@router.get("/budget-alerts", response_model=List[schemas.BudgetAlertOut])
def list_budget_alerts(
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    alerts = db.query(models.BudgetAlert).filter(models.BudgetAlert.user_id == current.id).all()
    return [
        schemas.BudgetAlertOut(
            id=a.id, category_id=a.category_id,
            category_name=a.category.name if a.category else "?",
            monthly_limit=float(a.monthly_limit), created_at=a.created_at,
        )
        for a in alerts
    ]


@router.post("/budget-alerts", response_model=schemas.BudgetAlertOut, status_code=201)
def create_budget_alert(
    payload: schemas.BudgetAlertCreate,
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    cat = (
        db.query(models.Category)
        .filter(models.Category.id == payload.category_id, models.Category.user_id == current.id)
        .first()
    )
    if not cat:
        raise HTTPException(status_code=404, detail="Catégorie non trouvée")
    existing = (
        db.query(models.BudgetAlert)
        .filter(models.BudgetAlert.user_id == current.id, models.BudgetAlert.category_id == payload.category_id)
        .first()
    )
    if existing:
        existing.monthly_limit = payload.monthly_limit
        db.commit()
        db.refresh(existing)
        return schemas.BudgetAlertOut(
            id=existing.id, category_id=existing.category_id, category_name=cat.name,
            monthly_limit=float(existing.monthly_limit), created_at=existing.created_at,
        )
    today_str = dt_date.today().strftime("%Y-%m-%d")
    alert = models.BudgetAlert(
        user_id=current.id, category_id=payload.category_id,
        monthly_limit=payload.monthly_limit, created_at=today_str,
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return schemas.BudgetAlertOut(
        id=alert.id, category_id=alert.category_id, category_name=cat.name,
        monthly_limit=float(alert.monthly_limit), created_at=alert.created_at,
    )


@router.delete("/budget-alerts/{alert_id}", status_code=204)
def delete_budget_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    alert = (
        db.query(models.BudgetAlert)
        .filter(models.BudgetAlert.id == alert_id, models.BudgetAlert.user_id == current.id)
        .first()
    )
    if not alert:
        raise HTTPException(status_code=404, detail="Alerte non trouvée")
    db.delete(alert)
    db.commit()


@router.get("/budget-alerts/full", response_model=schemas.BudgetAlertsFullOut)
def get_budget_alerts_full(
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    today = dt_date.today()
    month_prefix = today.strftime("%Y-%m")
    
    alerts = db.query(models.BudgetAlert).filter(models.BudgetAlert.user_id == current.id).all()
    
    enriched_alerts = []
    total_budget = 0.0
    total_spent = 0.0
    over_budget_count = 0
    warning_count = 0

    for alert in alerts:
        spent = float(db.query(func.coalesce(func.sum(models.Transaction.amount), 0.0)).filter(
            models.Transaction.user_id == current.id,
            models.Transaction.category_id == alert.category_id,
            models.Transaction.date.startswith(month_prefix),
        ).scalar() or 0.0)
        
        limit = float(alert.monthly_limit)
        percentage = (spent / limit * 100) if limit > 0 else 0
        remaining = limit - spent
        
        status = "safe"
        if percentage >= 100:
            status = "exceeded"
            over_budget_count += 1
        elif percentage >= 90:
            status = "danger"
            warning_count += 1
        elif percentage >= 75:
            status = "warning"
            warning_count += 1

        enriched_alerts.append(schemas.BudgetAlertEnrichedOut(
            id=alert.id,
            category_id=alert.category_id,
            category_name=alert.category.name if alert.category else "?",
            monthly_limit=limit,
            created_at=alert.created_at,
            status=status,
            percentage=round(percentage, 1),
            spent=spent,
            remaining=remaining,
        ))
        
        total_budget += limit
        total_spent += spent

    return schemas.BudgetAlertsFullOut(
        alerts=enriched_alerts,
        total_budget=total_budget,
        total_spent=total_spent,
        over_budget_count=over_budget_count,
        warning_count=warning_count,
        month=month_prefix,
    )

