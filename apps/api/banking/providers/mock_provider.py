"""Mock banking provider for development and testing.

Generates realistic synthetic Canadian financial transactions without
requiring any external API credentials.  Activated automatically when
PLAID_CLIENT_ID is not set.
"""

from __future__ import annotations

import random
import uuid
from datetime import date, timedelta
from typing import Optional

from banking.providers.base_provider import (
    BaseBankingProvider,
    ExchangeResult,
    LinkTokenResult,
    NormalizedTransaction,
    SyncResult,
)

DEMO_BANKS = [
    {"id": "demo_rbc", "name": "RBC Banque Royale", "logo": "🏦"},
    {"id": "demo_td", "name": "TD Canada Trust", "logo": "🏛️"},
    {"id": "demo_bmo", "name": "BMO Banque de Montréal", "logo": "🏢"},
    {"id": "demo_desjardins", "name": "Desjardins", "logo": "🌿"},
    {"id": "demo_scotiabank", "name": "Banque Scotia", "logo": "🔴"},
]

_TX_TEMPLATES = [
    ("Dépôt salaire", 2800.00, "Salaire", "income"),
    ("Loyer", -1200.00, "Logement", "expense"),
    ("Épicerie IGA", -87.43, "Alimentation", "expense"),
    ("Métro Montréal", -103.50, "Transport", "expense"),
    ("Netflix", -16.99, "Abonnements", "expense"),
    ("Spotify", -9.99, "Abonnements", "expense"),
    ("Pharmacie Jean Coutu", -34.20, "Santé", "expense"),
    ("Restaurant La Belle Province", -18.75, "Restaurants", "expense"),
    ("Essence Ultramar", -65.00, "Transport", "expense"),
    ("Virement épargne", -300.00, "Épargne", "expense"),
    ("Remboursement ami", 50.00, "Revenus divers", "income"),
    ("Tim Hortons", -4.25, "Restaurants", "expense"),
    ("Amazon", -29.99, "Achats en ligne", "expense"),
    ("Hydro-Québec", -78.50, "Services", "expense"),
    ("Bell Mobilité", -55.00, "Abonnements", "expense"),
    ("SAQ", -43.80, "Sorties", "expense"),
    ("Cinéma Banque Scotia", -15.00, "Loisirs", "expense"),
    ("Bonus travail", 500.00, "Salaire", "income"),
    ("Assurance auto", -89.00, "Assurances", "expense"),
]


class MockProvider(BaseBankingProvider):
    provider_name = "mock"

    def create_link_token(self, user_id: int) -> LinkTokenResult:
        return LinkTokenResult(
            link_token=f"demo-link-{user_id}-{uuid.uuid4().hex[:16]}",
            demo_mode=True,
            demo_banks=DEMO_BANKS,
        )

    def exchange_public_token(self, public_token: str, **kwargs) -> ExchangeResult:
        institution_id = kwargs.get("institution_id", "demo_rbc")
        bank = next((b for b in DEMO_BANKS if b["id"] == institution_id), DEMO_BANKS[0])
        return ExchangeResult(
            access_token=f"demo-access-{uuid.uuid4().hex}",
            item_id=f"demo-item-{uuid.uuid4().hex[:12]}",
            institution_name=bank["name"],
        )

    def sync_transactions(
        self,
        access_token: str,
        cursor: Optional[str] = None,
    ) -> SyncResult:
        today = date.today()
        txs = []
        for offset_days in range(0, 60):
            tx_date = today - timedelta(days=offset_days)
            if random.random() > 0.40:
                continue
            tpl = random.choice(_TX_TEMPLATES)
            amount = tpl[1] * (0.85 + random.random() * 0.3)
            txs.append(NormalizedTransaction(
                external_id=f"demo-tx-{uuid.uuid4().hex[:16]}",
                date=tx_date.isoformat(),
                name=tpl[0],
                amount=round(-amount, 2),
                category_hint=tpl[2],
                tx_type=tpl[3],
            ))
        return SyncResult(
            added=txs,
            next_cursor=f"demo-cursor-{uuid.uuid4().hex[:8]}",
        )

    def get_institution_name(self, access_token: str) -> str:
        return "Banque Démo"
