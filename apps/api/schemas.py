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
    external_id: Optional[str] = None
    bank_connection_id: Optional[int] = None
    is_recurring: bool = False
    recurrence_interval: Optional[str] = None  # 'daily'|'weekly'|'monthly'|'yearly'


class TransactionUpdate(BaseModel):
    amount: Optional[float] = None
    date: Optional[str] = None
    note: Optional[str] = None
    category_id: Optional[int] = None
    external_id: Optional[str] = None


class TransactionOut(BaseModel):
    id: int
    amount: float
    date: str
    note: Optional[str] = None
    category: CategoryOut
    external_id: Optional[str] = None
    bank_connection_id: Optional[int] = None
    is_recurring: bool = False
    recurrence_interval: Optional[str] = None

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

# --- Connexions Bancaires ---

class BankConnectionCreate(BaseModel):
    institution_name: str
    access_token: str
    item_id: str
    cursor: Optional[str] = None

class BankConnectionOut(BaseModel):
    id: int
    institution_name: str
    item_id: str
    tx_count: Optional[int] = 0
    last_sync: Optional[str] = None

    class Config:
        from_attributes = True


class BankLinkTokenOut(BaseModel):
    link_token: str
    demo_mode: bool
    demo_banks: Optional[List[dict]] = None


class BankExchangeRequest(BaseModel):
    public_token: str
    institution_id: Optional[str] = None  # for demo mode


class BankSyncResult(BaseModel):
    added: int
    skipped: int
    institution_name: str

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
    history: Optional[List[dict]] = None

class ChatResponse(BaseModel):
    reply: str


# --- Allocation Rules (Smart Savings Automation) ---

class AllocationRuleCreate(BaseModel):
    name: str
    source_type: str  # 'all_income' | 'category'
    source_category_id: Optional[int] = None
    target_asset_id: int
    allocation_percent: float  # 0.0 – 100.0

class AllocationRuleUpdate(BaseModel):
    name: Optional[str] = None
    source_type: Optional[str] = None
    source_category_id: Optional[int] = None
    target_asset_id: Optional[int] = None
    allocation_percent: Optional[float] = None
    is_active: Optional[bool] = None

class AllocationRuleOut(BaseModel):
    id: int
    name: str
    source_type: str
    source_category_id: Optional[int] = None
    source_category_name: Optional[str] = None
    target_asset_id: int
    target_asset_name: str
    allocation_percent: float
    is_active: bool

    class Config:
        from_attributes = True

class AllocationSimulateRequest(BaseModel):
    income_amount: float  # Le montant à utiliser pour la simulation

class AllocationSimulateResult(BaseModel):
    rule_id: int
    rule_name: str
    target_asset_name: str
    allocated_amount: float
    percent: float

class AllocationApplyRequest(BaseModel):
    income_amount: float
    income_category_id: Optional[int] = None  # Pour filtrer les règles par catégorie source

# --- AI ---

class AIStatusOut(BaseModel):
    mode: str
    llm_provider: Optional[str] = None


# --- Recurring Transactions ---

class RecurringTransactionCreate(BaseModel):
    name: str
    amount: float
    category_id: int
    frequency: str  # 'weekly' | 'monthly' | 'yearly'
    next_date: str  # YYYY-MM-DD
    note: Optional[str] = None


class RecurringTransactionUpdate(BaseModel):
    name: Optional[str] = None
    amount: Optional[float] = None
    category_id: Optional[int] = None
    frequency: Optional[str] = None
    next_date: Optional[str] = None
    note: Optional[str] = None
    is_active: Optional[bool] = None


class RecurringTransactionOut(BaseModel):
    id: int
    name: str
    amount: float
    category: CategoryOut
    frequency: str
    next_date: str
    note: Optional[str] = None
    is_active: bool

    class Config:
        from_attributes = True


# --- Health Score ---

class HealthScoreBreakdown(BaseModel):
    savings_rate: float
    budget_compliance: float
    emergency_fund: float
    goal_progress: float
    diversification: float

class HealthScoreOut(BaseModel):
    score: int
    grade: str
    label: Optional[str] = None
    color: Optional[str] = None
    breakdown: HealthScoreBreakdown
    insights: List[str]
    recommendations: Optional[List[str]] = None
    last_calculated: str


# --- AI Category Suggestion ---

