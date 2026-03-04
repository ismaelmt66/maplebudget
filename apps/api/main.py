"""Application FastAPI pour NexLeger.

Ce module définit tous les endpoints HTTP utilisés par le front-end. La logique
reste simple et centrée sur les opérations CRUD de base pour utilisateurs,
catégories, transactions, objectifs et le tableau de bord.
"""

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy import func
from jose import JWTError
from typing import Optional, List
from datetime import date as dt_date, datetime
from collections import defaultdict

from db import get_db
import models
import schemas
from auth import hash_password, verify_password, create_access_token, decode_token

app = FastAPI(title="NexLeger API", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1|(\d{1,3}\.){3}\d{1,3}):300[0-9]",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/token")


@app.get("/health")
def health():
    """Vérification basique ; utile pour les load‑balancers ou l’uptime."""
    return {"status": "ok"}


# ---------- Aides d’authentification ----------

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> models.User:
    """Extrait et valide l’utilisateur courant à partir du jeton bearer.

    Lève une erreur 401 si le jeton est invalide ou si l’utilisateur n’existe pas.
    """
    try:
        sub = decode_token(token)  # sub = identifiant utilisateur (chaîne)
        user_id = int(sub)
    except (JWTError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid token")

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


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
        models.AllocationRule.is_active == True,
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
        models.AllocationRule.is_active == True,
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
