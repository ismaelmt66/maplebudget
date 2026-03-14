"""Financial health score and gamification service.

Extracted from routers/health.py to keep routers thin. Contains all
scoring logic, achievement evaluation, and subscription detection.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import date as dt_date, datetime, timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session

import models
import schemas


# ── Financial health score ───────────────────────────────────────────

def compute_health_score(db: Session, user_id: int) -> schemas.HealthScoreOut:
    today = dt_date.today()
    month_start = today.replace(day=1).strftime("%Y-%m-%d")

    three_months_ago = today.replace(day=1)
    for _ in range(2):
        if three_months_ago.month == 1:
            three_months_ago = three_months_ago.replace(year=three_months_ago.year - 1, month=12)
        else:
            three_months_ago = three_months_ago.replace(month=three_months_ago.month - 1)

    # Single query for 3 months of transactions with categories
    txs = (
        db.query(models.Transaction, models.Category)
        .join(models.Category, models.Transaction.category_id == models.Category.id)
        .filter(models.Transaction.user_id == user_id, models.Transaction.date >= three_months_ago.strftime("%Y-%m-%d"))
        .all()
    )
    income = sum(float(t.amount) for t, c in txs if c.type == "income")
    expenses = sum(float(t.amount) for t, c in txs if c.type == "expense")
    net = income - expenses

    # 1. Savings rate (0-25 pts)
    savings_rate = (net / income * 100) if income > 0 else 0
    savings_score = min(25, max(0, savings_rate / 2))

    # 2. Budget compliance (0-25 pts) — use SQL aggregation instead of Python loop
    cats_with_limit = (
        db.query(models.Category)
        .filter(models.Category.user_id == user_id, models.Category.budget_limit != None)  # noqa: E711
        .all()
    )
    if cats_with_limit:
        compliant = 0
        for cat in cats_with_limit:
            month_spending = sum(float(t.amount) for t, c in txs if c.id == cat.id and t.date >= month_start)
            if month_spending <= float(cat.budget_limit):
                compliant += 1
        budget_score = (compliant / len(cats_with_limit)) * 25
    else:
        budget_score = 12.5

    # 3. Emergency fund (0-25 pts) — single aggregate query
    liquid_total = (
        db.query(func.coalesce(func.sum(models.Asset.balance), 0))
        .filter(
            models.Asset.user_id == user_id,
            models.Asset.type.in_(("checking", "savings")),
            models.Asset.balance > 0,
        )
        .scalar()
    )
    monthly_expenses = expenses / 3 if expenses > 0 else 1
    emergency_months = float(liquid_total) / monthly_expenses if monthly_expenses > 0 else 0
    emergency_score = min(25, (emergency_months / 6) * 25)

    # 4. Goal progress (0-20 pts)
    goals = db.query(models.Goal).filter(models.Goal.user_id == user_id).all()
    if goals:
        total_progress = sum(
            min(1.0, float(g.current_amount) / float(g.target_amount)) if float(g.target_amount) > 0 else 0
            for g in goals
        )
        goal_score = (total_progress / len(goals)) * 20
    else:
        goal_score = 10

    # 5. Asset diversification (0-5 pts) — single aggregate query
    asset_types_count = (
        db.query(func.count(func.distinct(models.Asset.type)))
        .filter(
            models.Asset.user_id == user_id,
            models.Asset.balance > 0,
            models.Asset.type != "liability",
        )
        .scalar()
    ) or 0
    diversification_score = min(5.0, asset_types_count * 1.25)

    total_score = max(0, min(100, int(savings_score + budget_score + emergency_score + goal_score + diversification_score)))
    grade = "A" if total_score >= 80 else "B" if total_score >= 60 else "C" if total_score >= 40 else "D"

    insights = []
    if savings_rate < 10 and income > 0:
        insights.append(f"Taux d'épargne faible ({savings_rate:.1f}%). Visez 20% minimum.")
    elif savings_rate >= 20:
        insights.append(f"Excellent taux d'épargne de {savings_rate:.1f}% !")
    if emergency_months < 3:
        insights.append(f"Fonds d'urgence insuffisant ({emergency_months:.1f} mois). Cible: 6 mois.")
    if not goals:
        insights.append("Définissez des objectifs financiers pour mieux piloter votre épargne.")
    if asset_types_count < 3:
        insights.append(f"Diversification limitée ({asset_types_count} type{'s' if asset_types_count > 1 else ''} d'actifs).")
    if not insights:
        insights.append("Votre santé financière est bonne. Continuez ainsi !")

    color = "emerald" if total_score >= 80 else "blue" if total_score >= 60 else "amber" if total_score >= 40 else "red"
    return schemas.HealthScoreOut(
        score=total_score, grade=grade, label=grade, color=color,
        breakdown=schemas.HealthScoreBreakdown(
            savings_rate=round(savings_score, 1), budget_compliance=round(budget_score, 1),
            emergency_fund=round(emergency_score, 1), goal_progress=round(goal_score, 1),
            diversification=round(diversification_score, 1),
        ),
        insights=insights, recommendations=insights,
        last_calculated=today.strftime("%Y-%m-%d"),
    )


# ── Achievements / gamification ──────────────────────────────────────

def compute_achievements(db: Session, user_id: int) -> dict:
    today = dt_date.today()
    month_start = today.replace(day=1).strftime("%Y-%m-%d")

    # Batch counts in fewer queries
    tx_count = db.query(func.count(models.Transaction.id)).filter(models.Transaction.user_id == user_id).scalar() or 0
    goals_count = db.query(func.count(models.Goal.id)).filter(models.Goal.user_id == user_id).scalar() or 0
    assets_count = db.query(func.count(models.Asset.id)).filter(models.Asset.user_id == user_id).scalar() or 0
    recurring_count = db.query(func.count(models.RecurringTransaction.id)).filter(models.RecurringTransaction.user_id == user_id).scalar() or 0
    bank_count = db.query(func.count(models.BankConnection.id)).filter(models.BankConnection.user_id == user_id).scalar() or 0
    completed_goals = db.query(func.count(models.Goal.id)).filter(
        models.Goal.user_id == user_id,
        models.Goal.current_amount >= models.Goal.target_amount,
    ).scalar() or 0

    achievements = [
        {"id": "first_tx", "title": "Premier Pas", "description": "Ajouter sa première transaction.", "icon": "🎉",
         "is_unlocked": tx_count >= 1, "progress": min(tx_count / 1.0, 1.0)},
        {"id": "active_tracker", "title": "Voyageur Régulier", "description": "Enregistrer 50 transactions.", "icon": "🏃‍♂️",
         "is_unlocked": tx_count >= 50, "progress": min(tx_count / 50.0, 1.0)},
        {"id": "visionary", "title": "Visionnaire", "description": "Se fixer au moins un objectif.", "icon": "🎯",
         "is_unlocked": goals_count >= 1, "progress": min(goals_count / 1.0, 1.0)},
        {"id": "investor", "title": "Investisseur", "description": "Ajouter au moins 2 comptes de patrimoine.", "icon": "📈",
         "is_unlocked": assets_count >= 2, "progress": min(assets_count / 2.0, 1.0)},
        {"id": "centurion", "title": "Le Centurion", "description": "Enregistrer plus de 100 transactions.", "icon": "👑",
         "is_unlocked": tx_count >= 100, "progress": min(tx_count / 100.0, 1.0)},
    ]

    # Budget master — single aggregate query instead of N+1 loop
    budget_alerts = db.query(models.BudgetAlert).filter(models.BudgetAlert.user_id == user_id).all()
    budget_unlocked = False
    if budget_alerts:
        spending_by_cat = dict(
            db.query(models.Transaction.category_id, func.sum(models.Transaction.amount))
            .join(models.Category, models.Transaction.category_id == models.Category.id)
            .filter(
                models.Transaction.user_id == user_id,
                models.Category.type == "expense",
                models.Transaction.date >= month_start,
            )
            .group_by(models.Transaction.category_id)
            .all()
        )
        budget_unlocked = all(
            float(spending_by_cat.get(a.category_id, 0)) <= float(a.monthly_limit)
            for a in budget_alerts
        )
    achievements.append({"id": "budget_master", "title": "Budget Respecté",
        "description": "Toutes les catégories sous la limite ce mois.", "icon": "📊",
        "is_unlocked": budget_unlocked, "progress": 1.0 if budget_unlocked else 0.0})

    # Savings streak — 3 months
    streak = _compute_savings_streak(db, user_id, today)
    achievements.append({"id": "savings_streak", "title": "Épargnant Régulier",
        "description": "3 mois consécutifs d'épargne positive.", "icon": "🔥",
        "is_unlocked": streak >= 3, "progress": min(streak / 3.0, 1.0)})

    achievements.append({"id": "recurring_detective", "title": "Détective Récurrent",
        "description": "Détecter au moins une transaction récurrente.", "icon": "🔍",
        "is_unlocked": recurring_count >= 1, "progress": min(recurring_count / 1.0, 1.0)})

    achievements.append({"id": "bank_connected", "title": "Connecté",
        "description": "Connecter au moins une banque.", "icon": "🏦",
        "is_unlocked": bank_count >= 1, "progress": min(bank_count / 1.0, 1.0)})

    achievements.append({"id": "goal_completed", "title": "Objectif Atteint !",
        "description": "Atteindre la cible d'au moins un objectif financier.", "icon": "🏆",
        "is_unlocked": completed_goals > 0, "progress": min(completed_goals / 1.0, 1.0)})

    ai_analysis_run = db.query(models.AuditLog).filter(
        models.AuditLog.user_id == user_id, models.AuditLog.action == "ai_analysis_run"
    ).count() > 0
    achievements.append({"id": "first_ai_analysis", "title": "Divination",
        "description": "Lancer sa première analyse IA.", "icon": "🔮",
        "is_unlocked": ai_analysis_run, "progress": 1.0 if ai_analysis_run else 0.0})

    # Categorization
    ninety_days_ago = (today - timedelta(days=90)).strftime("%Y-%m-%d")
    total_recent = db.query(func.count(models.Transaction.id)).filter(
        models.Transaction.user_id == user_id, models.Transaction.date >= ninety_days_ago
    ).scalar() or 0
    categorized = db.query(func.count(models.Transaction.id)).filter(
        models.Transaction.user_id == user_id,
        models.Transaction.date >= ninety_days_ago,
        models.Transaction.category_id != None,  # noqa: E711
    ).scalar() or 0
    cat_progress = categorized / total_recent if total_recent > 0 else 0.0
    achievements.append({"id": "full_categorization", "title": "Maître du Tri",
        "description": "Catégoriser plus de 95% de ses transactions récentes.", "icon": "🗂️",
        "is_unlocked": cat_progress >= 0.95, "progress": cat_progress})

    # XP / levels
    unlocked_count = sum(1 for a in achievements if a["is_unlocked"])
    xp = unlocked_count * 100
    level, level_progress = _xp_to_level(xp)

    return {"achievements": achievements, "xp": xp, "level": level, "level_progress": round(level_progress, 2)}


def _compute_savings_streak(db: Session, user_id: int, today: dt_date) -> int:
    """Count consecutive months (backwards from current) with positive savings."""
    months_positive = 0
    check_date = today.replace(day=1)
    for _ in range(3):
        m_start = check_date
        m_end = m_start.replace(month=m_start.month + 1) if m_start.month < 12 else m_start.replace(year=m_start.year + 1, month=1)

        row = (
            db.query(
                func.coalesce(func.sum(
                    func.case((models.Category.type == "income", models.Transaction.amount), else_=0)
                ), 0).label("income"),
                func.coalesce(func.sum(
                    func.case((models.Category.type == "expense", models.Transaction.amount), else_=0)
                ), 0).label("expense"),
            )
            .join(models.Category, models.Transaction.category_id == models.Category.id)
            .filter(
                models.Transaction.user_id == user_id,
                models.Transaction.date >= m_start.strftime("%Y-%m-%d"),
                models.Transaction.date < m_end.strftime("%Y-%m-%d"),
            )
            .first()
        )
        if row and float(row.income) > float(row.expense) and float(row.income) > 0:
            months_positive += 1
        else:
            break

        check_date = check_date.replace(year=check_date.year - 1, month=12) if check_date.month == 1 else check_date.replace(month=check_date.month - 1)

    return months_positive


def _xp_to_level(xp: int) -> tuple[str, float]:
    levels = [
        (1000, "Gourou", 1000, 1200),
        (700, "Maître", 700, 1000),
        (400, "Expert", 400, 700),
        (200, "Apprenti", 200, 400),
        (0, "Débutant", 0, 200),
    ]
    for threshold, name, floor, ceil in levels:
        if xp >= threshold:
            progress = 1.0 if xp >= ceil else (xp - floor) / (ceil - floor)
            return name, progress
    return "Débutant", 0.0


# ── Subscription detection ───────────────────────────────────────────

def detect_subscriptions(db: Session, user_id: int) -> list[dict]:
    txs = (
        db.query(models.Transaction, models.Category)
        .join(models.Category, models.Transaction.category_id == models.Category.id)
        .filter(models.Transaction.user_id == user_id, models.Category.type == "expense")
        .order_by(models.Transaction.date.asc())
        .all()
    )
    groups: dict[str, list] = defaultdict(list)
    for t, c in txs:
        key = (t.note or c.name).strip().lower()
        if key:
            groups[key].append((t, c))

    subs = []
    today = dt_date.today()
    for key, items in groups.items():
        if len(items) < 2:
            continue
        items_with_dates = []
        for t, c in items:
            try:
                items_with_dates.append((t, c, datetime.strptime(t.date, "%Y-%m-%d").date()))
            except ValueError:
                pass
        if len(items_with_dates) < 2:
            continue
        t1, c1, d1 = items_with_dates[-2]
        t2, c2, d2 = items_with_dates[-1]
        days_diff = (d2 - d1).days
        if 20 <= days_diff <= 45:
            days_since_last = (today - d2).days
            if days_since_last > 90:
                continue
            status = "active" if days_since_last <= 45 else "inactive"
            if abs(t1.amount - t2.amount) / max(t1.amount, 0.01) < 0.3:
                name_display = t2.note or c2.name
                if not name_display:
                    continue
                subs.append({
                    "name": name_display, "monthly_cost": float(t2.amount),
                    "yearly_projection": float(t2.amount * 12), "status": status,
                    "has_price_hike": float(t2.amount) > float(t1.amount),
                    "category_name": c2.name, "last_date": t2.date,
                })
    subs.sort(key=lambda x: x["monthly_cost"], reverse=True)
    return subs
