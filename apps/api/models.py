"""Définitions ORM supportant l’API NexLedger.

Chaque classe correspond à une table ; les relations sont définies pour
faciliter la navigation entre utilisateurs, catégories, transactions et objectifs.
"""

from sqlalchemy import Index, String, ForeignKey, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    totp_secret: Mapped[str | None] = mapped_column(String(64), nullable=True)
    totp_enabled: Mapped[bool] = mapped_column(default=False)

    # New onboarding fields
    name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    country: Mapped[str | None] = mapped_column(String(100), nullable=True)
    currency: Mapped[str | None] = mapped_column(String(10), nullable=True)
    income_level: Mapped[str | None] = mapped_column(String(50), nullable=True) # e.g. "0-50k", "50k-100k"
    financial_knowledge: Mapped[str | None] = mapped_column(String(50), nullable=True) # e.g. "beginner", "intermediate"
    risk_tolerance: Mapped[str | None] = mapped_column(String(50), nullable=True) # e.g. "low", "medium", "high"
    
    categories: Mapped[list["Category"]] = relationship(back_populates="user")
    transactions: Mapped[list["Transaction"]] = relationship(back_populates="user")
    goals: Mapped[list["Goal"]] = relationship(back_populates="user")
    assets: Mapped[list["Asset"]] = relationship(back_populates="user")
    bank_connections: Mapped[list["BankConnection"]] = relationship(back_populates="user")


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

    external_id: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True, index=True)
    bank_connection_id: Mapped[int | None] = mapped_column(ForeignKey("bank_connections.id"), nullable=True)
    bank_connection: Mapped["BankConnection | None"] = relationship(back_populates="transactions")

    is_recurring: Mapped[bool] = mapped_column(default=False)
    recurrence_interval: Mapped[str | None] = mapped_column(String(16), nullable=True)

    __table_args__ = (
        Index("ix_transactions_user_date", "user_id", "date"),
        Index("ix_transactions_user_category_date", "user_id", "category_id", "date"),
        Index("ix_transactions_bank_conn", "bank_connection_id"),
    )


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


class BankConnection(Base):
    """Connexion bancaire via Plaid ou autre fournisseur."""
    __tablename__ = "bank_connections"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    institution_name: Mapped[str] = mapped_column(String(255))
    access_token: Mapped[str] = mapped_column(String(255))
    item_id: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    cursor: Mapped[str | None] = mapped_column(String(255), nullable=True)
    provider: Mapped[str] = mapped_column(String(32), default="plaid")
    last_synced_at: Mapped[str | None] = mapped_column(String(30), nullable=True)

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    user: Mapped["User"] = relationship(back_populates="bank_connections")
    transactions: Mapped[list["Transaction"]] = relationship(back_populates="bank_connection", cascade="all, delete-orphan")


class BudgetAlert(Base):
    """Alerte budget : seuil mensuel par catégorie."""
    __tablename__ = "budget_alerts"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id"))
    monthly_limit: Mapped[float] = mapped_column(Numeric(12, 2))
    created_at: Mapped[str] = mapped_column(String(10))  # YYYY-MM-DD

    user: Mapped["User"] = relationship()
    category: Mapped["Category"] = relationship()


class AuditLog(Base):
    """Journal d'audit — trace toutes les actions importantes."""
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    action: Mapped[str] = mapped_column(String(64))   # 'login' | 'tx_create' | 'tx_delete' | '2fa_enable' | etc.
    details: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[str] = mapped_column(String(20))  # ISO datetime

    user: Mapped["User"] = relationship()


class Notification(Base):
    """Notification proactive générée par Nexus."""
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    title: Mapped[str] = mapped_column(String(120))
    body: Mapped[str] = mapped_column(String(500))
    type: Mapped[str] = mapped_column(String(32))  # 'alert' | 'tip' | 'goal' | 'anomaly' | 'weekly'
    is_read: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[str] = mapped_column(String(20))  # ISO datetime

    user: Mapped["User"] = relationship()


class WeeklyReport(Base):
    """Rapport hebdomadaire généré par Nexus."""
    __tablename__ = "weekly_reports"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    week_start: Mapped[str] = mapped_column(String(10))  # YYYY-MM-DD (lundi)
    content: Mapped[str] = mapped_column(String(5000))
    created_at: Mapped[str] = mapped_column(String(20))

    user: Mapped["User"] = relationship()


class HouseholdMember(Base):
    """Lien entre un foyer partagé (couple/famille) et ses membres."""
    __tablename__ = "household_members"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"))   # who created the household
    member_id: Mapped[int] = mapped_column(ForeignKey("users.id"))  # invited member
    role: Mapped[str] = mapped_column(String(16), default="member")  # 'owner' | 'member'
    joined_at: Mapped[str] = mapped_column(String(20))  # ISO datetime

    owner: Mapped["User"] = relationship(foreign_keys=[owner_id])
    member: Mapped["User"] = relationship(foreign_keys=[member_id])


class HouseholdInvite(Base):
    """Invitation par email pour rejoindre un foyer."""
    __tablename__ = "household_invites"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    inviter_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    invite_email: Mapped[str] = mapped_column(String(255))
    token: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    status: Mapped[str] = mapped_column(String(16), default="pending")  # 'pending'|'accepted'|'declined'
    created_at: Mapped[str] = mapped_column(String(20))

    inviter: Mapped["User"] = relationship()


class RecurringTransaction(Base):
    """Transaction récurrente planifiée (modèle + logique d'auto-génération)."""
    __tablename__ = "recurring_transactions"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(120))
    amount: Mapped[float] = mapped_column(Numeric(12, 2))
    frequency: Mapped[str] = mapped_column(String(20))  # 'weekly' | 'monthly' | 'yearly'
    next_date: Mapped[str] = mapped_column(String(10))  # YYYY-MM-DD
    note: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(default=True)

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    category_id: Mapped[int | None] = mapped_column(ForeignKey("categories.id"), nullable=True)

    user: Mapped["User"] = relationship()
    category: Mapped["Category"] = relationship()
