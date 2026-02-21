from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional, List

from db import get_db
import models

app = FastAPI(title="MapleBudget API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"status": "ok"}

# --------- Schemas ----------
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
    date: str  # YYYY-MM-DD
    note: Optional[str] = None
    category_id: int

class TransactionOut(BaseModel):
    id: int
    amount: float
    date: str
    note: Optional[str] = None
    category: CategoryOut
    class Config:
        from_attributes = True

# --------- Categories ----------
@app.post("/categories", response_model=CategoryOut)
def create_category(payload: CategoryCreate, db: Session = Depends(get_db)):
    c = models.Category(name=payload.name, type=payload.type)
    db.add(c)
    db.commit()
    db.refresh(c)
    return c

@app.get("/categories", response_model=List[CategoryOut])
def list_categories(db: Session = Depends(get_db)):
    return db.query(models.Category).order_by(models.Category.id.desc()).all()

# --------- Transactions ----------
@app.post("/transactions", response_model=TransactionOut)
def create_transaction(payload: TransactionCreate, db: Session = Depends(get_db)):
    t = models.Transaction(
        amount=payload.amount,
        date=payload.date,
        note=payload.note,
        category_id=payload.category_id,
    )
    db.add(t)
    db.commit()
    db.refresh(t)
    return t

@app.get("/transactions", response_model=List[TransactionOut])
def list_transactions(db: Session = Depends(get_db)):
    return db.query(models.Transaction).order_by(models.Transaction.id.desc()).all()
