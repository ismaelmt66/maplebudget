"""Pydantic schemas used for request validation and response serialization.

These are grouped by domain to improve readability.
"""

from pydantic import BaseModel, EmailStr
from typing import Optional, List


# --- Authentification ---

class UserCreate(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: int
    email: EmailStr

    class Config:
        from_attributes = True


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


# --- Catégories ---

class CategoryCreate(BaseModel):
    name: str
    type: str  # income | expense
    budget_limit: Optional[float] = None


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    budget_limit: Optional[float] = None


class CategoryOut(BaseModel):
    id: int
    name: str
    type: str
    budget_limit: Optional[float] = None

    class Config:
        from_attributes = True


# --- Transactions ---

class TransactionCreate(BaseModel):
    amount: float
    date: str
    note: Optional[str] = None
    category_id: int


class TransactionUpdate(BaseModel):
    amount: Optional[float] = None
    date: Optional[str] = None
    note: Optional[str] = None
    category_id: Optional[int] = None


class TransactionOut(BaseModel):
    id: int
    amount: float
    date: str
    note: Optional[str] = None
    category: CategoryOut

    class Config:
        from_attributes = True


# --- Tableau de bord ---

class CategoryTotal(BaseModel):
    category_id: int
    name: str
    type: str
    total: float
    count: int
    budget_limit: Optional[float] = None


class DashboardOut(BaseModel):
    income_total: float
    expense_total: float
    net: float
    tx_count: int
    by_category: List[CategoryTotal]


# --- Analytique / Abonnements ---

class SubscriptionOut(BaseModel):
    name: str
    monthly_cost: float
    yearly_projection: float
    status: str
    has_price_hike: bool
    category_name: str
    last_date: str

# --- Objectifs ---

class GoalCreate(BaseModel):
    title: str
    target_amount: float
    current_amount: float = 0
    target_date: str  # YYYY-MM-DD


class GoalOut(BaseModel):
    id: int
    title: str
    target_amount: float
    current_amount: float
    target_date: str

    class Config:
        from_attributes = True


class GoalPlanOut(BaseModel):
    goal_id: int
    months_remaining: int
    monthly_required: float
    current_amount: float
    target_amount: float
    target_date: str


class GoalUpdate(BaseModel):
    title: Optional[str] = None
    target_amount: Optional[float] = None
    current_amount: Optional[float] = None
    target_date: Optional[str] = None

# --- Patrimoine (Assets) ---

class AssetHistoryOut(BaseModel):
    id: int
    asset_id: int
    date: str
    balance: float

    class Config:
        from_attributes = True

class AssetCreate(BaseModel):
    name: str
    type: str # 'checking', 'savings', 'crypto', 'stock', 'liability'
    balance: float

class AssetUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    balance: Optional[float] = None

class AssetOut(BaseModel):
    id: int
    name: str
    type: str
    balance: float
    history: List[AssetHistoryOut] = []

    class Config:
        from_attributes = True

# --- Gamificiation / Achievements ---

class AchievementOut(BaseModel):
    id: str
    title: str
    description: str
    icon: str
    is_unlocked: bool
    progress: float  # 0.0 to 1.0
    unlock_date: Optional[str] = None

# --- AI Coach ---
class ChatMessage(BaseModel):
    message: str

class ChatResponse(BaseModel):
    reply: str

