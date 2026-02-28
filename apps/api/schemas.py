from pydantic import BaseModel, EmailStr
from typing import Optional, List


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


class CategoryCreate(BaseModel):
    name: str
    type: str  # income | expense


class CategoryOut(BaseModel):
    id: int
    name: str
    type: str

    class Config:
        from_attributes = True


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


class CategoryTotal(BaseModel):
    category_id: int
    name: str
    type: str
    total: float
    count: int


class DashboardOut(BaseModel):
    income_total: float
    expense_total: float
    net: float
    tx_count: int
    by_category: List[CategoryTotal]

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