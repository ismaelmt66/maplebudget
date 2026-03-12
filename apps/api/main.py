# ruff: noqa: E402
"""Application FastAPI pour NexLedger.

Ce module définit tous les endpoints HTTP utilisés par le front-end. La logique
reste simple et centrée sur les opérations CRUD de base pour utilisateurs,
catégories, transactions, objectifs et le tableau de bord.
"""

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional, List
from datetime import date as dt_date, datetime
from collections import defaultdict

from db import get_db
import models
import schemas
from auth import hash_password, verify_password, create_access_token, get_current_user
from routers import subscriptions as subscriptions_router

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
    return schemas.TokenOut(access_token=token)


@app.get("/auth/me", response_model=schemas.UserOut)
def me(current: models.User = Depends(get_current_user)):
    """Renvoie des informations sur l’utilisateur authentifié."""
    return current


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

    return schemas.HealthScoreOut(
        score=total_score,
        grade=grade,
        breakdown=schemas.HealthScoreBreakdown(
            savings_rate=round(savings_score, 1),
            budget_compliance=round(budget_score, 1),
            emergency_fund=round(emergency_score, 1),
            goal_progress=round(goal_score, 1),
            diversification=0.0,
        ),
        insights=insights,
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
        conn.commit()
