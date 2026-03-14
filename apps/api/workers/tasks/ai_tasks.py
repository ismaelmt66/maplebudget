"""Background tasks for AI-powered financial analysis.

These functions are designed to run outside the request cycle via the
job queue.  They create their own DB session so they're independent of
the HTTP request lifecycle.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from db import SessionLocal

logger = logging.getLogger("nexledger.tasks.ai")


def run_ai_chat(user_id: int, message: str, history: list[dict] | None = None) -> str:
    """Execute an AI chat query in the background and return the reply."""
    db = SessionLocal()
    try:
        from services.ai_engine import FinancialAIEngine
        engine = FinancialAIEngine(db=db, user_id=user_id)
        reply = engine.process_query(message)
        return reply.strip()
    finally:
        db.close()


def run_patrimoine_analysis(user_id: int) -> str:
    """Generate a full AI patrimoine analysis report in the background."""
    db = SessionLocal()
    try:
        from services.ai_engine import FinancialAIEngine
        engine = FinancialAIEngine(db=db, user_id=user_id)
        report = engine.analyze_patrimoine()

        import models
        if not db.query(models.AuditLog).filter(
            models.AuditLog.user_id == user_id,
            models.AuditLog.action == "ai_analysis_run",
        ).first():
            db.add(models.AuditLog(
                user_id=user_id,
                action="ai_analysis_run",
                created_at=datetime.now(timezone.utc).isoformat(),
            ))
            db.commit()

        return report
    finally:
        db.close()


def run_bank_sync(user_id: int) -> list[dict]:
    """Sync all bank connections for a user in the background."""
    db = SessionLocal()
    try:
        from banking.bank_service import get_bank_service
        svc = get_bank_service()
        return svc.sync_all(db, user_id)
    finally:
        db.close()