class SuggestCategoryRequest(BaseModel):
    description: str

class SuggestCategoryResponse(BaseModel):
    category_id: Optional[int] = None
    category_name: str
    confidence: float


# --- Budget Alerts ---

class BudgetAlertCreate(BaseModel):
    category_id: int
    monthly_limit: float


class BudgetAlertOut(BaseModel):
    id: int
    category_id: int
    category_name: str
    monthly_limit: float
    created_at: str

    class Config:
        from_attributes = True


class BudgetAlertCheckOut(BaseModel):
    category_id: int
    category_name: str
    monthly_limit: float
    current_spending: float
    percentage: float
    is_exceeded: bool


# --- Global Search ---

class SearchResults(BaseModel):
    transactions: List[dict]
    categories: List[dict]
    goals: List[dict]


# --- Net Worth History ---

class NetWorthHistoryPoint(BaseModel):
    date: str
    net_worth: float


# --- Sécurité / 2FA ---

class TwoFASetupOut(BaseModel):
    secret: str
    provisioning_uri: str
    qr_data: str  # data URI base64 de l'image QR


class TwoFAVerifyRequest(BaseModel):
    code: str  # Code TOTP 6 chiffres


class AuditLogOut(BaseModel):
    id: int
    action: str
    details: Optional[str] = None
    created_at: str

    class Config:
        from_attributes = True


# --- Notifications Proactives ---

class NotificationOut(BaseModel):
    id: int
    title: str
    body: str
    type: str
    is_read: bool
    created_at: str

    class Config:
        from_attributes = True


class WeeklyReportOut(BaseModel):
    id: int
    week_start: str
    content: str
    created_at: str

    class Config:
        from_attributes = True


# --- Simulateur "Et si..." ---

class SimulatorRequest(BaseModel):
    monthly_savings_extra: float = 0      # $ de plus épargnés/mois
    expense_cuts: List[dict] = []         # [{label, monthly_amount}]
    years: int = 10                       # horizon en années
    expected_return: float = 5.0          # taux annuel %


class SimulatorProjection(BaseModel):
    year: int
    baseline: float      # sans changement
    optimized: float     # avec les changements
    difference: float


class SimulatorResult(BaseModel):
    projections: List[SimulatorProjection]
    total_saved_extra: float
    monthly_gain: float
    summary: str


# --- Reports ---

# --- Canada REER/CELI ---

class CanadaOptimizerRequest(BaseModel):
    annual_income: float
    province: str  # 'QC' | 'ON' | 'BC' | 'AB' | 'other'
    available_savings: float
    age: int
    existing_rrsp: float = 0.0
    existing_tfsa: float = 0.0
    rrsp_room: Optional[float] = None  # If None, we estimate it


class CanadaScenario(BaseModel):
    name: str
    rrsp_contribution: float
    tfsa_contribution: float
    tax_refund: float
    net_cost: float         # available_savings - tax_refund
    projected_10y: float
    projected_20y: float
    projected_30y: float


class CanadaOptimizerResult(BaseModel):
    marginal_rate: float
    rrsp_room: float
    tfsa_room: float
    recommended_rrsp: float
    recommended_tfsa: float
    tax_refund: float
    scenarios: List[CanadaScenario]
    tips: List[str]


# --- Mode Couple / Foyer ---

class HouseholdInviteRequest(BaseModel):
    email: str


class HouseholdInviteOut(BaseModel):
    id: int
    invite_email: str
    token: str
    status: str
    created_at: str

    class Config:
        from_attributes = True


class HouseholdMemberOut(BaseModel):
    member_id: int
    email: str
    role: str
    joined_at: str


class HouseholdOut(BaseModel):
    owner_email: str
    members: List[HouseholdMemberOut]
    pending_invites: List[HouseholdInviteOut]


# --- Score Communautaire ---

class CommunityBenchmark(BaseModel):
    your_savings_rate: float
    avg_savings_rate: float
    your_expense_ratio: float
    avg_expense_ratio: float
    your_score: int
    percentile: int
    badge: str
    tips: List[str]


class ReportSummary(BaseModel):
    generated_at: str
    period: str
    income_total: float
    expense_total: float
    net: float
    savings_rate: float
    top_expense_categories: List[dict]
    health_score: int
    goals_count: int
    goals_on_track: int
    recurring_monthly_cost: float
