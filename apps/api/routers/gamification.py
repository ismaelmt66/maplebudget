"""Gamification routes: achievements, leaderboard, and milestone tracking."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

import models
from auth import get_current_user
from db import get_db
from services.health_service import compute_achievements

router = APIRouter(tags=["gamification"])



@router.get("/gamification/rewards")
def get_rewards_dashboard(
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    """Aggregated gamification dashboard with streaks, milestones, and next goals."""
    data = compute_achievements(db, current.id)
    achievements = data["achievements"]
    xp = data["xp"]
    level = data["level"]
    level_progress = data["level_progress"]

    unlocked = [a for a in achievements if a["is_unlocked"]]
    locked = [a for a in achievements if not a["is_unlocked"]]
    next_up = sorted(locked, key=lambda a: -a["progress"])[:3]

    milestones = [
        {"xp": 200, "label": "Apprenti", "reached": xp >= 200},
        {"xp": 400, "label": "Expert", "reached": xp >= 400},
        {"xp": 700, "label": "Maitre", "reached": xp >= 700},
        {"xp": 1000, "label": "Gourou", "reached": xp >= 1000},
    ]

    return {
        "xp": xp,
        "level": level,
        "level_progress": level_progress,
        "total_achievements": len(achievements),
        "unlocked_count": len(unlocked),
        "recent_unlocks": unlocked[-3:] if unlocked else [],
        "next_achievements": next_up,
        "milestones": milestones,
    }
