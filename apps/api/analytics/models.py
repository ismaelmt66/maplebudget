"""Pre-computed analytics tables for fast dashboard and reporting queries.

These tables are materialized aggregates updated by the aggregation
service whenever transactions are created, modified, imported, or deleted.
They eliminate the need to compute SUM/GROUP BY on the full transactions
table for every dashboard/health-score/report request.
"""

from sqlalchemy import ForeignKey, Index, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from db import Base


class UserMonthlyStats(Base):
    """Monthly income/expense/savings rollup per user.

    Primary use: dashboard summary, health score, savings rate, reports.
    """
    __tablename__ = "user_monthly_stats"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    month: Mapped[str] = mapped_column(String(7))  # YYYY-MM
    total_income: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    total_expenses: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    net: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    tx_count: Mapped[int] = mapped_column(default=0)

    __table_args__ = (
        Index("ix_user_monthly_stats_user_month", "user_id", "month", unique=True),
    )


class CategoryMonthlySpend(Base):
    """Monthly spending per category per user.

    Primary use: budget compliance, category breakdown, subscription detection.
    """
    __tablename__ = "category_monthly_spend"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id"), index=True)
    month: Mapped[str] = mapped_column(String(7))  # YYYY-MM
    total: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    tx_count: Mapped[int] = mapped_column(default=0)

    __table_args__ = (
        Index("ix_cat_monthly_spend_user_cat_month", "user_id", "category_id", "month", unique=True),
    )
