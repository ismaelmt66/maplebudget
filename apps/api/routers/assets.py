from datetime import date as dt_date, datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models
import schemas
from auth import get_current_user
from cache import get_ai_analysis_cache, invalidate_ai_analysis_cache, set_ai_analysis_cache
from db import get_db
from pagination import PaginationParams, paginated_response

router = APIRouter()


@router.post("/assets", response_model=schemas.AssetOut)
def create_asset(
    payload: schemas.AssetCreate,
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    today_str = dt_date.today().strftime("%Y-%m-%d")
    a = models.Asset(
        name=payload.name, type=payload.type, balance=payload.balance, user_id=current.id,
    )
    db.add(a)
    db.commit()
    db.refresh(a)
    h = models.AssetHistory(asset_id=a.id, date=today_str, balance=payload.balance)
    db.add(h)
    db.commit()
    db.refresh(a)
    invalidate_ai_analysis_cache(current.id)
    return a


@router.get("/assets")
def list_assets(
    params: PaginationParams = Depends(),
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    query = db.query(models.Asset).filter(models.Asset.user_id == current.id).order_by(models.Asset.id.desc())
    return paginated_response(query, params)


# ---------- Smart Allocation Rules (MUST be before /assets/{asset_id}) ----------

@router.get("/assets/allocation-rules", response_model=list[schemas.AllocationRuleOut])
def list_allocation_rules(
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    rules = db.query(models.AllocationRule).filter(
        models.AllocationRule.user_id == current.id
    ).all()
    result = []
    for r in rules:
        result.append(schemas.AllocationRuleOut(
            id=r.id, name=r.name, source_type=r.source_type,
            source_category_id=r.source_category_id,
            source_category_name=r.source_category.name if r.source_category else None,
            target_asset_id=r.target_asset_id,
            target_asset_name=r.target_asset.name if r.target_asset else "?",
            allocation_percent=float(r.allocation_percent), is_active=r.is_active,
        ))
    return result


@router.post("/assets/allocation-rules", response_model=schemas.AllocationRuleOut, status_code=201)
def create_allocation_rule(
    payload: schemas.AllocationRuleCreate,
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    asset = db.query(models.Asset).filter(
        models.Asset.id == payload.target_asset_id, models.Asset.user_id == current.id
    ).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Target asset not found")
    rule = models.AllocationRule(
        user_id=current.id, name=payload.name, source_type=payload.source_type,
        source_category_id=payload.source_category_id,
        target_asset_id=payload.target_asset_id,
        allocation_percent=payload.allocation_percent, is_active=True,
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return schemas.AllocationRuleOut(
        id=rule.id, name=rule.name, source_type=rule.source_type,
        source_category_id=rule.source_category_id,
        source_category_name=rule.source_category.name if rule.source_category else None,
        target_asset_id=rule.target_asset_id, target_asset_name=asset.name,
        allocation_percent=float(rule.allocation_percent), is_active=rule.is_active,
    )


@router.post("/assets/allocation-rules/simulate", response_model=list[schemas.AllocationSimulateResult])
def simulate_allocation(
    payload: schemas.AllocationSimulateRequest,
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    rules = db.query(models.AllocationRule).filter(
        models.AllocationRule.user_id == current.id, models.AllocationRule.is_active,
    ).all()
    results = []
    for r in rules:
        allocated = round(payload.income_amount * float(r.allocation_percent) / 100, 2)
        results.append(schemas.AllocationSimulateResult(
            rule_id=r.id, rule_name=r.name,
            target_asset_name=r.target_asset.name if r.target_asset else "?",
            allocated_amount=allocated, percent=float(r.allocation_percent),
        ))
    return results


@router.post("/assets/allocation-rules/apply")
def apply_allocation(
    payload: schemas.AllocationApplyRequest,
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    rules = db.query(models.AllocationRule).filter(
        models.AllocationRule.user_id == current.id, models.AllocationRule.is_active,
    ).all()
    applied = []
    today_str = dt_date.today().isoformat()
    for r in rules:
        if r.source_type == "category":
            if payload.income_category_id is None or r.source_category_id != payload.income_category_id:
                continue
        allocated = round(payload.income_amount * float(r.allocation_percent) / 100, 2)
        if allocated <= 0:
            continue
        asset = db.query(models.Asset).filter(
            models.Asset.id == r.target_asset_id, models.Asset.user_id == current.id,
        ).first()
        if not asset:
            continue
        new_balance = float(asset.balance) + allocated
        asset.balance = new_balance
        db.add(models.AssetHistory(asset_id=asset.id, date=today_str, balance=new_balance))
        applied.append({"rule_name": r.name, "asset_name": asset.name, "allocated_amount": allocated, "new_balance": new_balance})
    db.commit()
    return {"applied": applied, "count": len(applied), "total_allocated": sum(a["allocated_amount"] for a in applied)}


@router.put("/assets/allocation-rules/{rule_id}", response_model=schemas.AllocationRuleOut)
def update_allocation_rule(
    rule_id: int,
    payload: schemas.AllocationRuleUpdate,
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    rule = db.query(models.AllocationRule).filter(
        models.AllocationRule.id == rule_id, models.AllocationRule.user_id == current.id
    ).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(rule, field, value)
    db.commit()
    db.refresh(rule)
    return schemas.AllocationRuleOut(
        id=rule.id, name=rule.name, source_type=rule.source_type,
        source_category_id=rule.source_category_id,
        source_category_name=rule.source_category.name if rule.source_category else None,
        target_asset_id=rule.target_asset_id,
        target_asset_name=rule.target_asset.name if rule.target_asset else "?",
        allocation_percent=float(rule.allocation_percent), is_active=rule.is_active,
    )


@router.delete("/assets/allocation-rules/{rule_id}", status_code=204)
def delete_allocation_rule(
    rule_id: int,
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    rule = db.query(models.AllocationRule).filter(
        models.AllocationRule.id == rule_id, models.AllocationRule.user_id == current.id
    ).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    db.delete(rule)
    db.commit()


@router.get("/assets/ai-analysis")
def ai_patrimoine_analysis(
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    # Check cache first
    cached_report = get_ai_analysis_cache(current.id)
    if cached_report:
        return {"report": cached_report}

    # If cache miss, generate, then cache the new report
    from services.ai_engine import FinancialAIEngine
    engine = FinancialAIEngine(db=db, user_id=current.id)
    report = engine.analyze_patrimoine()
    set_ai_analysis_cache(current.id, report)
    
    # Log this event for achievements
    if not db.query(models.AuditLog).filter(models.AuditLog.user_id == current.id, models.AuditLog.action == "ai_analysis_run").first():
        db.add(models.AuditLog(user_id=current.id, action="ai_analysis_run", created_at=datetime.now(timezone.utc).isoformat()))
        db.commit()
    
    return {"report": report}


# ---------- Assets: parameterized routes (AFTER specific routes) ----------

@router.put("/assets/{asset_id}", response_model=schemas.AssetOut)
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
        if float(a.balance) != float(payload.balance):
            balance_changed = True
            new_balance = float(payload.balance)
        a.balance = payload.balance
    if balance_changed:
        today_str = dt_date.today().strftime("%Y-%m-%d")
        h = db.query(models.AssetHistory).filter(
            models.AssetHistory.asset_id == a.id, models.AssetHistory.date == today_str
        ).first()
        if h:
            h.balance = new_balance
        else:
            new_h = models.AssetHistory(asset_id=a.id, date=today_str, balance=new_balance)
            db.add(new_h)
    db.commit()
    db.refresh(a)
    invalidate_ai_analysis_cache(current.id)
    return a


@router.delete("/assets/{asset_id}")
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
    invalidate_ai_analysis_cache(current.id)
    return {"deleted": True, "id": asset_id}
