"""Goal CRUD with pagination on list endpoint."""

from datetime import date as dt_date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models
import schemas
from auth import get_current_user
from db import get_db
from pagination import PaginationParams, paginated_response

router = APIRouter()


@router.post("/goals", response_model=schemas.GoalOut, status_code=201)
def create_goal(
    payload: schemas.GoalCreate,
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    g = models.Goal(
        title=payload.title, target_amount=payload.target_amount,
        current_amount=payload.current_amount, target_date=payload.target_date,
        user_id=current.id,
    )
    db.add(g)
    db.commit()
    db.refresh(g)
    return g


@router.get("/goals")
def list_goals(
    params: PaginationParams = Depends(),
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    query = db.query(models.Goal).filter(models.Goal.user_id == current.id).order_by(models.Goal.id.desc())
    return paginated_response(query, params)


@router.get("/goals/{goal_id}/plan", response_model=schemas.GoalPlanOut)
def goal_plan(
    goal_id: int,
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    g = db.query(models.Goal).filter(models.Goal.id == goal_id, models.Goal.user_id == current.id).first()
    if not g:
        raise HTTPException(status_code=404, detail="Goal not found")
    today = dt_date.today()
    y, m, d = map(int, g.target_date.split("-"))
    target = dt_date(y, m, d)
    months = (target.year - today.year) * 12 + (target.month - today.month)
    if target.day >= today.day:
        months += 1
    months_remaining = max(1, months)
    remaining = max(0.0, float(g.target_amount) - float(g.current_amount))
    return schemas.GoalPlanOut(
        goal_id=g.id, months_remaining=months_remaining,
        monthly_required=remaining / months_remaining,
        current_amount=float(g.current_amount),
        target_amount=float(g.target_amount), target_date=g.target_date,
    )


@router.put("/goals/{goal_id}", response_model=schemas.GoalOut)
def update_goal(
    goal_id: int,
    payload: schemas.GoalUpdate,
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    g = db.query(models.Goal).filter(models.Goal.id == goal_id, models.Goal.user_id == current.id).first()
    if not g:
        raise HTTPException(status_code=404, detail="Goal not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(g, field, value)
    db.commit()
    db.refresh(g)
    return g


@router.delete("/goals/{goal_id}")
def delete_goal(
    goal_id: int,
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    g = db.query(models.Goal).filter(models.Goal.id == goal_id, models.Goal.user_id == current.id).first()
    if not g:
        raise HTTPException(status_code=404, detail="Goal not found")
    db.delete(g)
    db.commit()
    return {"deleted": True, "id": goal_id}
