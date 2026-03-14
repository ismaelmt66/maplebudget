"""Category CRUD with pagination on list endpoint."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

import models
import schemas
from auth import get_current_user
from db import get_db
from pagination import PaginationParams, paginated_response

router = APIRouter()


@router.post("/categories", response_model=schemas.CategoryOut, status_code=201)
def create_category(
    payload: schemas.CategoryCreate,
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    c = models.Category(
        name=payload.name, type=payload.type, budget_limit=payload.budget_limit,
        user_id=current.id,
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


@router.get("/categories")
def list_categories(
    params: PaginationParams = Depends(),
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    query = db.query(models.Category).filter(models.Category.user_id == current.id).order_by(models.Category.id.desc())
    return paginated_response(query, params)


@router.put("/categories/{cat_id}", response_model=schemas.CategoryOut)
def update_category(
    cat_id: int,
    payload: schemas.CategoryUpdate,
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    c = db.query(models.Category).filter(
        models.Category.id == cat_id, models.Category.user_id == current.id
    ).first()
    if not c:
        raise HTTPException(status_code=404, detail="Category not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(c, field, value)
    db.commit()
    db.refresh(c)
    return c


@router.delete("/categories/{cat_id}")
def delete_category(
    cat_id: int,
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    c = db.query(models.Category).filter(
        models.Category.id == cat_id, models.Category.user_id == current.id
    ).first()
    if not c:
        raise HTTPException(status_code=404, detail="Category not found")
    tx_count = db.query(func.count(models.Transaction.id)).filter(
        models.Transaction.category_id == cat_id
    ).scalar()
    if tx_count and tx_count > 0:
        raise HTTPException(status_code=400, detail="Cannot delete category with associated transactions.")
    db.delete(c)
    db.commit()
    return {"deleted": True, "id": cat_id}
