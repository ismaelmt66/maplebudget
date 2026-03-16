"""Unified banking service.

Provides a single API surface for all banking operations.  The actual
provider (Plaid, mock, future Flinks/MX) is resolved at initialization
time based on environment configuration.

Usage:
    from banking.bank_service import get_bank_service
    service = get_bank_service()
    result = service.create_link_token(user_id)
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from functools import lru_cache

from sqlalchemy.orm import Session

import models
from banking.providers.base_provider import (
    BaseBankingProvider,
    ExchangeResult,
    LinkTokenResult,
    SyncResult,
)

logger = logging.getLogger("nexledger.banking")


def _resolve_provider() -> BaseBankingProvider:
    """Select the banking provider based on environment configuration."""
    client_id = os.getenv("PLAID_CLIENT_ID", "")
    secret = os.getenv("PLAID_SECRET", "")

    if client_id and secret:
        from banking.providers.plaid_provider import PlaidProvider
        logger.info("Banking provider: Plaid (%s)", os.getenv("PLAID_ENV", "sandbox"))
        return PlaidProvider()

    from banking.providers.mock_provider import MockProvider
    logger.info("Banking provider: Mock (no PLAID_CLIENT_ID set)")
    return MockProvider()


@lru_cache
def get_bank_service() -> BankService:
    return BankService(_resolve_provider())


class BankService:
    """High-level banking operations backed by a pluggable provider."""

    def __init__(self, provider: BaseBankingProvider):
        self.provider = provider

    @property
    def is_demo(self) -> bool:
        return self.provider.provider_name == "mock"

    @property
    def provider_name(self) -> str:
        return self.provider.provider_name

    def create_link_token(self, user_id: int) -> LinkTokenResult:
        return self.provider.create_link_token(user_id)

    def exchange_token(
        self,
        db: Session,
        user_id: int,
        public_token: str,
        institution_id: str | None = None,
    ) -> models.BankConnection:
        """Exchange a public token and persist the bank connection.

        Raises ValueError if the connection already exists.
        """
        kwargs = {}
        if institution_id:
            kwargs["institution_id"] = institution_id

        result: ExchangeResult = self.provider.exchange_public_token(public_token, **kwargs)

        existing = (
            db.query(models.BankConnection)
            .filter(models.BankConnection.item_id == result.item_id, models.BankConnection.user_id == user_id)
            .first()
        )
        if existing:
            raise ValueError("Cette banque est déjà connectée.")

        conn = models.BankConnection(
            user_id=user_id,
            institution_name=result.institution_name,
            access_token=result.access_token,
            item_id=result.item_id,
            provider=self.provider_name,
        )
        db.add(conn)
        db.commit()
        db.refresh(conn)
        return conn

    def sync_connection(
        self,
        db: Session,
        connection: models.BankConnection,
        user_id: int,
    ) -> dict:
        """Idempotent transaction sync for a single bank connection.

        Handles added, modified, and removed transactions using external_id
        as the deduplication key.
        """
        sync_result: SyncResult = self.provider.sync_transactions(
            connection.access_token,
            connection.cursor,
        )

        added = 0
        modified = 0
        removed = 0
        skipped = 0

        for tx in sync_result.added:
            if tx.pending:
                skipped += 1
                continue
            existing = (
                db.query(models.Transaction)
                .filter(models.Transaction.external_id == tx.external_id)
                .first()
            )
            if existing:
                skipped += 1
                continue
            cat = self._get_or_create_category(db, user_id, tx.category_hint or "Importé", tx.tx_type)
            db.add(models.Transaction(
                user_id=user_id,
                category_id=cat.id,
                amount=abs(tx.amount),
                date=tx.date,
                note=tx.name,
                external_id=tx.external_id,
                bank_connection_id=connection.id,
            ))
            added += 1

        for tx in sync_result.modified:
            existing = (
                db.query(models.Transaction)
                .filter(models.Transaction.external_id == tx.external_id)
                .first()
            )
            if existing:
                existing.amount = abs(tx.amount)
                existing.date = tx.date
                existing.note = tx.name
                modified += 1

        for ext_id in sync_result.removed_ids:
            count = (
                db.query(models.Transaction)
                .filter(models.Transaction.external_id == ext_id)
                .delete()
            )
            removed += count

        connection.cursor = sync_result.next_cursor
        connection.last_synced_at = datetime.now(timezone.utc).isoformat()
        db.commit()

        return {
            "added": added,
            "modified": modified,
            "removed": removed,
            "skipped": skipped,
            "institution_name": connection.institution_name,
        }

    def sync_all(self, db: Session, user_id: int) -> list[dict]:
        """Sync all bank connections for a user."""
        connections = (
            db.query(models.BankConnection)
            .filter(models.BankConnection.user_id == user_id)
            .all()
        )
        results = []
        for conn in connections:
            try:
                r = self.sync_connection(db, conn, user_id)
                results.append({"id": conn.id, **r})
            except Exception as exc:
                logger.warning("Sync failed for connection %s: %s", conn.id, exc)
                results.append({"id": conn.id, "institution_name": conn.institution_name, "error": str(exc)})
        return results

    @staticmethod
    def _get_or_create_category(
        db: Session,
        user_id: int,
        name: str,
        cat_type: str,
    ) -> models.Category:
        cat = (
            db.query(models.Category)
            .filter(models.Category.user_id == user_id, models.Category.name == name)
            .first()
        )
        if not cat:
            cat = models.Category(user_id=user_id, name=name, type=cat_type)
            db.add(cat)
            db.flush()
        return cat
