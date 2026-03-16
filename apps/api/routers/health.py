"""Health score, achievements, AI coach, and subscription analytics.

Heavy business logic has been extracted to services/health_service.py.
This router is now a thin HTTP adapter.
"""

from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

import models
import schemas
from auth import get_current_user
from db import get_db
from services.health_service import compute_achievements, compute_health_score, detect_subscriptions
from settings import get_settings

router = APIRouter()
_settings = get_settings()


@router.get("/financial-health-score", response_model=schemas.HealthScoreOut)
def financial_health_score(
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    return compute_health_score(db, current.id)


@router.get("/achievements", response_model=schemas.AchievementsResponse)
def get_achievements(
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    return compute_achievements(db, current.id)


@router.get("/ai/status", response_model=schemas.AIStatusOut)
def ai_status(current: models.User = Depends(get_current_user)):
    if _settings.GROQ_API_KEY:
        return {"mode": "llm", "llm_provider": "groq"}
    if _settings.ANTHROPIC_API_KEY:
        return {"mode": "llm", "llm_provider": "anthropic"}
    return {"mode": "heuristic", "llm_provider": None}


@router.post("/ai/chat", response_model=schemas.ChatResponse)
def ai_chat(
    payload: schemas.ChatMessage,
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    from services.ai_engine import FinancialAIEngine
    engine = FinancialAIEngine(db=db, user_id=current.id)
    reply = engine.process_query(payload.message)
    return {"reply": reply.strip()}


@router.get("/analytics/subscriptions", response_model=List[schemas.SubscriptionOut])
def get_subscriptions(
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    return detect_subscriptions(db, current.id)
