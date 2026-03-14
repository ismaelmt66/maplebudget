"""Aggregation service for pre-computed financial analytics.

Maintains materialized summary tables so dashboards, health scores,
and reports read from pre-aggregated data instead of scanning the
full transactions table on every request.

Call ``refresh_user_month()`` whenever transactions change:
  - transaction created/updated/deleted
  - bank sync completes
  - manual import

The function recomputes the affected month(s) for the user, which is
an O(n) scan over one month of transactions — fast even at 100k users.
"""

from __future__ import annotations

import logging

from sqlalchemy import func
from sqlalchemy.orm import Session

import models
from analytics.models import CategoryMonthlySpend, UserMonthlyStats

logger = logging.getLogger("nexledger.analytics")


def refresh_user_month(db: Session, user_id: int, month: str) -> None:
    """Recompute aggregates for a single user + month.

    Args:
        db: Active DB session.
        user_id: Owner of the transactions.
        month: Format ``YYYY-MM`` (e.g. ``"2026-03"``).
    """
    date_prefix = month  # Transactions store date as YYYY-MM-DD string

    txs = (
        db.query(
            models.Category.id.label("cat_id"),
            models.Category.type.label("cat_type"),
            func.sum(models.Transaction.amount).label("total"),
            func.count(models.Transaction.id).label("cnt"),
        )
        .join(models.Category, models.Transaction.category_id == models.Category.id)
        .filter(
            models.Transaction.user_id == user_id,
            models.Transaction.date.like(f"{date_prefix}%"),
        )
        .group_by(models.Category.id, models.Category.type)
        .all()
    )

    total_income = 0.0
    total_expenses = 0.0
    total_tx = 0

    for row in txs:
        amount = float(row.total)
        count = int(row.cnt)
        total_tx += count

        if row.cat_type == "income":
            total_income += amount
        else:
            total_expenses += amount

        _upsert_category_spend(db, user_id, row.cat_id, month, amount, count)

    _upsert_monthly_stats(db, user_id, month, total_income, total_expenses, total_tx)
    db.commit()
    logger.debug("Refreshed aggregates for user=%s month=%s", user_id, month)


def refresh_user_all(db: Session, user_id: int) -> None:
    """Recompute all months for a user.  Use after bulk import or migration."""
    months = (
        db.query(func.distinct(func.substr(models.Transaction.date, 1, 7)))
        .filter(models.Transaction.user_id == user_id)
        .all()
    )
    for (m,) in months:
        if m:
            refresh_user_month(db, user_id, m)


def _upsert_monthly_stats(
    db: Session, user_id: int, month: str,
    income: float, expenses: float, tx_count: int,
) -> None:
    row = db.query(UserMonthlyStats).filter(
        UserMonthlyStats.user_id == user_id,
        UserMonthlyStats.month == month,
    ).first()
    if row:
        row.total_income = income
        row.total_expenses = expenses
        row.net = income - expenses
        row.tx_count = tx_count
    else:
        db.add(UserMonthlyStats(
            user_id=user_id, month=month,
            total_income=income, total_expenses=expenses,
            net=income - expenses, tx_count=tx_count,
        ))


def _upsert_category_spend(
    db: Session, user_id: int, category_id: int, month: str,
    total: float, tx_count: int,
) -> None:
    row = db.query(CategoryMonthlySpend).filter(
        CategoryMonthlySpend.user_id == user_id,
        CategoryMonthlySpend.category_id == category_id,
        CategoryMonthlySpend.month == month,
    ).first()
    if row:
        row.total = total
        row.tx_count = tx_count
    else:
        db.add(CategoryMonthlySpend(
            user_id=user_id, category_id=category_id,
            month=month, total=total, tx_count=tx_count,
        ))
