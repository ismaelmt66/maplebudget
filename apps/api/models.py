"""Définitions ORM supportant l’API NexLeger.

Chaque classe correspond à une table ; les relations sont définies pour
faciliter la navigation entre utilisateurs, catégories, transactions et objectifs.
"""

from sqlalchemy import String, ForeignKey, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    is_onboarded: Mapped[bool] = mapped_column(default=False)

    categories: Mapped[list["Category"]] = relationship(back_populates="user")
    transactions: Mapped[list["Transaction"]] = relationship(back_populates="user")
    goals: Mapped[list["Goal"]] = relationship(back_populates="user")
    assets: Mapped[list["Asset"]] = relationship(back_populates="user")
    recurring_transactions: Mapped[list["RecurringTransaction"]] = relationship(back_populates="user")


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(64))
    type: Mapped[str] = mapped_column(String(16))  # income | expense
    budget_limit: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    user: Mapped["User"] = relationship(back_populates="categories")

    transactions: Mapped[list["Transaction"]] = relationship(back_populates="category")


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(primary_key=True)
    amount: Mapped[float] = mapped_column(Numeric(12, 2))
    date: Mapped[str] = mapped_column(String(10))  # YYYY-MM-DD
    note: Mapped[str | None] = mapped_column(String(255), nullable=True)

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    user: Mapped["User"] = relationship(back_populates="transactions")

    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id"))
    category: Mapped["Category"] = relationship(back_populates="transactions")


# --- Goals ---
class Goal(Base):
    __tablename__ = "goals"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(120))
    target_amount: Mapped[float] = mapped_column(Numeric(12, 2))
    current_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    target_date: Mapped[str] = mapped_column(String(10))  # YYYY-MM-DD

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    user: Mapped["User"] = relationship(back_populates="goals")


class Asset(Base):
    __tablename__ = "assets"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), index=True)
    type: Mapped[str] = mapped_column(String(64)) # e.g., 'checking', 'savings', 'crypto', 'stock'
    balance: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    
    user: Mapped["User"] = relationship(back_populates="assets")
    history: Mapped[list["AssetHistory"]] = relationship(back_populates="asset", cascade="all, delete-orphan")

class AssetHistory(Base):
    __tablename__ = "asset_history"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    asset_id: Mapped[int] = mapped_column(ForeignKey("assets.id"))
    date: Mapped[str] = mapped_column(String(10)) # format YYYY-MM-DD
    balance: Mapped[float] = mapped_column(Numeric(12, 2))
    
    asset: Mapped["Asset"] = relationship(back_populates="history")


class AllocationRule(Base):
    """Règle d'allocation automatique : X% d'une source de revenus → actif cible."""
    __tablename__ = "allocation_rules"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(120))  # Ex: "Épargne d'urgence"
    source_type: Mapped[str] = mapped_column(String(32))  # 'all_income' | 'category'
    source_category_id: Mapped[int | None] = mapped_column(ForeignKey("categories.id"), nullable=True)
    target_asset_id: Mapped[int] = mapped_column(ForeignKey("assets.id"))
    allocation_percent: Mapped[float] = mapped_column(Numeric(5, 2))  # 0–100
    is_active: Mapped[bool] = mapped_column(default=True)

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    user: Mapped["User"] = relationship()
    target_asset: Mapped["Asset"] = relationship()
    source_category: Mapped["Category | None"] = relationship()


class RecurringTransaction(Base):
    """Transaction récurrente détectée ou créée manuellement."""
    __tablename__ = "recurring_transactions"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    name: Mapped[str] = mapped_column(String(255))
    amount: Mapped[float] = mapped_column(Numeric(12, 2))
    frequency: Mapped[str] = mapped_column(String(20))  # daily/weekly/biweekly/monthly/quarterly/yearly
    next_occurrence: Mapped[str | None] = mapped_column(String(10), nullable=True)
    last_occurrence: Mapped[str | None] = mapped_column(String(10), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="active")  # active/paused/ended
    confidence_score: Mapped[float] = mapped_column(Numeric(3, 2), default=0.0)
    category_name: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[str] = mapped_column(String(25))
    updated_at: Mapped[str] = mapped_column(String(25))

    user: Mapped["User"] = relationship(back_populates="recurring_transactions")
