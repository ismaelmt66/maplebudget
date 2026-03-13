# ruff: noqa: E402
"""Application FastAPI pour NexLedger.

Ce module définit tous les endpoints HTTP utilisés par le front-end. La logique
reste simple et centrée sur les opérations CRUD de base pour utilisateurs,
catégories, transactions, objectifs et le tableau de bord.
"""

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
import csv
import io
import secrets
from sqlalchemy import func
from typing import Optional, List
from datetime import date as dt_date, datetime
from collections import defaultdict

from db import get_db
import models
import schemas
from auth import hash_password, verify_password, create_access_token, get_current_user
from routers import subscriptions as subscriptions_router
from services import bank_service

app = FastAPI(title="NexLedger API", version="0.4.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(subscriptions_router.router, prefix="/analytics")
# ---------- Aides d’authentification ----------
# `get_current_user` est maintenant importé de `auth.py` pour éviter les dépendances circulaires



# ---------- Routes d'auth ----------
@app.post("/auth/register", response_model=schemas.UserOut)
def register(payload: schemas.UserCreate, db: Session = Depends(get_db)):
    """Créer un compte utilisateur après validation des données.

    La longueur du mot de passe est contrôlée pour éviter des problèmes avec la
    base, et les emails en double sont refusés.
    """
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
    """Authentifier un utilisateur et retourner un jeton d’accès JWT.

    Utilise le flux OAuth2 password ; form.username est considéré comme l’email.
    """
    # OAuth2PasswordRequestForm -> form.username et form.password
    user = db.query(models.User).filter(models.User.email == form.username).first()
    if not user or not verify_password(form.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token(subject=str(user.id))
    # Journal d'audit
    db.add(models.AuditLog(user_id=user.id, action="login",
        details=f"Connexion réussie", created_at=datetime.now().isoformat()))
    db.commit()
    return schemas.TokenOut(access_token=token)


@app.get("/auth/me", response_model=schemas.UserOut)
def me(current: models.User = Depends(get_current_user)):
    """Renvoie des informations sur l’utilisateur authentifié."""
    return current


@app.get("/auth/onboarding-status")
def onboarding_status(
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    """Retourne si l’utilisateur a complété l’onboarding (au moins 1 catégorie)."""
    has_categories = db.query(models.Category).filter(models.Category.user_id == current.id).first() is not None
    return {"is_onboarded": has_categories}


# ---------- Categories (protected) ----------

@app.post("/categories", response_model=schemas.CategoryOut)
def create_category(
    payload: schemas.CategoryCreate,
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    """Create a new category for the authenticated user."""
    c = models.Category(
        name=payload.name, 
        type=payload.type, 
        budget_limit=payload.budget_limit,
        user_id=current.id
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


@app.get("/categories", response_model=List[schemas.CategoryOut])
def list_categories(
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    """List all categories belonging to the authenticated user."""
    return (
        db.query(models.Category)
        .filter(models.Category.user_id == current.id)
        .order_by(models.Category.id.desc())
        .all()
    )


@app.put("/categories/{cat_id}", response_model=schemas.CategoryOut)
def update_category(
    cat_id: int,
    payload: schemas.CategoryUpdate,
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    """Update an existing category belonging to the authenticated user."""
    c = (
        db.query(models.Category)
        .filter(models.Category.id == cat_id, models.Category.user_id == current.id)
        .first()
    )
    if not c:
        raise HTTPException(status_code=404, detail="Category not found")

    if payload.name is not None:
        c.name = payload.name
    if payload.type is not None:
        c.type = payload.type
    if payload.budget_limit is not None:
        c.budget_limit = payload.budget_limit

    db.commit()
    db.refresh(c)
    return c


@app.delete("/categories/{cat_id}")
def delete_category(
    cat_id: int,
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    """Delete a category. Ensure no transactions remain, or delete them too."""
    c = (
        db.query(models.Category)
        .filter(models.Category.id == cat_id, models.Category.user_id == current.id)
        .first()
    )
    if not c:
        raise HTTPException(status_code=404, detail="Category not found")
        
    # Check if category has transactions
    tx_count = db.query(func.count(models.Transaction.id)).filter(models.Transaction.category_id == cat_id).scalar()
    if tx_count and tx_count > 0:
        raise HTTPException(status_code=400, detail="Cannot delete category with associated transactions.")

    db.delete(c)
    db.commit()
    return {"deleted": True, "id": cat_id}


# ---------- Transactions (protected) ----------

@app.post("/transactions", response_model=schemas.TransactionOut)
def create_transaction(
    payload: schemas.TransactionCreate,
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    """Create a new transaction for the authenticated user.

    Fails if the assigned category does not belong to the user.
    """
    # vérifier que la catégorie appartient à l’utilisateur actuel
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
        is_recurring=payload.is_recurring,
        recurrence_interval=payload.recurrence_interval,
    )
    db.add(t)
    db.commit()
    db.refresh(t)
    return t


from fastapi.responses import StreamingResponse
import io
import csv

@app.get("/transactions/export")
def export_transactions_csv(
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    """Export all user transactions as a CSV file."""
    # Fetch all transactions with their categories
    transactions = (
        db.query(models.Transaction, models.Category)
        .join(models.Category, models.Transaction.category_id == models.Category.id)
        .filter(models.Transaction.user_id == current.id)
        .order_by(models.Transaction.date.desc())
        .all()
    )

    output = io.StringIO()
    writer = csv.writer(output, delimiter=",", quoting=csv.QUOTE_MINIMAL)
    
    # Write header
    writer.writerow(["Date", "Montant", "Type", "Categorie", "Note"])
    
    # Write data
    for t, c in transactions:
        writer.writerow([
            t.date,
            f"{t.amount:.2f}",
            "Revenu" if c.type == "income" else "Dépense",
            c.name,
            t.note or ""
        ])
    
    output.seek(0)
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=nexledger_transactions.csv"}
    )


@app.get("/transactions", response_model=List[schemas.TransactionOut])
def list_transactions(
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    """List all transactions belonging to the authenticated user."""
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
    """Update an existing transaction belonging to the authenticated user."""
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
    """Delete a transaction belonging to the authenticated user."""
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
            category_id=r.category_id,
            name=r.name,
            type=r.type,
            budget_limit=float(r.budget_limit) if r.budget_limit is not None else None,
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

@app.get("/dashboard/ai-forecast")
def dashboard_ai_forecast(
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    from services.ai_engine import FinancialAIEngine
    engine = FinancialAIEngine(db=db, user_id=current.id)
    return engine.predict_cashflow()


# ---------- Analytics (protected) ----------

@app.get("/analytics/subscriptions", response_model=List[schemas.SubscriptionOut])
def get_subscriptions(
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    """Detect recurring subscriptions from user transactions."""
    txs = (
        db.query(models.Transaction, models.Category)
        .join(models.Category, models.Transaction.category_id == models.Category.id)
        .filter(models.Transaction.user_id == current.id)
        .filter(models.Category.type == "expense")
        .order_by(models.Transaction.date.asc())
        .all()
    )

    # Group by note (fallback to category name if note is empty)
    groups = defaultdict(list)
    for t, c in txs:
        key = (t.note or c.name).strip().lower()
        if key:
            groups[key].append((t, c))

    subs = []
    today = dt_date.today()

    for key, items in groups.items():
        if len(items) < 2:
            continue
        
        # Parse dates
        items_with_dates = []
        for t, c in items:
            try:
                date_obj = datetime.strptime(t.date, "%Y-%m-%d").date()
                items_with_dates.append((t, c, date_obj))
            except ValueError:
                pass
                
        if len(items_with_dates) < 2:
            continue

        # Check the last two transactions
        t1, c1, d1 = items_with_dates[-2]
        t2, c2, d2 = items_with_dates[-1]

        days_diff = (d2 - d1).days

        # Is it a monthly recurring? (20 to 45 days)
        if 20 <= days_diff <= 45:
            # Check if the most recent one is not too old (e.g., active subscription)
            days_since_last = (today - d2).days
            
            # Status could be active or cancelled if it's been more than 45 days since expected next billing
            status = "active" if days_since_last <= 45 else "inactive"
            
            # For this phase, only show active or recently inactive ones
            if days_since_last > 90:
                continue

            # Amounts should be somewhat similar
            if abs(t1.amount - t2.amount) / max(t1.amount, 0.01) < 0.3: # 30% variance
                name_display = t2.note or c2.name
                has_price_hike = float(t2.amount) > float(t1.amount)
                
                # Check for exact duplicate detection from other systems, avoid weird empty names
                if not name_display:
                    continue
                    
                subs.append({
                    "name": name_display,
                    "monthly_cost": float(t2.amount),
                    "yearly_projection": float(t2.amount * 12),
                    "status": status,
                    "has_price_hike": has_price_hike,
                    "category_name": c2.name,
                    "last_date": t2.date
                })
    
    # Sort by monthly cost desc
    subs.sort(key=lambda x: x["monthly_cost"], reverse=True)
    return subs


# ---------- Goals (protected) ----------

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
    """List all savings goals for the authenticated user."""
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

    # Calculer les mois restants (approximation : mois calendaires)
    today = dt_date.today()
    y, m, d = map(int, g.target_date.split("-"))
    target = dt_date(y, m, d)

    months = (target.year - today.year) * 12 + (target.month - today.month)
    if target.day >= today.day:
        months = months + 1  # include the current month if relevant
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


# ---------- Patrimoine / Assets (protected) ----------

@app.post("/assets", response_model=schemas.AssetOut)
def create_asset(
    payload: schemas.AssetCreate,
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    today_str = dt_date.today().strftime("%Y-%m-%d")
    
    a = models.Asset(
        name=payload.name,
        type=payload.type,
        balance=payload.balance,
        user_id=current.id,
    )
    db.add(a)
    db.commit()
    db.refresh(a)

    # Création du premier point d'historique
    h = models.AssetHistory(
        asset_id=a.id,
        date=today_str,
        balance=payload.balance
    )
    db.add(h)
    db.commit()
    db.refresh(a)
    
    return a


@app.get("/assets", response_model=List[schemas.AssetOut])
def list_assets(
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    return (
        db.query(models.Asset)
        .filter(models.Asset.user_id == current.id)
        .order_by(models.Asset.id.desc())
        .all()
    )



# ---------- Smart Allocation Rules (MUST be before /assets/{asset_id}) ----------

@app.get("/assets/allocation-rules", response_model=list[schemas.AllocationRuleOut])
def list_allocation_rules(
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    """Liste toutes les règles d'allocation de l'utilisateur."""
    rules = db.query(models.AllocationRule).filter(
        models.AllocationRule.user_id == current.id
    ).all()
    result = []
    for r in rules:
        result.append(schemas.AllocationRuleOut(
            id=r.id,
            name=r.name,
            source_type=r.source_type,
            source_category_id=r.source_category_id,
            source_category_name=r.source_category.name if r.source_category else None,
            target_asset_id=r.target_asset_id,
            target_asset_name=r.target_asset.name if r.target_asset else "?",
            allocation_percent=float(r.allocation_percent),
            is_active=r.is_active,
        ))
    return result


@app.post("/assets/allocation-rules", response_model=schemas.AllocationRuleOut, status_code=201)
def create_allocation_rule(
    payload: schemas.AllocationRuleCreate,
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    """Crée une nouvelle règle d'allocation automatique."""
    asset = db.query(models.Asset).filter(
        models.Asset.id == payload.target_asset_id,
        models.Asset.user_id == current.id
    ).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Target asset not found")
    rule = models.AllocationRule(
        user_id=current.id,
        name=payload.name,
        source_type=payload.source_type,
        source_category_id=payload.source_category_id,
        target_asset_id=payload.target_asset_id,
        allocation_percent=payload.allocation_percent,
        is_active=True,
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return schemas.AllocationRuleOut(
        id=rule.id,
        name=rule.name,
        source_type=rule.source_type,
        source_category_id=rule.source_category_id,
        source_category_name=rule.source_category.name if rule.source_category else None,
        target_asset_id=rule.target_asset_id,
        target_asset_name=asset.name,
        allocation_percent=float(rule.allocation_percent),
        is_active=rule.is_active,
    )


@app.post("/assets/allocation-rules/simulate", response_model=list[schemas.AllocationSimulateResult])
def simulate_allocation(
    payload: schemas.AllocationSimulateRequest,
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    """Simule la répartition d'un revenu sans modifier les données."""
    rules = db.query(models.AllocationRule).filter(
        models.AllocationRule.user_id == current.id,
        models.AllocationRule.is_active,
    ).all()
    results = []
    for r in rules:
        allocated = round(payload.income_amount * float(r.allocation_percent) / 100, 2)
        results.append(schemas.AllocationSimulateResult(
            rule_id=r.id,
            rule_name=r.name,
            target_asset_name=r.target_asset.name if r.target_asset else "?",
            allocated_amount=allocated,
            percent=float(r.allocation_percent),
        ))
    return results


@app.post("/assets/allocation-rules/apply")
def apply_allocation(
    payload: schemas.AllocationApplyRequest,
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    """Applique les règles actives et met à jour les soldes."""
    from datetime import date as dt_today
    rules = db.query(models.AllocationRule).filter(
        models.AllocationRule.user_id == current.id,
        models.AllocationRule.is_active,
    ).all()
    applied = []
    today_str = dt_today.today().isoformat()
    for r in rules:
        if r.source_type == "category":
            if payload.income_category_id is None or r.source_category_id != payload.income_category_id:
                continue
        allocated = round(payload.income_amount * float(r.allocation_percent) / 100, 2)
        if allocated <= 0:
            continue
        asset = db.query(models.Asset).filter(models.Asset.id == r.target_asset_id).first()
        if not asset:
            continue
        new_balance = float(asset.balance) + allocated
        asset.balance = new_balance
        db.add(models.AssetHistory(asset_id=asset.id, date=today_str, balance=new_balance))
        db.commit()
        applied.append({"rule_name": r.name, "asset_name": asset.name, "allocated_amount": allocated, "new_balance": new_balance})
    return {"applied": applied, "count": len(applied), "total_allocated": sum(a["allocated_amount"] for a in applied)}


@app.put("/assets/allocation-rules/{rule_id}", response_model=schemas.AllocationRuleOut)
def update_allocation_rule(
    rule_id: int,
    payload: schemas.AllocationRuleUpdate,
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    """Modifie une règle (y compris activer/désactiver)."""
    rule = db.query(models.AllocationRule).filter(
        models.AllocationRule.id == rule_id,
        models.AllocationRule.user_id == current.id
    ).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(rule, field, value)
    db.commit()
    db.refresh(rule)
    return schemas.AllocationRuleOut(
        id=rule.id,
        name=rule.name,
        source_type=rule.source_type,
        source_category_id=rule.source_category_id,
        source_category_name=rule.source_category.name if rule.source_category else None,
        target_asset_id=rule.target_asset_id,
        target_asset_name=rule.target_asset.name if rule.target_asset else "?",
        allocation_percent=float(rule.allocation_percent),
        is_active=rule.is_active,
    )


@app.delete("/assets/allocation-rules/{rule_id}", status_code=204)
def delete_allocation_rule(
    rule_id: int,
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    """Supprime une règle."""
    rule = db.query(models.AllocationRule).filter(
        models.AllocationRule.id == rule_id,
        models.AllocationRule.user_id == current.id
    ).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    db.delete(rule)
    db.commit()


@app.get("/assets/ai-analysis")
def ai_patrimoine_analysis(
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    """Analyse IA du patrimoine."""
    from services.ai_engine import FinancialAIEngine
    engine = FinancialAIEngine(db=db, user_id=current.id)
    report = engine.analyze_patrimoine()
    return {"report": report}


# ---------- Assets: parameterized routes (AFTER specific routes) ----------

@app.put("/assets/{asset_id}", response_model=schemas.AssetOut)
def update_asset(
    asset_id: int,
    payload: schemas.AssetUpdate,
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    a = (
        db.query(models.Asset)
        .filter(models.Asset.id == asset_id, models.Asset.user_id == current.id)
        .first()
    )
    if not a:
        raise HTTPException(status_code=404, detail="Asset not found")

    balance_changed = False
    new_balance = float(a.balance)

    if payload.name is not None:
        a.name = payload.name
    if payload.type is not None:
        a.type = payload.type
    if payload.balance is not None:
        # A change in balance triggers history
        if float(a.balance) != float(payload.balance):
            balance_changed = True
            new_balance = float(payload.balance)
        a.balance = payload.balance

    if balance_changed:
        today_str = dt_date.today().strftime("%Y-%m-%d")
        # Check if history exists for today to overwrite it instead of creating a new row
        h = db.query(models.AssetHistory).filter(models.AssetHistory.asset_id == a.id, models.AssetHistory.date == today_str).first()
        if h:
            h.balance = new_balance
        else:
            new_h = models.AssetHistory(asset_id=a.id, date=today_str, balance=new_balance)
            db.add(new_h)

    db.commit()
    db.refresh(a)
    return a


@app.delete("/assets/{asset_id}")
def delete_asset(
    asset_id: int,
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    a = (
        db.query(models.Asset)
        .filter(models.Asset.id == asset_id, models.Asset.user_id == current.id)
        .first()
    )
    if not a:
        raise HTTPException(status_code=404, detail="Asset not found")

    db.delete(a)
    db.commit()
    return {"deleted": True, "id": asset_id}

# ---------- Gamification / Achievements (protected) ----------

@app.get("/achievements", response_model=List[schemas.AchievementOut])
def get_achievements(
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    """Calcule à la volée les trophées débloqués par l'utilisateur."""
    
    tx_count = db.query(models.Transaction).filter(models.Transaction.user_id == current.id).count()
    goals_count = db.query(models.Goal).filter(models.Goal.user_id == current.id).count()
    assets_count = db.query(models.Asset).filter(models.Asset.user_id == current.id).count()
    
    achievements = []

    # 1. Premier Pas
    achievements.append({
        "id": "first_tx",
        "title": "Premier Pas",
        "description": "Ajouter sa première transaction.",
        "icon": "🎉",
        "is_unlocked": tx_count >= 1,
        "progress": min(tx_count / 1.0, 1.0),
    })

    # 2. Voyageur Actif
    achievements.append({
        "id": "active_tracker",
        "title": "Voyageur Régulier",
        "description": "Enregistrer 50 transactions sur l'application.",
        "icon": "🏃‍♂️",
        "is_unlocked": tx_count >= 50,
        "progress": min(tx_count / 50.0, 1.0),
    })

    # 3. Visionnaire
    achievements.append({
        "id": "visionary",
        "title": "Visionnaire",
        "description": "Se fixer au moins un objectif d'épargne.",
        "icon": "🎯",
        "is_unlocked": goals_count >= 1,
        "progress": min(goals_count / 1.0, 1.0),
    })

    # 4. Investisseur
    achievements.append({
        "id": "investor",
        "title": "Investisseur",
        "description": "Ajouter au moins 2 comptes de patrimoine.",
        "icon": "📈",
        "is_unlocked": assets_count >= 2,
        "progress": min(assets_count / 2.0, 1.0),
    })

    # 5. Centurion
    achievements.append({
        "id": "centurion",
        "title": "Le Centurion",
        "description": "Enregistrer plus de 100 transactions.",
        "icon": "👑",
        "is_unlocked": tx_count >= 100,
        "progress": min(tx_count / 100.0, 1.0),
    })

    return achievements


# ---------- AI Financial Coach (protected) ----------

from services.ai_engine import FinancialAIEngine
import os

@app.get("/ai/status", response_model=schemas.AIStatusOut)
def ai_status(current: models.User = Depends(get_current_user)):
    """Return the current AI mode (llm or heuristic) based on available API keys."""
    if os.environ.get("GROQ_API_KEY"):
        return {"mode": "llm", "llm_provider": "groq"}
    if os.environ.get("ANTHROPIC_API_KEY"):
        return {"mode": "llm", "llm_provider": "anthropic"}
    return {"mode": "heuristic", "llm_provider": None}

@app.post("/ai/chat", response_model=schemas.ChatResponse)
def ai_chat(
    payload: schemas.ChatMessage,
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    """
    Simulated AI Financial Coach (God Mode Heuristics).
    Analyzes user data across the entire DB to answer queries.
    """
    import time
    time.sleep(1.0) # Simulate a slight processing delay for the "AI feel"
    
    engine = FinancialAIEngine(db=db, user_id=current.id)
    reply = engine.process_query(payload.message)

    return {"reply": reply.strip()}


# ---------- Recurring Transactions CRUD ----------

@app.get("/recurring-transactions")
def list_recurring_transactions(
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    return db.query(models.RecurringTransaction).filter(
        models.RecurringTransaction.user_id == current.id
    ).all()


@app.post("/recurring-transactions")
def create_recurring_transaction(
    payload: dict,
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    rt = models.RecurringTransaction(
        user_id=current.id,
        name=payload.get("name", ""),
        amount=payload.get("amount", 0),
        frequency=payload.get("frequency", "monthly"),
        next_date=payload.get("next_date", str(dt_date.today())),
        note=payload.get("note"),
        is_active=payload.get("is_active", True),
        category_id=payload.get("category_id"),
    )
    db.add(rt)
    db.commit()
    db.refresh(rt)
    return rt


@app.put("/recurring-transactions/{rt_id}")
def update_recurring_transaction(
    rt_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    rt = db.query(models.RecurringTransaction).filter(
        models.RecurringTransaction.id == rt_id,
        models.RecurringTransaction.user_id == current.id,
    ).first()
    if not rt:
        raise HTTPException(status_code=404, detail="Introuvable.")
    for k, v in payload.items():
        if hasattr(rt, k):
            setattr(rt, k, v)
    db.commit()
    db.refresh(rt)
    return rt


@app.delete("/recurring-transactions/{rt_id}")
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


@app.post("/recurring-transactions/detect")
def detect_recurring_transactions(
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    """Analyse l'historique des transactions et détecte les patterns récurrents.

    Crée automatiquement les RecurringTransaction manquantes pour les patterns
    détectés avec un score de confiance >= 0.5. Retourne la liste complète après détection.
    """
    from services.recurring_detection import RecurringDetectionEngine

    engine = RecurringDetectionEngine(db=db, user_id=current.id)
    patterns = engine.detect_recurring_patterns()

    created = 0
    for p in patterns:
        if p["confidence_score"] < 0.5:
            continue

        # Éviter les doublons : vérifier si ce nom existe déjà
        existing = db.query(models.RecurringTransaction).filter(
            models.RecurringTransaction.user_id == current.id,
            models.RecurringTransaction.name == p["name"],
        ).first()

        if existing:
            continue

        rt = models.RecurringTransaction(
            user_id=current.id,
            name=p["name"],
            amount=p["amount"],
            frequency=p["frequency"],
            next_date=p["next_occurrence"],
            note=f"Détecté automatiquement (confiance {int(p['confidence_score'] * 100)}%)",
            is_active=True,
        )
        db.add(rt)
        created += 1

    db.commit()

    all_rts = db.query(models.RecurringTransaction).filter(
        models.RecurringTransaction.user_id == current.id
    ).all()

    return {"detected": created, "patterns": len(patterns), "items": all_rts}


@app.get("/budget-alerts/summary")
def budget_alerts_summary(
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    """Retourne un résumé global des alertes budget."""
    today = dt_date.today()
    month_prefix = f"{today.year}-{str(today.month).zfill(2)}"
    alerts = db.query(models.BudgetAlert).filter(models.BudgetAlert.user_id == current.id).all()
    over = 0
    warning = 0
    total_limit = 0.0
    total_spent = 0.0
    for a in alerts:
        spent = float(db.query(func.sum(models.Transaction.amount)).filter(
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
        "total_alerts": len(alerts),
        "over_budget_count": over,
        "warning_count": warning,
        "total_budget": total_limit,
        "total_spent": total_spent,
    }


@app.get("/onboarding/default-categories")
def get_default_categories():
    """Retourne les catégories par défaut suggérées à l'onboarding."""
    return [
        {"name": "🏠 Logement", "type": "expense", "icon": "🏠", "suggested_budget": 800},
        {"name": "🍔 Alimentation", "type": "expense", "icon": "🍔", "suggested_budget": 400},
        {"name": "🚗 Transport", "type": "expense", "icon": "🚗", "suggested_budget": 200},
        {"name": "💊 Santé", "type": "expense", "icon": "💊", "suggested_budget": 100},
        {"name": "🎬 Loisirs", "type": "expense", "icon": "🎬", "suggested_budget": 150},
        {"name": "👕 Vêtements", "type": "expense", "icon": "👕", "suggested_budget": 100},
        {"name": "📱 Abonnements", "type": "expense", "icon": "📱", "suggested_budget": 80},
        {"name": "💼 Salaire", "type": "income", "icon": "💼", "suggested_budget": None},
        {"name": "💰 Épargne", "type": "expense", "icon": "💰", "suggested_budget": 300},
        {"name": "🏦 Investissements", "type": "expense", "icon": "🏦", "suggested_budget": 200},
    ]


@app.post("/onboarding/setup-categories")
def setup_onboarding_categories(
    payload: dict,
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    """Crée un ensemble de catégories à partir des choix de l'onboarding."""
    selected = payload.get("categories", [])
    created = []
    for cat in selected:
        existing = db.query(models.Category).filter(
            models.Category.user_id == current.id,
            models.Category.name == cat.get("name"),
        ).first()
        if not existing:
            new_cat = models.Category(
                user_id=current.id,
                name=cat.get("name"),
                type=cat.get("type", "expense"),
                budget_limit=cat.get("budget_limit"),
            )
            db.add(new_cat)
            created.append(cat.get("name"))
    db.commit()
    return {"created": len(created), "categories": created}


@app.post("/onboarding/complete")
def complete_onboarding(
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    """Marque l'onboarding comme complété."""
    return {"is_onboarded": True, "message": "Bienvenue sur NexLedger !"}


# ---------- Transactions: process-recurring ----------

@app.post("/transactions/process-recurring")
def process_recurring_transactions(
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    """Génère automatiquement les transactions récurrentes dues depuis la dernière occurrence."""
    import calendar as _calendar

    def add_interval(d: "dt_date", interval: str) -> "dt_date":
        if interval == "daily":
            from datetime import timedelta
            return d + timedelta(days=1)
        if interval == "weekly":
            from datetime import timedelta
            return d + timedelta(weeks=1)
        if interval == "monthly":
            # Avancer d'un mois
            month = d.month + 1
            year = d.year
            if month > 12:
                month = 1
                year += 1
            day = min(d.day, _calendar.monthrange(year, month)[1])
            return d.replace(year=year, month=month, day=day)
        if interval == "yearly":
            try:
                return d.replace(year=d.year + 1)
            except ValueError:
                return d.replace(year=d.year + 1, day=28)
        return d

    today = dt_date.today()

    # Trouver toutes les transactions récurrentes de l'utilisateur
    recurring_txs = (
        db.query(models.Transaction)
        .filter(
            models.Transaction.user_id == current.id,
            models.Transaction.is_recurring == True,  # noqa: E712
            models.Transaction.recurrence_interval != None,  # noqa: E711
        )
        .order_by(models.Transaction.date.desc())
        .all()
    )

    # Regrouper par (category_id, recurrence_interval, amount arrondi) → dernière occurrence
    seen = {}
    for t in recurring_txs:
        key = (t.category_id, t.recurrence_interval, round(float(t.amount), 2))
        if key not in seen:
            seen[key] = t

    generated = []
    for key, last_tx in seen.items():
        interval = last_tx.recurrence_interval
        try:
            last_date = datetime.strptime(last_tx.date, "%Y-%m-%d").date()
        except ValueError:
            continue

        next_date = last_date
        iterations = 0
        while iterations < 366:  # sécurité anti-boucle infinie
            iterations += 1
            next_date = add_interval(next_date, interval)
            if next_date > today:
                break

            new_t = models.Transaction(
                amount=last_tx.amount,
                date=next_date.strftime("%Y-%m-%d"),
                note=last_tx.note,
                category_id=last_tx.category_id,
                user_id=current.id,
                is_recurring=True,
                recurrence_interval=interval,
            )
            db.add(new_t)
            db.flush()
            generated.append({
                "date": next_date.strftime("%Y-%m-%d"),
                "amount": float(last_tx.amount),
                "category_id": last_tx.category_id,
                "interval": interval,
            })

    db.commit()
    return {"generated": generated, "count": len(generated)}


# ---------- Transactions: suggest-category (Auto-Catégorisation) ----------

@app.post("/transactions/suggest-category", response_model=schemas.SuggestCategoryResponse)
def suggest_category(
    payload: schemas.SuggestCategoryRequest,
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    """Suggère une catégorie basée sur la description de la transaction via l'IA."""
    cats = (
        db.query(models.Category)
        .filter(models.Category.user_id == current.id)
        .all()
    )
    if not cats:
        return schemas.SuggestCategoryResponse(category_name="Aucune catégorie", confidence=0.0)

    description = payload.description.lower().strip()

    # Essayer d'abord via LLM si disponible
    groq_key = os.environ.get("GROQ_API_KEY")
    if groq_key:
        try:
            from groq import Groq as _GroqClient
            client = _GroqClient(api_key=groq_key)
            cat_list = "\n".join([f"- id={c.id}: {c.name} ({c.type})" for c in cats])
            prompt = f"""Tu es un assistant de catégorisation financière.
Voici les catégories disponibles:
{cat_list}

Description de la transaction: "{payload.description}"

Réponds UNIQUEMENT avec l'ID de la catégorie la plus appropriée (juste le nombre entier, rien d'autre)."""
            resp = client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=10,
                temperature=0,
            )
            raw = resp.choices[0].message.content.strip()
            cat_id = int("".join(c for c in raw if c.isdigit()))
            matched = next((c for c in cats if c.id == cat_id), None)
            if matched:
                return schemas.SuggestCategoryResponse(
                    category_id=matched.id,
                    category_name=matched.name,
                    confidence=0.9,
                )
        except Exception:
            pass  # Fallback sur heuristique

    # Heuristique par correspondance de mots-clés
    keyword_map = {
        "alimentation": ["nourriture", "épicerie", "restaurant", "café", "food", "pizza", "burger", "iga", "metro", "maxi"],
        "transport": ["uber", "taxi", "bus", "stm", "train", "essence", "parking", "auto", "voiture"],
        "logement": ["loyer", "rent", "hydro", "électricité", "internet", "assurance", "maison"],
        "divertissement": ["netflix", "spotify", "amazon", "jeux", "cinéma", "concert", "sortie"],
        "santé": ["pharmacie", "médecin", "docteur", "dentiste", "gym", "sport"],
        "shopping": ["vêtements", "amazon", "achat", "shopping", "magasin"],
        "revenu": ["salaire", "paie", "revenu", "income", "virement"],
    }

    best_cat = None
    best_score = 0.0

    for cat in cats:
        score = 0.0
        cat_name_lower = cat.name.lower()

        # Correspondance directe avec le nom de catégorie
        if cat_name_lower in description or description in cat_name_lower:
            score = 0.85
        else:
            # Correspondance avec les mots-clés
            for kw_cat, keywords in keyword_map.items():
                if kw_cat in cat_name_lower:
                    for kw in keywords:
                        if kw in description:
                            score = max(score, 0.7)

            # Correspondance partielle
            if any(word in description for word in cat_name_lower.split()):
                score = max(score, 0.6)

        if score > best_score:
            best_score = score
            best_cat = cat

    if best_cat and best_score > 0:
        return schemas.SuggestCategoryResponse(
            category_id=best_cat.id,
            category_name=best_cat.name,
            confidence=best_score,
        )

    # Retourner la première catégorie par défaut
    return schemas.SuggestCategoryResponse(
        category_id=cats[0].id,
        category_name=cats[0].name,
        confidence=0.1,
    )


# ---------- Budget Alerts ----------

@app.get("/budget-alerts", response_model=List[schemas.BudgetAlertOut])
def list_budget_alerts(
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    """Liste toutes les alertes budget de l'utilisateur."""
    alerts = (
        db.query(models.BudgetAlert)
        .filter(models.BudgetAlert.user_id == current.id)
        .all()
    )
    return [
        schemas.BudgetAlertOut(
            id=a.id,
            category_id=a.category_id,
            category_name=a.category.name if a.category else "?",
            monthly_limit=float(a.monthly_limit),
            created_at=a.created_at,
        )
        for a in alerts
    ]


@app.post("/budget-alerts", response_model=schemas.BudgetAlertOut, status_code=201)
def create_budget_alert(
    payload: schemas.BudgetAlertCreate,
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    """Crée une nouvelle alerte budget pour une catégorie."""
    cat = (
        db.query(models.Category)
        .filter(models.Category.id == payload.category_id, models.Category.user_id == current.id)
        .first()
    )
    if not cat:
        raise HTTPException(status_code=404, detail="Catégorie non trouvée")

    # Vérifier si une alerte existe déjà pour cette catégorie
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
            id=existing.id,
            category_id=existing.category_id,
            category_name=cat.name,
            monthly_limit=float(existing.monthly_limit),
            created_at=existing.created_at,
        )

    today_str = dt_date.today().strftime("%Y-%m-%d")
    alert = models.BudgetAlert(
        user_id=current.id,
        category_id=payload.category_id,
        monthly_limit=payload.monthly_limit,
        created_at=today_str,
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return schemas.BudgetAlertOut(
        id=alert.id,
        category_id=alert.category_id,
        category_name=cat.name,
        monthly_limit=float(alert.monthly_limit),
        created_at=alert.created_at,
    )


@app.delete("/budget-alerts/{alert_id}", status_code=204)
def delete_budget_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    """Supprime une alerte budget."""
    alert = (
        db.query(models.BudgetAlert)
        .filter(models.BudgetAlert.id == alert_id, models.BudgetAlert.user_id == current.id)
        .first()
    )
    if not alert:
        raise HTTPException(status_code=404, detail="Alerte non trouvée")
    db.delete(alert)
    db.commit()


@app.get("/budget-alerts/check", response_model=List[schemas.BudgetAlertCheckOut])
def check_budget_alerts(
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    """Retourne les catégories dépassant leur limite ce mois-ci."""
    today = dt_date.today()
    month_start = today.replace(day=1).strftime("%Y-%m-%d")
    month_end = today.strftime("%Y-%m-%d")

    alerts = (
        db.query(models.BudgetAlert)
        .filter(models.BudgetAlert.user_id == current.id)
        .all()
    )

    results = []
    for alert in alerts:
        # Calculer les dépenses du mois courant pour cette catégorie
        total = (
            db.query(func.coalesce(func.sum(models.Transaction.amount), 0))
            .filter(
                models.Transaction.user_id == current.id,
                models.Transaction.category_id == alert.category_id,
                models.Transaction.date >= month_start,
                models.Transaction.date <= month_end,
            )
            .scalar()
        ) or 0

        current_spending = float(total)
        monthly_limit = float(alert.monthly_limit)
        percentage = (current_spending / monthly_limit * 100) if monthly_limit > 0 else 0

        results.append(schemas.BudgetAlertCheckOut(
            category_id=alert.category_id,
            category_name=alert.category.name if alert.category else "?",
            monthly_limit=monthly_limit,
            current_spending=current_spending,
            percentage=round(percentage, 1),
            is_exceeded=current_spending >= monthly_limit,
        ))

    return results


# ---------- Financial Health Score ----------

@app.get("/financial-health-score", response_model=schemas.HealthScoreOut)
def financial_health_score(
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    """Calcule rapidement le score de santé financière (0-100) sans générer tout le rapport IA."""
    today = dt_date.today()
    month_start = today.replace(day=1).strftime("%Y-%m-%d")
    month_end = today.strftime("%Y-%m-%d")

    # Toutes les transactions des 3 derniers mois
    three_months_ago = today.replace(day=1)
    for _ in range(2):
        if three_months_ago.month == 1:
            three_months_ago = three_months_ago.replace(year=three_months_ago.year - 1, month=12)
        else:
            three_months_ago = three_months_ago.replace(month=three_months_ago.month - 1)
    three_months_str = three_months_ago.strftime("%Y-%m-%d")

    txs = (
        db.query(models.Transaction, models.Category)
        .join(models.Category, models.Transaction.category_id == models.Category.id)
        .filter(models.Transaction.user_id == current.id, models.Transaction.date >= three_months_str)
        .all()
    )

    income = sum(float(t.amount) for t, c in txs if c.type == "income")
    expenses = sum(float(t.amount) for t, c in txs if c.type == "expense")
    net = income - expenses

    # 1. Taux d'épargne (0-25 pts)
    savings_rate = (net / income * 100) if income > 0 else 0
    savings_score = min(25, max(0, savings_rate / 2))  # 50% savings rate = max

    # 2. Conformité budget (0-25 pts)
    cats_with_limit = (
        db.query(models.Category)
        .filter(models.Category.user_id == current.id, models.Category.budget_limit != None)  # noqa: E711
        .all()
    )
    if cats_with_limit:
        compliant = 0
        for cat in cats_with_limit:
            month_spending = sum(
                float(t.amount) for t, c in txs
                if c.id == cat.id and t.date >= month_start
            )
            if month_spending <= float(cat.budget_limit):
                compliant += 1
        budget_score = (compliant / len(cats_with_limit)) * 25
    else:
        budget_score = 12.5  # Pas de limite = score neutre

    # 3. Fonds d'urgence via actifs (0-25 pts)
    assets = db.query(models.Asset).filter(models.Asset.user_id == current.id).all()
    liquid_assets = sum(
        float(a.balance) for a in assets
        if a.type in ("checking", "savings") and float(a.balance) > 0
    )
    monthly_expenses = expenses / 3 if expenses > 0 else 1
    emergency_months = liquid_assets / monthly_expenses if monthly_expenses > 0 else 0
    emergency_score = min(25, (emergency_months / 6) * 25)  # 6 mois = max

    # 4. Progrès objectifs (0-25 pts)
    goals = db.query(models.Goal).filter(models.Goal.user_id == current.id).all()
    if goals:
        total_progress = sum(
            min(1.0, float(g.current_amount) / float(g.target_amount)) if float(g.target_amount) > 0 else 0
            for g in goals
        )
        goal_score = (total_progress / len(goals)) * 25
    else:
        goal_score = 12.5

    total_score = int(savings_score + budget_score + emergency_score + goal_score)
    total_score = max(0, min(100, total_score))

    grade = "A" if total_score >= 80 else "B" if total_score >= 60 else "C" if total_score >= 40 else "D"

    insights = []
    if savings_rate < 10 and income > 0:
        insights.append(f"Taux d'épargne faible ({savings_rate:.1f}%). Visez 20% minimum.")
    elif savings_rate >= 20:
        insights.append(f"Excellent taux d'épargne de {savings_rate:.1f}% !")
    if emergency_months < 3:
        insights.append(f"Fonds d'urgence insuffisant ({emergency_months:.1f} mois). Cible: 6 mois.")
    if len(goals) == 0:
        insights.append("Définissez des objectifs financiers pour mieux piloter votre épargne.")
    if not insights:
        insights.append("Votre santé financière est bonne. Continuez ainsi !")

    color = "emerald" if total_score >= 80 else "blue" if total_score >= 60 else "amber" if total_score >= 40 else "red"

    return schemas.HealthScoreOut(
        score=total_score,
        grade=grade,
        label=grade,
        color=color,
        breakdown=schemas.HealthScoreBreakdown(
            savings_rate=round(savings_score, 1),
            budget_compliance=round(budget_score, 1),
            emergency_fund=round(emergency_score, 1),
            goal_progress=round(goal_score, 1),
            diversification=0.0,
        ),
        insights=insights,
        recommendations=insights,
        last_calculated=today.strftime("%Y-%m-%d"),
    )


# ---------- Global Search ----------

@app.get("/search", response_model=schemas.SearchResults)
def global_search(
    q: str,
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    """Recherche globale dans les transactions, catégories et objectifs."""
    if not q or len(q.strip()) < 2:
        return schemas.SearchResults(transactions=[], categories=[], goals=[])

    term = f"%{q.strip().lower()}%"

    # Recherche dans les transactions (note / catégorie)
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
        {
            "id": t.id,
            "date": t.date,
            "amount": float(t.amount),
            "note": t.note,
            "category_name": c.name,
            "category_type": c.type,
        }
        for t, c in tx_results
    ]

    # Recherche dans les catégories
    cat_results = (
        db.query(models.Category)
        .filter(
            models.Category.user_id == current.id,
            func.lower(models.Category.name).like(term),
        )
        .limit(5)
        .all()
    )
    categories = [
        {"id": c.id, "name": c.name, "type": c.type}
        for c in cat_results
    ]

    # Recherche dans les objectifs
    goal_results = (
        db.query(models.Goal)
        .filter(
            models.Goal.user_id == current.id,
            func.lower(models.Goal.title).like(term),
        )
        .limit(5)
        .all()
    )
    goals = [
        {
            "id": g.id,
            "title": g.title,
            "target_amount": float(g.target_amount),
            "current_amount": float(g.current_amount),
        }
        for g in goal_results
    ]

    return schemas.SearchResults(transactions=transactions, categories=categories, goals=goals)


# ---------- DB Migration on startup ----------

from sqlalchemy import text as sql_text

@app.on_event("startup")
def run_migrations():
    """Applique les migrations SQLite au démarrage pour les nouvelles colonnes."""
    from db import engine as db_engine
    with db_engine.connect() as conn:
        # Vérifier et ajouter is_recurring sur transactions
        try:
            conn.execute(sql_text("SELECT is_recurring FROM transactions LIMIT 1"))
        except Exception:
            conn.execute(sql_text("ALTER TABLE transactions ADD COLUMN is_recurring INTEGER NOT NULL DEFAULT 0"))
            conn.commit()

        try:
            conn.execute(sql_text("SELECT recurrence_interval FROM transactions LIMIT 1"))
        except Exception:
            conn.execute(sql_text("ALTER TABLE transactions ADD COLUMN recurrence_interval TEXT"))
            conn.commit()

        # Créer la table budget_alerts si elle n'existe pas
        conn.execute(sql_text("""
            CREATE TABLE IF NOT EXISTS budget_alerts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL REFERENCES users(id),
                category_id INTEGER NOT NULL REFERENCES categories(id),
                monthly_limit NUMERIC(12,2) NOT NULL,
                created_at TEXT NOT NULL
            )
        """))

        # Colonnes 2FA sur users
        try:
            conn.execute(sql_text("SELECT totp_secret FROM users LIMIT 1"))
        except Exception:
            conn.execute(sql_text("ALTER TABLE users ADD COLUMN totp_secret TEXT"))
            conn.execute(sql_text("ALTER TABLE users ADD COLUMN totp_enabled INTEGER NOT NULL DEFAULT 0"))
            conn.commit()

        # Journal d'audit
        conn.execute(sql_text("""
            CREATE TABLE IF NOT EXISTS audit_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL REFERENCES users(id),
                action TEXT NOT NULL,
                details TEXT,
                created_at TEXT NOT NULL
            )
        """))
        conn.commit()

        # Notifications proactives
        conn.execute(sql_text("""
            CREATE TABLE IF NOT EXISTS notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL REFERENCES users(id),
                title TEXT NOT NULL,
                body TEXT NOT NULL,
                type TEXT NOT NULL DEFAULT 'tip',
                is_read INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL
            )
        """))

        # Rapports hebdomadaires
        conn.execute(sql_text("""
            CREATE TABLE IF NOT EXISTS weekly_reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL REFERENCES users(id),
                week_start TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
        """))

        # Mode Couple / Foyer
        conn.execute(sql_text("""
            CREATE TABLE IF NOT EXISTS household_members (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                owner_id INTEGER NOT NULL REFERENCES users(id),
                member_id INTEGER NOT NULL REFERENCES users(id),
                role TEXT NOT NULL DEFAULT 'member',
                joined_at TEXT NOT NULL
            )
        """))
        conn.execute(sql_text("""
            CREATE TABLE IF NOT EXISTS household_invites (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                inviter_id INTEGER NOT NULL REFERENCES users(id),
                invite_email TEXT NOT NULL,
                token TEXT NOT NULL UNIQUE,
                status TEXT NOT NULL DEFAULT 'pending',
                created_at TEXT NOT NULL
            )
        """))
        conn.commit()


# ---------- Notifications Proactives ----------

from services.ai_engine import FinancialAIEngine

@app.get("/notifications", response_model=List[schemas.NotificationOut])
def get_notifications(
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    now_str = datetime.now().isoformat()
    today = dt_date.today().strftime("%Y-%m-%d")
    existing_today = (
        db.query(models.Notification)
        .filter(models.Notification.user_id == current.id, models.Notification.created_at >= today)
        .count()
    )
    if existing_today == 0:
        engine = FinancialAIEngine(db, current.id)
        for n in engine.generate_proactive_notifications():
            db.add(models.Notification(
                user_id=current.id, title=n["title"], body=n["body"],
                type=n["type"], is_read=False, created_at=now_str,
            ))
        db.commit()

    return (
        db.query(models.Notification)
        .filter(models.Notification.user_id == current.id)
        .order_by(models.Notification.created_at.desc())
        .limit(20)
        .all()
    )


@app.post("/notifications/{notif_id}/read")
def mark_notification_read(
    notif_id: int,
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    n = db.query(models.Notification).filter(
        models.Notification.id == notif_id,
        models.Notification.user_id == current.id,
    ).first()
    if not n:
        raise HTTPException(status_code=404, detail="Notification not found")
    n.is_read = True
    db.commit()
    return {"ok": True}


@app.post("/notifications/read-all")
def mark_all_read(
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    db.query(models.Notification).filter(
        models.Notification.user_id == current.id,
        models.Notification.is_read == False,
    ).update({"is_read": True})
    db.commit()
    return {"ok": True}


# ---------- Rapport Hebdomadaire ----------

@app.get("/reports/weekly", response_model=schemas.WeeklyReportOut)
def get_weekly_report(
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    from datetime import timedelta
    now = datetime.now()
    week_start = (now - timedelta(days=now.weekday())).strftime("%Y-%m-%d")
    existing = (
        db.query(models.WeeklyReport)
        .filter(models.WeeklyReport.user_id == current.id, models.WeeklyReport.week_start == week_start)
        .first()
    )
    if existing:
        return existing
    engine = FinancialAIEngine(db, current.id)
    report = models.WeeklyReport(
        user_id=current.id, week_start=week_start,
        content=engine.generate_weekly_report(), created_at=now.isoformat(),
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return report


# ---------- Simulateur "Et si..." ----------

@app.post("/simulator/projection", response_model=schemas.SimulatorResult)
def simulate_projection(
    payload: schemas.SimulatorRequest,
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    engine = FinancialAIEngine(db, current.id)
    curr_start, curr_end = engine._get_current_month_boundaries()
    curr = engine._get_monthly_stats(curr_start, curr_end)
    last_start, last_end = engine._get_last_month_boundaries()
    last = engine._get_monthly_stats(last_start, last_end)

    ref_income = curr["income"] if curr["income"] > 0 else last["income"]
    ref_expenses = curr["expenses"] if curr["expenses"] > 0 else last["expenses"]
    baseline_monthly = max(ref_income - ref_expenses, 0)
    total_cuts = sum(item.get("monthly_amount", 0) for item in payload.expense_cuts)
    optimized_monthly = baseline_monthly + payload.monthly_savings_extra + total_cuts
    monthly_gain = optimized_monthly - baseline_monthly

    r = payload.expected_return / 100 / 12
    projections = []
    for year in range(1, payload.years + 1):
        months = year * 12
        if r > 0:
            base = baseline_monthly * ((1 + r) ** months - 1) / r
            opt = optimized_monthly * ((1 + r) ** months - 1) / r
        else:
            base = baseline_monthly * months
            opt = optimized_monthly * months
        projections.append(schemas.SimulatorProjection(
            year=year, baseline=round(base, 2),
            optimized=round(opt, 2), difference=round(opt - base, 2),
        ))

    total_extra = projections[-1].difference if projections else 0
    summary = (
        f"En économisant {monthly_gain:,.0f}$ de plus par mois sur {payload.years} ans, "
        f"tu accumules {total_extra:,.0f}$ supplémentaires"
        f" (rendement {payload.expected_return:.1f}%/an)."
    )
    return schemas.SimulatorResult(
        projections=projections,
        total_saved_extra=round(total_extra, 2),
        monthly_gain=round(monthly_gain, 2),
        summary=summary,
    )


# ---------- Export CSV ----------

@app.get("/transactions/export/csv")
def export_transactions_csv(
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    txs = (
        db.query(models.Transaction, models.Category)
        .join(models.Category, models.Transaction.category_id == models.Category.id)
        .filter(models.Transaction.user_id == current.id)
        .order_by(models.Transaction.date.desc())
        .all()
    )
    if from_date:
        txs = [(t, c) for t, c in txs if t.date >= from_date]
    if to_date:
        txs = [(t, c) for t, c in txs if t.date <= to_date]

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Date", "Montant", "Type", "Catégorie", "Note"])
    for t, c in txs:
        writer.writerow([
            t.date,
            f"{float(t.amount):.2f}",
            c.type,
            c.name,
            t.note or "",
        ])

    output.seek(0)
    filename = f"nexledger-transactions-{dt_date.today().strftime('%Y-%m-%d')}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# ---------- Défis Financiers ----------

@app.get("/challenges/weekly")
def get_weekly_challenge(
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    """Retourne le défi de la semaine basé sur les habitudes de l'utilisateur."""
    from services.ai_engine import FinancialAIEngine
    from datetime import timedelta

    engine = FinancialAIEngine(db, current.id)
    curr_start, curr_end = engine._get_current_month_boundaries()
    curr = engine._get_monthly_stats(curr_start, curr_end)
    last_start, last_end = engine._get_last_month_boundaries()
    last = engine._get_monthly_stats(last_start, last_end)

    challenges = []

    # Défi basé sur la catégorie de dépense la plus élevée
    if curr["by_category"]:
        top_cat = max(curr["by_category"], key=lambda k: curr["by_category"][k])
        top_amt = curr["by_category"][top_cat]
        target = round(top_amt * 0.8, 2)
        challenges.append({
            "id": "reduce_top",
            "title": f"Réduis tes dépenses {top_cat}",
            "description": f"Tu as dépensé {top_amt:,.0f}$ en {top_cat} ce mois. Vise {target:,.0f}$ la semaine prochaine !",
            "target_amount": target,
            "category": top_cat,
            "type": "reduce",
            "reward": "🏅 Maître de la Discipline",
        })

    # Défi épargne
    ref_income = curr["income"] if curr["income"] > 0 else last["income"]
    if ref_income > 0:
        target_savings = round(ref_income * 0.20 / 4, 2)  # 20% du revenu mensuel / 4 semaines
        challenges.append({
            "id": "save_weekly",
            "title": "Objectif épargne semaine",
            "description": f"Épargne {target_savings:,.0f}$ cette semaine pour atteindre un taux d'épargne de 20%.",
            "target_amount": target_savings,
            "category": None,
            "type": "save",
            "reward": "💰 Épargnant Assidu",
        })

    # Défi zéro dépense superflue
    challenges.append({
        "id": "no_impulse",
        "title": "Semaine sans achat impulsif",
        "description": "Évite tout achat non planifié cette semaine. Chaque achat doit être nécessaire.",
        "target_amount": 0,
        "category": None,
        "type": "behavior",
        "reward": "🧘 Zen Financier",
    })

    # Retourner le défi le plus pertinent (le premier)
    if not challenges:
        return {"challenge": None}

    # Rotation par semaine
    week_num = datetime.now().isocalendar()[1]
    selected = challenges[week_num % len(challenges)]
    return {"challenge": selected, "all_challenges": challenges}


# ---------- Rapport PDF Mensuel ----------

@app.get("/reports/monthly/pdf")
def export_monthly_pdf(
    year: Optional[int] = Query(None),
    month: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    """Génère un rapport HTML/PDF mensuel complet."""
    import calendar as cal_mod
    today = dt_date.today()
    target_year = year or today.year
    target_month = month or today.month
    month_start = f"{target_year}-{target_month:02d}-01"
    last_day = cal_mod.monthrange(target_year, target_month)[1]
    month_end = f"{target_year}-{target_month:02d}-{last_day:02d}"
    month_names = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"]
    month_name = month_names[target_month - 1]

    txs = (
        db.query(models.Transaction, models.Category)
        .join(models.Category, models.Transaction.category_id == models.Category.id)
        .filter(models.Transaction.user_id == current.id, models.Transaction.date >= month_start, models.Transaction.date <= month_end)
        .order_by(models.Transaction.date.desc())
        .all()
    )

    income = sum(float(t.amount) for t, c in txs if c.type == "income")
    expenses = sum(float(t.amount) for t, c in txs if c.type == "expense")
    net = income - expenses
    savings_rate = (net / income * 100) if income > 0 else 0

    by_category: dict = {}
    for t, c in txs:
        if c.type == "expense":
            by_category[c.name] = by_category.get(c.name, 0) + float(t.amount)

    html_rows = "".join(
        f'<tr><td style="padding:6px 8px;border-bottom:1px solid #1e1e2e">{t.date}</td>'
        f'<td style="padding:6px 8px;border-bottom:1px solid #1e1e2e">{t.note or c.name}</td>'
        f'<td style="padding:6px 8px;border-bottom:1px solid #1e1e2e">{c.name}</td>'
        f'<td style="padding:6px 8px;border-bottom:1px solid #1e1e2e;text-align:right;color:{"#22c55e" if c.type=="income" else "#ef4444"};font-weight:600">{"+" if c.type=="income" else "-"}{float(t.amount):,.2f}$</td></tr>'
        for t, c in txs[:50]
    )
    cat_rows = "".join(
        f'<tr><td style="padding:6px 8px;border-bottom:1px solid #1e1e2e">{cat}</td>'
        f'<td style="padding:6px 8px;border-bottom:1px solid #1e1e2e;text-align:right">{amt:,.2f}$</td>'
        f'<td style="padding:6px 8px;border-bottom:1px solid #1e1e2e;text-align:right">{(amt/expenses*100) if expenses>0 else 0:.1f}%</td></tr>'
        for cat, amt in sorted(by_category.items(), key=lambda x: -x[1])[:10]
    )

    html = f"""<!DOCTYPE html><html><head><meta charset="utf-8"><title>NexLedger — Rapport {month_name} {target_year}</title>
<style>
body{{font-family:Arial,sans-serif;background:#0d0d1a;color:#e2e8f0;margin:0;padding:40px;}}
h1{{font-size:26px;color:#a78bfa;margin-bottom:4px;}}
.sub{{color:#64748b;font-size:13px;margin-bottom:28px;}}
.kpi-grid{{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:28px;}}
.kpi{{background:#111827;border:1px solid #1f2937;border-radius:12px;padding:16px;text-align:center;}}
.kpi .label{{font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;}}
.kpi .value{{font-size:22px;font-weight:700;margin-top:4px;}}
.green{{color:#22c55e;}}.red{{color:#ef4444;}}.purple{{color:#a78bfa;}}.blue{{color:#60a5fa;}}
table{{width:100%;border-collapse:collapse;background:#111827;border-radius:10px;overflow:hidden;margin-bottom:20px;}}
th{{background:#1f2937;padding:8px 10px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase;}}
th:last-child,td:last-child{{text-align:right;}}
td{{color:#d1d5db;font-size:13px;}}
h2{{font-size:15px;color:#a78bfa;margin:24px 0 10px;border-left:3px solid #7c3aed;padding-left:10px;}}
.footer{{text-align:center;color:#374151;font-size:11px;margin-top:40px;border-top:1px solid #1f2937;padding-top:20px;}}
@media print{{body{{background:white;color:black;}} .kpi{{border:1px solid #ccc;}} table{{border:1px solid #ccc;}}}}
</style></head><body>
<h1>📊 NexLedger — Rapport Mensuel</h1>
<div class="sub">{month_name} {target_year} &nbsp;·&nbsp; Généré le {today.strftime('%d/%m/%Y')} &nbsp;·&nbsp; {current.email}</div>
<div class="kpi-grid">
  <div class="kpi"><div class="label">Revenus</div><div class="value green">{income:,.0f}$</div></div>
  <div class="kpi"><div class="label">Dépenses</div><div class="value red">{expenses:,.0f}$</div></div>
  <div class="kpi"><div class="label">Net</div><div class="value purple">{net:+,.0f}$</div></div>
  <div class="kpi"><div class="label">Taux épargne</div><div class="value blue">{savings_rate:.1f}%</div></div>
</div>
<h2>Répartition par catégorie</h2>
<table><thead><tr><th>Catégorie</th><th>Montant</th><th>Part</th></tr></thead><tbody>{cat_rows}</tbody></table>
<h2>Transactions ({len(txs)})</h2>
<table><thead><tr><th>Date</th><th>Description</th><th>Catégorie</th><th>Montant</th></tr></thead><tbody>{html_rows}</tbody></table>
{"<p style='color:#6b7280;font-size:12px'>... et " + str(len(txs)-50) + " transactions supplémentaires.</p>" if len(txs)>50 else ""}
<div class="footer">NexLedger — Portfolio FinTech &nbsp;·&nbsp; Ce rapport est généré automatiquement &nbsp;·&nbsp; Pour imprimer en PDF : Ctrl+P</div>
</body></html>"""

    filename = f"nexledger-{month_name.lower()}-{target_year}.html"
    return StreamingResponse(iter([html]), media_type="text/html; charset=utf-8",
        headers={"Content-Disposition": f"inline; filename={filename}"})


# ---------- Helpers audit ----------

def _log_audit(db: Session, user_id: int, action: str, details: str = None):
    db.add(models.AuditLog(
        user_id=user_id, action=action, details=details,
        created_at=datetime.now().isoformat(),
    ))
    db.commit()


# ---------- 2FA TOTP ----------

@app.post("/auth/2fa/setup", response_model=schemas.TwoFASetupOut)
def setup_2fa(
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    """Génère un secret TOTP et retourne l'URI + QR code en base64."""
    try:
        import pyotp, qrcode, base64
        from io import BytesIO
    except ImportError:
        raise HTTPException(status_code=500, detail="pyotp/qrcode non installé. Lancez: pip install pyotp qrcode[pil]")

    secret = pyotp.random_base32()
    current.totp_secret = secret
    db.commit()

    totp = pyotp.TOTP(secret)
    uri = totp.provisioning_uri(name=current.email, issuer_name="NexLedger")

    img = qrcode.make(uri)
    buf = BytesIO()
    img.save(buf, format="PNG")
    qr_b64 = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()

    return schemas.TwoFASetupOut(secret=secret, provisioning_uri=uri, qr_data=qr_b64)


@app.post("/auth/2fa/verify")
def verify_2fa(
    payload: schemas.TwoFAVerifyRequest,
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    """Vérifie le code TOTP et active le 2FA si correct."""
    try:
        import pyotp
    except ImportError:
        raise HTTPException(status_code=500, detail="pyotp non installé")

    if not current.totp_secret:
        raise HTTPException(status_code=400, detail="2FA non initialisé. Appelez /auth/2fa/setup d'abord.")

    totp = pyotp.TOTP(current.totp_secret)
    if not totp.verify(payload.code, valid_window=1):
        raise HTTPException(status_code=400, detail="Code invalide ou expiré.")

    current.totp_enabled = True
    db.commit()
    _log_audit(db, current.id, "2fa_enable")
    return {"ok": True, "message": "2FA activé avec succès."}


@app.post("/auth/2fa/disable")
def disable_2fa(
    payload: schemas.TwoFAVerifyRequest,
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    """Désactive le 2FA après vérification du code."""
    try:
        import pyotp
    except ImportError:
        raise HTTPException(status_code=500, detail="pyotp non installé")

    if not current.totp_enabled or not current.totp_secret:
        raise HTTPException(status_code=400, detail="2FA non activé.")

    totp = pyotp.TOTP(current.totp_secret)
    if not totp.verify(payload.code, valid_window=1):
        raise HTTPException(status_code=400, detail="Code invalide.")

    current.totp_enabled = False
    current.totp_secret = None
    db.commit()
    _log_audit(db, current.id, "2fa_disable")
    return {"ok": True}


@app.get("/auth/2fa/status")
def get_2fa_status(current: models.User = Depends(get_current_user)):
    return {"enabled": current.totp_enabled}


@app.post("/auth/change-password")
def change_password(
    payload: dict,
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    """Change le mot de passe après vérification de l'ancien."""
    old_password = payload.get("old_password", "")
    new_password = payload.get("new_password", "")

    if not old_password or not new_password:
        raise HTTPException(status_code=400, detail="Champs requis manquants.")
    if len(new_password) < 8:
        raise HTTPException(status_code=400, detail="Le nouveau mot de passe doit faire au moins 8 caractères.")
    if not verify_password(old_password, current.hashed_password):
        raise HTTPException(status_code=400, detail="Mot de passe actuel incorrect.")

    current.hashed_password = hash_password(new_password)
    db.commit()
    _log_audit(db, current.id, "password_change")
    return {"ok": True, "message": "Mot de passe modifié avec succès."}


# ---------- Canada REER/CELI Optimizer ----------

# 2024 federal + provincial marginal rates (top bracket approximation per income band)
_PROVINCIAL_RATES = {
    "QC": [(0, 15, 0.15+0.14), (15, 50, 0.205+0.19), (50, 100, 0.26+0.24), (100, 165, 0.29+0.2575), (165, 1e9, 0.33+0.2575)],
    "ON": [(0, 15, 0.15+0.0505), (15, 50, 0.205+0.0915), (50, 100, 0.26+0.1116), (100, 220, 0.29+0.1216), (220, 1e9, 0.33+0.1316)],
    "BC": [(0, 15, 0.15+0.0506), (15, 45, 0.205+0.077), (45, 91, 0.26+0.105), (91, 113, 0.29+0.1229), (113, 1e9, 0.33+0.205)],
    "AB": [(0, 15, 0.15+0.10), (15, 49, 0.205+0.10), (49, 100, 0.26+0.10), (100, 150, 0.29+0.12), (150, 1e9, 0.33+0.15)],
    "other": [(0, 15, 0.15+0.06), (15, 50, 0.205+0.085), (50, 100, 0.26+0.10), (100, 220, 0.29+0.12), (220, 1e9, 0.33+0.15)],
}

def _marginal_rate(income_k: float, province: str) -> float:
    brackets = _PROVINCIAL_RATES.get(province, _PROVINCIAL_RATES["other"])
    for lo, hi, rate in brackets:
        if lo <= income_k < hi:
            return rate
    return 0.53

def _compound(principal: float, annual_rate: float, years: int) -> float:
    return principal * ((1 + annual_rate) ** years)

@app.post("/canada/rrsp-tfsa", response_model=schemas.CanadaOptimizerResult)
def canada_optimizer(
    payload: schemas.CanadaOptimizerRequest,
    current: models.User = Depends(get_current_user),
):
    """Calcule l'allocation optimale REER/CELI selon le profil fiscal canadien."""
    income_k = payload.annual_income / 1000
    province = payload.province if payload.province in _PROVINCIAL_RATES else "other"
    marginal = _marginal_rate(income_k, province)

    # REER room: 18% of previous year income, capped at $31,560 (2024 limit)
    rrsp_room = payload.rrsp_room if payload.rrsp_room is not None else min(payload.annual_income * 0.18, 31560)
    # TFSA room: $7,000/year 2024. Cumulative since 2009 (if age >= 18 in 2009)
    years_eligible = max(0, min(payload.age - 18, 16))  # 2009–2024
    tfsa_room = 7000 + years_eligible * 6500  # simplified cumulative

    available = payload.available_savings
    # Recommended: maximize REER first if marginal rate > 30%, else TFSA first
    if marginal >= 0.30:
        rec_rrsp = min(available, rrsp_room)
        rec_tfsa = min(available - rec_rrsp, tfsa_room)
    else:
        rec_tfsa = min(available, tfsa_room)
        rec_rrsp = min(available - rec_tfsa, rrsp_room)

    tax_refund = rec_rrsp * marginal

    # Scenarios
    def make_scenario(name: str, rrsp: float, tfsa: float) -> schemas.CanadaScenario:
        refund = rrsp * marginal
        total_invested = rrsp + tfsa
        # RRSP grows tax-deferred at 6%, taxed at 25% on withdrawal
        rrsp_10 = _compound(rrsp, 0.06, 10) * 0.75
        rrsp_20 = _compound(rrsp, 0.06, 20) * 0.75
        rrsp_30 = _compound(rrsp, 0.06, 30) * 0.75
        # TFSA grows tax-free at 5%
        tfsa_10 = _compound(tfsa, 0.05, 10)
        tfsa_20 = _compound(tfsa, 0.05, 20)
        tfsa_30 = _compound(tfsa, 0.05, 30)
        return schemas.CanadaScenario(
            name=name,
            rrsp_contribution=rrsp,
            tfsa_contribution=tfsa,
            tax_refund=refund,
            net_cost=rrsp + tfsa - refund,
            projected_10y=rrsp_10 + tfsa_10,
            projected_20y=rrsp_20 + tfsa_20,
            projected_30y=rrsp_30 + tfsa_30,
        )

    scenarios = [
        make_scenario("Optimisé (recommandé)", rec_rrsp, rec_tfsa),
        make_scenario("Tout en REER", min(available, rrsp_room), 0),
        make_scenario("Tout en CELI", 0, min(available, tfsa_room)),
        make_scenario("50% / 50%", min(available * 0.5, rrsp_room), min(available * 0.5, tfsa_room)),
    ]

    tips: list[str] = []
    if marginal >= 0.40:
        tips.append("Votre taux marginal est élevé (≥40%) — priorisez le REER pour réduire votre impôt immédiatement.")
    elif marginal < 0.25:
        tips.append("Votre taux marginal est bas — le CELI est souvent plus avantageux car les retraits sont non imposables.")
    if payload.age < 35:
        tips.append("À votre âge, le CELI est très puissant grâce à la croissance composée sur plusieurs décennies.")
    if payload.age >= 50:
        tips.append("À 71 ans, le REER doit être converti en FERR. Planifiez vos retraits dès maintenant.")
    if rec_rrsp > 0:
        tips.append(f"Votre remboursement d'impôt estimé pour ce REER : ${tax_refund:,.0f} — réinvestissez-le dans votre CELI!")
    if payload.province == "QC":
        tips.append("Au Québec, vous bénéficiez aussi d'une déduction provinciale sur le REER — double avantage fiscal.")

    return schemas.CanadaOptimizerResult(
        marginal_rate=round(marginal * 100, 1),
        rrsp_room=rrsp_room,
        tfsa_room=tfsa_room,
        recommended_rrsp=rec_rrsp,
        recommended_tfsa=rec_tfsa,
        tax_refund=tax_refund,
        scenarios=scenarios,
        tips=tips,
    )


# ---------- Journal d'audit ----------

@app.get("/audit-logs", response_model=List[schemas.AuditLogOut])
def get_audit_logs(
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    return (
        db.query(models.AuditLog)
        .filter(models.AuditLog.user_id == current.id)
        .order_by(models.AuditLog.created_at.desc())
        .limit(50)
        .all()
    )


# ---------- Mode Couple / Foyer ----------

@app.post("/household/invite")
def invite_to_household(
    payload: schemas.HouseholdInviteRequest,
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    """Envoie une invitation à rejoindre le foyer partagé."""
    now = datetime.utcnow().isoformat()
    token = secrets.token_urlsafe(32)
    invite = models.HouseholdInvite(
        inviter_id=current.id,
        invite_email=payload.email.lower(),
        token=token,
        status="pending",
        created_at=now,
    )
    db.add(invite)
    db.commit()
    db.refresh(invite)
    return {"message": f"Invitation envoyée à {payload.email}", "token": token}


@app.post("/household/accept/{token}")
def accept_household_invite(
    token: str,
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    """Accepte une invitation et rejoint le foyer."""
    invite = db.query(models.HouseholdInvite).filter(
        models.HouseholdInvite.token == token,
        models.HouseholdInvite.status == "pending",
    ).first()
    if not invite:
        raise HTTPException(status_code=404, detail="Invitation introuvable ou déjà utilisée.")
    if current.email.lower() != invite.invite_email.lower():
        raise HTTPException(status_code=403, detail="Cette invitation ne vous est pas destinée.")

    now = datetime.utcnow().isoformat()
    member = models.HouseholdMember(
        owner_id=invite.inviter_id,
        member_id=current.id,
        role="member",
        joined_at=now,
    )
    db.add(member)
    invite.status = "accepted"
    db.commit()
    return {"message": "Vous avez rejoint le foyer avec succès."}


@app.get("/household", response_model=schemas.HouseholdOut)
def get_household(
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    """Retourne le foyer de l'utilisateur (membres + invitations en attente)."""
    # Members where current user is owner
    members_db = db.query(models.HouseholdMember).filter(
        models.HouseholdMember.owner_id == current.id
    ).all()
    members_out = []
    for m in members_db:
        user = db.query(models.User).filter(models.User.id == m.member_id).first()
        if user:
            members_out.append(schemas.HouseholdMemberOut(
                member_id=m.member_id,
                email=user.email,
                role=m.role,
                joined_at=m.joined_at,
            ))

    pending = db.query(models.HouseholdInvite).filter(
        models.HouseholdInvite.inviter_id == current.id,
        models.HouseholdInvite.status == "pending",
    ).all()

    return schemas.HouseholdOut(
        owner_email=current.email,
        members=members_out,
        pending_invites=pending,
    )


@app.delete("/household/members/{member_id}")
def remove_household_member(
    member_id: int,
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    """Retire un membre du foyer."""
    member = db.query(models.HouseholdMember).filter(
        models.HouseholdMember.owner_id == current.id,
        models.HouseholdMember.member_id == member_id,
    ).first()
    if not member:
        raise HTTPException(status_code=404, detail="Membre introuvable.")
    db.delete(member)
    db.commit()
    return {"message": "Membre retiré du foyer."}


@app.get("/household/shared-dashboard")
def household_shared_dashboard(
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    """Tableau de bord consolidé: transactions de tous les membres du foyer."""
    # Find all member IDs in user's household
    members = db.query(models.HouseholdMember).filter(
        models.HouseholdMember.owner_id == current.id
    ).all()
    member_ids = [current.id] + [m.member_id for m in members]

    # Also check if current user is a member of someone else's household
    as_member = db.query(models.HouseholdMember).filter(
        models.HouseholdMember.member_id == current.id
    ).first()
    if as_member:
        owner_members = db.query(models.HouseholdMember).filter(
            models.HouseholdMember.owner_id == as_member.owner_id
        ).all()
        member_ids = list(set(member_ids + [as_member.owner_id] + [m.member_id for m in owner_members]))

    # Aggregate transactions for the current month
    today = dt_date.today()
    month_prefix = f"{today.year}-{str(today.month).zfill(2)}"

    txs = (
        db.query(models.Transaction)
        .filter(
            models.Transaction.user_id.in_(member_ids),
            models.Transaction.date.startswith(month_prefix),
        )
        .all()
    )

    cat_cache: dict[int, str] = {}
    def _cat_type(cat_id: int) -> str:
        if cat_id not in cat_cache:
            c = db.query(models.Category).filter(models.Category.id == cat_id).first()
            cat_cache[cat_id] = c.type if c else "expense"
        return cat_cache[cat_id]

    total_income = sum(float(t.amount) for t in txs if _cat_type(t.category_id) == "income")
    total_expense = sum(float(t.amount) for t in txs if _cat_type(t.category_id) == "expense")

    # Get member names
    users_info = []
    for uid in member_ids:
        u = db.query(models.User).filter(models.User.id == uid).first()
        if u:
            user_txs = [t for t in txs if t.user_id == uid]
            users_info.append({
                "user_id": uid,
                "email": u.email,
                "tx_count": len(user_txs),
                "total_spent": sum(float(t.amount) for t in user_txs),
            })

    return {
        "member_count": len(member_ids),
        "month": month_prefix,
        "total_income": total_income,
        "total_expense": total_expense,
        "net": total_income - total_expense,
        "members": users_info,
    }


# ---------- Score Communautaire ----------

@app.get("/community/benchmark", response_model=schemas.CommunityBenchmark)
def community_benchmark(
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    """Compare les habitudes de l'utilisateur à la moyenne anonyme des autres."""
    today = dt_date.today()
    month_prefix = f"{today.year}-{str(today.month).zfill(2)}"

    def _get_user_stats(user_id: int):
        txs = db.query(models.Transaction).filter(
            models.Transaction.user_id == user_id,
            models.Transaction.date.startswith(month_prefix),
        ).all()
        income = 0.0
        expense = 0.0
        for t in txs:
            cat = db.query(models.Category).filter(models.Category.id == t.category_id).first()
            if cat and cat.type == "income":
                income += float(t.amount)
            else:
                expense += float(t.amount)
        return income, expense

    # Current user stats
    my_income, my_expense = _get_user_stats(current.id)
    my_savings_rate = ((my_income - my_expense) / my_income * 100) if my_income > 0 else 0
    my_expense_ratio = (my_expense / my_income * 100) if my_income > 0 else 100

    # Anonymous aggregate of all other users
    all_users = db.query(models.User).filter(models.User.id != current.id).all()
    all_savings_rates = []
    all_expense_ratios = []
    for u in all_users:
        inc, exp = _get_user_stats(u.id)
        if inc > 0:
            all_savings_rates.append((inc - exp) / inc * 100)
            all_expense_ratios.append(exp / inc * 100)

    # Fallback if no other users
    if not all_savings_rates:
        all_savings_rates = [15.0, 22.0, 8.0, 30.0, 5.0]
        all_expense_ratios = [85.0, 78.0, 92.0, 70.0, 95.0]

    avg_savings = sum(all_savings_rates) / len(all_savings_rates)
    avg_expense = sum(all_expense_ratios) / len(all_expense_ratios)

    # Percentile: how many users have a lower savings rate than you
    lower = sum(1 for r in all_savings_rates if r < my_savings_rate)
    percentile = int(lower / len(all_savings_rates) * 100)

    # Score 0-100
    score = min(100, max(0, int(my_savings_rate * 2)))

    # Badge
    if score >= 80:
        badge = "🏆 Expert Épargne"
    elif score >= 60:
        badge = "🥈 Épargnant Solide"
    elif score >= 40:
        badge = "🥉 En Progression"
    elif score >= 20:
        badge = "📈 Débutant"
    else:
        badge = "💡 À Améliorer"

    tips = []
    if my_savings_rate < avg_savings:
        diff = avg_savings - my_savings_rate
        tips.append(f"Votre taux d'épargne ({my_savings_rate:.1f}%) est {diff:.1f}% sous la moyenne. Essayez d'automatiser vos virements épargne.")
    else:
        tips.append(f"Bravo ! Votre taux d'épargne ({my_savings_rate:.1f}%) dépasse la moyenne de {my_savings_rate - avg_savings:.1f}%.")
    if my_expense_ratio > avg_expense:
        tips.append("Vos dépenses représentent une part plus importante de vos revenus que la moyenne — passez en revue vos abonnements et dépenses variables.")
    if percentile >= 75:
        tips.append("Vous faites partie du top 25% des épargnants de la communauté NexLedger !")
    tips.append("Conseil : automatisez un virement de 10% de chaque paie vers un CELI dès réception.")

    return schemas.CommunityBenchmark(
        your_savings_rate=round(my_savings_rate, 1),
        avg_savings_rate=round(avg_savings, 1),
        your_expense_ratio=round(my_expense_ratio, 1),
        avg_expense_ratio=round(avg_expense, 1),
        your_score=score,
        percentile=percentile,
        badge=badge,
        tips=tips,
    )


# ---------- Connexion Bancaire (Plaid / Démo) ----------

@app.get("/bank/status")
def bank_status():
    """Indique si l'intégration Plaid est configurée ou en mode démo."""
    return {
        "demo_mode": bank_service.DEMO_MODE,
        "env": bank_service.PLAID_ENV,
    }


@app.get("/bank/link-token", response_model=schemas.BankLinkTokenOut)
def get_link_token(current: models.User = Depends(get_current_user)):
    """Crée un Plaid link_token pour ouvrir le widget de connexion."""
    if bank_service.DEMO_MODE:
        token = bank_service.create_demo_link_token(current.id)
        return schemas.BankLinkTokenOut(
            link_token=token,
            demo_mode=True,
            demo_banks=bank_service._DEMO_BANKS,
        )
    try:
        token = bank_service.create_link_token(current.id)
        return schemas.BankLinkTokenOut(link_token=token, demo_mode=False)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Plaid error: {str(e)}")


@app.post("/bank/exchange-token", response_model=schemas.BankConnectionOut)
def exchange_token(
    payload: schemas.BankExchangeRequest,
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    """Échange le public_token contre un access_token et sauvegarde la connexion."""
    if bank_service.DEMO_MODE:
        data = bank_service.exchange_demo_token(payload.public_token, payload.institution_id or "demo_rbc")
    else:
        try:
            data = bank_service.exchange_public_token(payload.public_token)
            data["institution_name"] = bank_service.get_institution_name(data["access_token"])
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Plaid error: {str(e)}")

    # Check if already connected
    existing = db.query(models.BankConnection).filter(
        models.BankConnection.item_id == data["item_id"],
        models.BankConnection.user_id == current.id,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Cette banque est déjà connectée.")

    conn = models.BankConnection(
        user_id=current.id,
        institution_name=data["institution_name"],
        access_token=data["access_token"],
        item_id=data["item_id"],
    )
    db.add(conn)
    db.commit()
    db.refresh(conn)

    # Auto-sync initial transactions in background
    _sync_bank_connection(conn.id, db, current)

    return schemas.BankConnectionOut(id=conn.id, institution_name=conn.institution_name, item_id=conn.item_id, tx_count=0)


def _sync_bank_connection(connection_id: int, db: Session, current: models.User) -> schemas.BankSyncResult:
    """Synchronise les transactions depuis Plaid/démo pour une connexion."""
    conn = db.query(models.BankConnection).filter(
        models.BankConnection.id == connection_id,
        models.BankConnection.user_id == current.id,
    ).first()
    if not conn:
        raise HTTPException(status_code=404, detail="Connexion bancaire introuvable.")

    if bank_service.DEMO_MODE:
        raw_txs, new_cursor = bank_service.get_demo_transactions(conn.cursor)
    else:
        try:
            raw_txs, new_cursor = bank_service.sync_transactions(conn.access_token, conn.cursor)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Plaid sync error: {str(e)}")

    # Find or create a default "Banque" category for uncategorized imports
    def _get_or_create_category(db: Session, user_id: int, name: str, cat_type: str) -> models.Category:
        cat = db.query(models.Category).filter(
            models.Category.user_id == user_id,
            models.Category.name == name,
        ).first()
        if not cat:
            cat = models.Category(user_id=user_id, name=name, type=cat_type)
            db.add(cat)
            db.flush()
        return cat

    added = 0
    skipped = 0
    for tx in raw_txs:
        # Deduplication by external_id
        if db.query(models.Transaction).filter(
            models.Transaction.external_id == tx["transaction_id"]
        ).first():
            skipped += 1
            continue

        cat_name = tx.get("category_hint") or "Importé"
        cat_type = tx.get("tx_type", "expense")
        cat = _get_or_create_category(db, current.id, cat_name, cat_type)

        amount = abs(float(tx["amount"]))
        new_tx = models.Transaction(
            user_id=current.id,
            category_id=cat.id,
            amount=amount,
            date=tx["date"],
            note=tx["name"],
            external_id=tx["transaction_id"],
            bank_connection_id=conn.id,
        )
        db.add(new_tx)
        added += 1

    conn.cursor = new_cursor
    db.commit()

    return schemas.BankSyncResult(added=added, skipped=skipped, institution_name=conn.institution_name)


@app.post("/bank/sync/{connection_id}", response_model=schemas.BankSyncResult)
def sync_bank(
    connection_id: int,
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    """Synchronise les nouvelles transactions d'une connexion bancaire."""
    return _sync_bank_connection(connection_id, db, current)


@app.post("/bank/sync-all")
def sync_all_banks(
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    """Synchronise toutes les connexions bancaires de l'utilisateur."""
    connections = db.query(models.BankConnection).filter(
        models.BankConnection.user_id == current.id
    ).all()
    results = []
    for conn in connections:
        try:
            r = _sync_bank_connection(conn.id, db, current)
            results.append({"id": conn.id, "institution": conn.institution_name, "added": r.added})
        except Exception as e:
            results.append({"id": conn.id, "institution": conn.institution_name, "error": str(e)})
    return {"synced": len(results), "results": results}


@app.get("/bank/connections", response_model=List[schemas.BankConnectionOut])
def list_bank_connections(
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    """Liste toutes les connexions bancaires avec le nombre de transactions."""
    connections = db.query(models.BankConnection).filter(
        models.BankConnection.user_id == current.id
    ).all()
    result = []
    for conn in connections:
        tx_count = db.query(models.Transaction).filter(
            models.Transaction.bank_connection_id == conn.id
        ).count()
        result.append(schemas.BankConnectionOut(
            id=conn.id,
            institution_name=conn.institution_name,
            item_id=conn.item_id,
            tx_count=tx_count,
        ))
    return result


@app.delete("/bank/connections/{connection_id}")
def delete_bank_connection(
    connection_id: int,
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    """Déconnecte une banque et supprime les transactions importées."""
    conn = db.query(models.BankConnection).filter(
        models.BankConnection.id == connection_id,
        models.BankConnection.user_id == current.id,
    ).first()
    if not conn:
        raise HTTPException(status_code=404, detail="Connexion introuvable.")

    # Delete imported transactions
    db.query(models.Transaction).filter(
        models.Transaction.bank_connection_id == connection_id
    ).delete()
    db.delete(conn)
    db.commit()
    return {"message": f"{conn.institution_name} déconnectée avec succès."}
