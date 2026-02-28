from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy import func
from jose import JWTError
from typing import Optional, List

from db import get_db
import models
import schemas
from auth import hash_password, verify_password, create_access_token, decode_token

app = FastAPI(title="MapleBudget API", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1|(\d{1,3}\.){3}\d{1,3}):3000",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/token")


@app.get("/health")
def health():
    return {"status": "ok"}


# ---------- AUTH helpers ----------
def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> models.User:
    try:
        sub = decode_token(token)  # sub = user_id (string)
        user_id = int(sub)
    except (JWTError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid token")

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


# ---------- AUTH routes ----------
@app.post("/auth/register", response_model=schemas.UserOut)
def register(payload: schemas.UserCreate, db: Session = Depends(get_db)):
    if len(payload.password.encode("utf-8")) > 256:
        raise HTTPException(status_code=400, detail="Password too long (max 256 bytes).")
    exists = db.query(models.User).filter(models.User.email == payload.email).first()
    if exists:
        raise HTTPException(status_code=400, detail="Email already used")

    u = models.User(email=payload.email, hashed_password=hash_password(payload.password))
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


@app.post("/auth/token", response_model=schemas.TokenOut)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    # OAuth2PasswordRequestForm -> form.username et form.password
    user = db.query(models.User).filter(models.User.email == form.username).first()
    if not user or not verify_password(form.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token(subject=str(user.id))
    return schemas.TokenOut(access_token=token)


@app.get("/auth/me", response_model=schemas.UserOut)
def me(current: models.User = Depends(get_current_user)):
    return current


# ---------- Categories (protected) ----------
@app.post("/categories", response_model=schemas.CategoryOut)
def create_category(
    payload: schemas.CategoryCreate,
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    c = models.Category(name=payload.name, type=payload.type, user_id=current.id)
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


@app.get("/categories", response_model=List[schemas.CategoryOut])
def list_categories(
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    return (
        db.query(models.Category)
        .filter(models.Category.user_id == current.id)
        .order_by(models.Category.id.desc())
        .all()
    )


# ---------- Transactions (protected) ----------
@app.post("/transactions", response_model=schemas.TransactionOut)
def create_transaction(
    payload: schemas.TransactionCreate,
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    # sécurité: catégorie doit appartenir à l'utilisateur
    cat = (
        db.query(models.Category)
        .filter(models.Category.id == payload.category_id, models.Category.user_id == current.id)
        .first()
    )
    if not cat:
        raise HTTPException(status_code=400, detail="Invalid category")

    t = models.Transaction(
        amount=payload.amount,
        date=payload.date,
        note=payload.note,
        category_id=payload.category_id,
        user_id=current.id,
    )
    db.add(t)
    db.commit()
    db.refresh(t)
    return t


@app.get("/transactions", response_model=List[schemas.TransactionOut])
def list_transactions(
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    return (
        db.query(models.Transaction)
        .filter(models.Transaction.user_id == current.id)
        .order_by(models.Transaction.id.desc())
        .all()
    )


@app.put("/transactions/{tx_id}", response_model=schemas.TransactionOut)
def update_transaction(
    tx_id: int,
    payload: schemas.TransactionUpdate,
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    t = (
        db.query(models.Transaction)
        .filter(models.Transaction.id == tx_id, models.Transaction.user_id == current.id)
        .first()
    )
    if not t:
        raise HTTPException(status_code=404, detail="Transaction not found")

    if payload.category_id is not None:
        cat = (
            db.query(models.Category)
            .filter(models.Category.id == payload.category_id, models.Category.user_id == current.id)
            .first()
        )
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
    return t


@app.delete("/transactions/{tx_id}")
def delete_transaction(
    tx_id: int,
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    t = (
        db.query(models.Transaction)
        .filter(models.Transaction.id == tx_id, models.Transaction.user_id == current.id)
        .first()
    )
    if not t:
        raise HTTPException(status_code=404, detail="Transaction not found")

    db.delete(t)
    db.commit()
    return {"deleted": True, "id": tx_id}


# ---------- Dashboard (protected) ----------
@app.get("/dashboard", response_model=schemas.DashboardOut)
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
            func.coalesce(func.sum(models.Transaction.amount), 0).label("total"),
            func.count(models.Transaction.id).label("count"),
        )
        .join(models.Transaction, models.Transaction.category_id == models.Category.id)
        .filter(models.Transaction.user_id == current.id)
        .group_by(models.Category.id, models.Category.name, models.Category.type)
    )

    if from_date:
        q = q.filter(models.Transaction.date >= from_date)
    if to_date:
        q = q.filter(models.Transaction.date <= to_date)

    rows = q.all()

    by_category = [
        schemas.CategoryTotal(
            category_id=r.category_id,
            name=r.name,
            type=r.type,
            total=float(r.total),
            count=int(r.count),
        )
        for r in rows
    ]

    income_total = sum(x.total for x in by_category if x.type == "income")
    expense_total = sum(x.total for x in by_category if x.type == "expense")
    net = income_total - expense_total

    tx_count = (
        db.query(func.count(models.Transaction.id))
        .filter(models.Transaction.user_id == current.id)
        .scalar()
        or 0
    )

    return schemas.DashboardOut(
        income_total=income_total,
        expense_total=expense_total,
        net=net,
        tx_count=int(tx_count),
        by_category=by_category,
    )

from datetime import date as dt_date

@app.post("/goals", response_model=schemas.GoalOut)
def create_goal(
    payload: schemas.GoalCreate,
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    g = models.Goal(
        title=payload.title,
        target_amount=payload.target_amount,
        current_amount=payload.current_amount,
        target_date=payload.target_date,
        user_id=current.id,
    )
    db.add(g)
    db.commit()
    db.refresh(g)
    return g

@app.get("/goals", response_model=List[schemas.GoalOut])
def list_goals(
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    return (
        db.query(models.Goal)
        .filter(models.Goal.user_id == current.id)
        .order_by(models.Goal.id.desc())
        .all()
    )

@app.get("/goals/{goal_id}/plan", response_model=schemas.GoalPlanOut)
def goal_plan(
    goal_id: int,
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    g = (
        db.query(models.Goal)
        .filter(models.Goal.id == goal_id, models.Goal.user_id == current.id)
        .first()
    )
    if not g:
        raise HTTPException(status_code=404, detail="Goal not found")

    # Calcul mois restants (approx pro: mois calendaires)
    today = dt_date.today()
    y, m, d = map(int, g.target_date.split("-"))
    target = dt_date(y, m, d)

    months = (target.year - today.year) * 12 + (target.month - today.month)
    if target.day >= today.day:
        months = months + 1  # inclure le mois en cours si pertinent
    months_remaining = max(1, months)

    remaining = float(g.target_amount) - float(g.current_amount)
    remaining = max(0.0, remaining)
    monthly_required = remaining / months_remaining

    return schemas.GoalPlanOut(
        goal_id=g.id,
        months_remaining=months_remaining,
        monthly_required=monthly_required,
        current_amount=float(g.current_amount),
        target_amount=float(g.target_amount),
        target_date=g.target_date,
    )

@app.put("/goals/{goal_id}", response_model=schemas.GoalOut)
def update_goal(
    goal_id: int,
    payload: schemas.GoalUpdate,
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    g = (
        db.query(models.Goal)
        .filter(models.Goal.id == goal_id, models.Goal.user_id == current.id)
        .first()
    )
    if not g:
        raise HTTPException(status_code=404, detail="Goal not found")

    if payload.title is not None:
        g.title = payload.title
    if payload.target_amount is not None:
        g.target_amount = payload.target_amount
    if payload.current_amount is not None:
        g.current_amount = payload.current_amount
    if payload.target_date is not None:
        g.target_date = payload.target_date

    db.commit()
    db.refresh(g)
    return g


@app.delete("/goals/{goal_id}")
def delete_goal(
    goal_id: int,
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    g = (
        db.query(models.Goal)
        .filter(models.Goal.id == goal_id, models.Goal.user_id == current.id)
        .first()
    )
    if not g:
        raise HTTPException(status_code=404, detail="Goal not found")

    db.delete(g)
    db.commit()
    return {"deleted": True, "id": goal_id}