import secrets
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import date as dt_date, datetime

from db import get_db
import models
import schemas
from auth import get_current_user
from services import bank_service

router = APIRouter()


# ---------- Mode Couple / Foyer ----------

@router.post("/household/invite")
def invite_to_household(
    payload: schemas.HouseholdInviteRequest,
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    now = datetime.utcnow().isoformat()
    token = secrets.token_urlsafe(32)
    invite = models.HouseholdInvite(
        inviter_id=current.id, invite_email=payload.email.lower(),
        token=token, status="pending", created_at=now,
    )
    db.add(invite)
    db.commit()
    db.refresh(invite)
    return {"message": f"Invitation envoyée à {payload.email}", "token": token}


@router.post("/household/accept/{token}")
def accept_household_invite(
    token: str,
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    invite = db.query(models.HouseholdInvite).filter(
        models.HouseholdInvite.token == token, models.HouseholdInvite.status == "pending",
    ).first()
    if not invite:
        raise HTTPException(status_code=404, detail="Invitation introuvable ou déjà utilisée.")
    if current.email.lower() != invite.invite_email.lower():
        raise HTTPException(status_code=403, detail="Cette invitation ne vous est pas destinée.")
    now = datetime.utcnow().isoformat()
    member = models.HouseholdMember(
        owner_id=invite.inviter_id, member_id=current.id, role="member", joined_at=now,
    )
    db.add(member)
    invite.status = "accepted"
    db.commit()
    return {"message": "Vous avez rejoint le foyer avec succès."}


@router.get("/household", response_model=schemas.HouseholdOut)
def get_household(
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    members_db = db.query(models.HouseholdMember).filter(
        models.HouseholdMember.owner_id == current.id
    ).all()
    members_out = []
    for m in members_db:
        user = db.query(models.User).filter(models.User.id == m.member_id).first()
        if user:
            members_out.append(schemas.HouseholdMemberOut(
                member_id=m.member_id, email=user.email, role=m.role, joined_at=m.joined_at,
            ))
    pending = db.query(models.HouseholdInvite).filter(
        models.HouseholdInvite.inviter_id == current.id, models.HouseholdInvite.status == "pending",
    ).all()
    return schemas.HouseholdOut(
        owner_email=current.email, members=members_out, pending_invites=pending,
    )


@router.delete("/household/members/{member_id}")
def remove_household_member(
    member_id: int,
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    member = db.query(models.HouseholdMember).filter(
        models.HouseholdMember.owner_id == current.id, models.HouseholdMember.member_id == member_id,
    ).first()
    if not member:
        raise HTTPException(status_code=404, detail="Membre introuvable.")
    db.delete(member)
    db.commit()
    return {"message": "Membre retiré du foyer."}


@router.get("/household/shared-dashboard")
def household_shared_dashboard(
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    members = db.query(models.HouseholdMember).filter(
        models.HouseholdMember.owner_id == current.id
    ).all()
    member_ids = [current.id] + [m.member_id for m in members]
    as_member = db.query(models.HouseholdMember).filter(
        models.HouseholdMember.member_id == current.id
    ).first()
    if as_member:
        owner_members = db.query(models.HouseholdMember).filter(
            models.HouseholdMember.owner_id == as_member.owner_id
        ).all()
        member_ids = list(set(member_ids + [as_member.owner_id] + [m.member_id for m in owner_members]))
    today = dt_date.today()
    month_prefix = f"{today.year}-{str(today.month).zfill(2)}"
    txs = (
        db.query(models.Transaction)
        .filter(models.Transaction.user_id.in_(member_ids), models.Transaction.date.startswith(month_prefix))
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
    users_info = []
    for uid in member_ids:
        u = db.query(models.User).filter(models.User.id == uid).first()
        if u:
            user_txs = [t for t in txs if t.user_id == uid]
            users_info.append({
                "user_id": uid, "email": u.email,
                "tx_count": len(user_txs),
                "total_spent": sum(float(t.amount) for t in user_txs),
            })
    return {
        "member_count": len(member_ids), "month": month_prefix,
        "total_income": total_income, "total_expense": total_expense,
        "net": total_income - total_expense, "members": users_info,
    }


# ---------- Score Communautaire ----------

@router.get("/community/benchmark", response_model=schemas.CommunityBenchmark)
def community_benchmark(
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    today = dt_date.today()
    month_prefix = f"{today.year}-{str(today.month).zfill(2)}"
    def _get_user_stats(user_id: int):
        txs = db.query(models.Transaction).filter(
            models.Transaction.user_id == user_id, models.Transaction.date.startswith(month_prefix),
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
    my_income, my_expense = _get_user_stats(current.id)
    my_savings_rate = ((my_income - my_expense) / my_income * 100) if my_income > 0 else 0
    my_expense_ratio = (my_expense / my_income * 100) if my_income > 0 else 100
    all_users = db.query(models.User).filter(models.User.id != current.id).all()
    all_savings_rates = []
    all_expense_ratios = []
    for u in all_users:
        inc, exp = _get_user_stats(u.id)
        if inc > 0:
            all_savings_rates.append((inc - exp) / inc * 100)
            all_expense_ratios.append(exp / inc * 100)
    if not all_savings_rates:
        all_savings_rates = [15.0, 22.0, 8.0, 30.0, 5.0]
        all_expense_ratios = [85.0, 78.0, 92.0, 70.0, 95.0]
    avg_savings = sum(all_savings_rates) / len(all_savings_rates)
    avg_expense = sum(all_expense_ratios) / len(all_expense_ratios)
    lower = sum(1 for r in all_savings_rates if r < my_savings_rate)
    percentile = int(lower / len(all_savings_rates) * 100)
    score = min(100, max(0, int(my_savings_rate * 2)))
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
        your_savings_rate=round(my_savings_rate, 1), avg_savings_rate=round(avg_savings, 1),
        your_expense_ratio=round(my_expense_ratio, 1), avg_expense_ratio=round(avg_expense, 1),
        your_score=score, percentile=percentile, badge=badge, tips=tips,
    )


# ---------- Connexion Bancaire ----------

@router.get("/bank/status")
def bank_status():
    return {"demo_mode": bank_service.DEMO_MODE, "env": bank_service.PLAID_ENV}


@router.get("/bank/link-token", response_model=schemas.BankLinkTokenOut)
def get_link_token(current: models.User = Depends(get_current_user)):
    if bank_service.DEMO_MODE:
        token = bank_service.create_demo_link_token(current.id)
        return schemas.BankLinkTokenOut(link_token=token, demo_mode=True, demo_banks=bank_service._DEMO_BANKS)
    try:
        token = bank_service.create_link_token(current.id)
        return schemas.BankLinkTokenOut(link_token=token, demo_mode=False)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Plaid error: {str(e)}")


@router.post("/bank/exchange-token", response_model=schemas.BankConnectionOut)
def exchange_token(
    payload: schemas.BankExchangeRequest,
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    if bank_service.DEMO_MODE:
        data = bank_service.exchange_demo_token(payload.public_token, payload.institution_id or "demo_rbc")
    else:
        try:
            data = bank_service.exchange_public_token(payload.public_token)
            data["institution_name"] = bank_service.get_institution_name(data["access_token"])
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Plaid error: {str(e)}")
    existing = db.query(models.BankConnection).filter(
        models.BankConnection.item_id == data["item_id"], models.BankConnection.user_id == current.id,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Cette banque est déjà connectée.")
    conn = models.BankConnection(
        user_id=current.id, institution_name=data["institution_name"],
        access_token=data["access_token"], item_id=data["item_id"],
    )
    db.add(conn)
    db.commit()
    db.refresh(conn)
    _sync_bank_connection(conn.id, db, current)
    return schemas.BankConnectionOut(id=conn.id, institution_name=conn.institution_name, item_id=conn.item_id, tx_count=0)


def _sync_bank_connection(connection_id: int, db: Session, current: models.User) -> schemas.BankSyncResult:
    conn = db.query(models.BankConnection).filter(
        models.BankConnection.id == connection_id, models.BankConnection.user_id == current.id,
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
    def _get_or_create_category(db: Session, user_id: int, name: str, cat_type: str) -> models.Category:
        cat = db.query(models.Category).filter(
            models.Category.user_id == user_id, models.Category.name == name,
        ).first()
        if not cat:
            cat = models.Category(user_id=user_id, name=name, type=cat_type)
            db.add(cat)
            db.flush()
        return cat
    added = 0
    skipped = 0
    for tx in raw_txs:
        if db.query(models.Transaction).filter(models.Transaction.external_id == tx["transaction_id"]).first():
            skipped += 1
            continue
        cat_name = tx.get("category_hint") or "Importé"
        cat_type = tx.get("tx_type", "expense")
        cat = _get_or_create_category(db, current.id, cat_name, cat_type)
        amount = abs(float(tx["amount"]))
        new_tx = models.Transaction(
            user_id=current.id, category_id=cat.id, amount=amount,
            date=tx["date"], note=tx["name"], external_id=tx["transaction_id"],
            bank_connection_id=conn.id,
        )
        db.add(new_tx)
        added += 1
    conn.cursor = new_cursor
    db.commit()
    return schemas.BankSyncResult(added=added, skipped=skipped, institution_name=conn.institution_name)


@router.post("/bank/sync/{connection_id}", response_model=schemas.BankSyncResult)
def sync_bank(
    connection_id: int,
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    return _sync_bank_connection(connection_id, db, current)


@router.post("/bank/sync-all")
def sync_all_banks(
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    connections = db.query(models.BankConnection).filter(models.BankConnection.user_id == current.id).all()
    results = []
    for conn in connections:
        try:
            r = _sync_bank_connection(conn.id, db, current)
            results.append({"id": conn.id, "institution": conn.institution_name, "added": r.added})
        except Exception as e:
            results.append({"id": conn.id, "institution": conn.institution_name, "error": str(e)})
    return {"synced": len(results), "results": results}


@router.get("/bank/connections", response_model=List[schemas.BankConnectionOut])
def list_bank_connections(
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    connections = db.query(models.BankConnection).filter(models.BankConnection.user_id == current.id).all()
    result = []
    for conn in connections:
        tx_count = db.query(models.Transaction).filter(models.Transaction.bank_connection_id == conn.id).count()
        result.append(schemas.BankConnectionOut(
            id=conn.id, institution_name=conn.institution_name, item_id=conn.item_id, tx_count=tx_count,
        ))
    return result


@router.delete("/bank/connections/{connection_id}")
def delete_bank_connection(
    connection_id: int,
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    conn = db.query(models.BankConnection).filter(
        models.BankConnection.id == connection_id, models.BankConnection.user_id == current.id,
    ).first()
    if not conn:
        raise HTTPException(status_code=404, detail="Connexion introuvable.")
    db.query(models.Transaction).filter(models.Transaction.bank_connection_id == connection_id).delete()
    db.delete(conn)
    db.commit()
    return {"message": "Connexion bancaire supprimée."}
