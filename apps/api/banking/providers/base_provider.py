"""Abstract banking provider interface.

Every banking provider (Plaid, Flinks, MX, mock) must implement this
contract.  The bank_service module calls providers exclusively through
this interface — never through provider-specific SDKs directly.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class NormalizedTransaction:
    """Provider-agnostic transaction representation."""
    external_id: str
    date: str
    name: str
    amount: float
    category_hint: str
    tx_type: str  # "income" | "expense"
    pending: bool = False


@dataclass
class SyncResult:
    """Result of a transaction sync operation."""
    added: list[NormalizedTransaction] = field(default_factory=list)
    modified: list[NormalizedTransaction] = field(default_factory=list)
    removed_ids: list[str] = field(default_factory=list)
    next_cursor: str = ""
    has_more: bool = False


@dataclass
class LinkTokenResult:
    link_token: str
    demo_mode: bool = False
    demo_banks: list[dict] | None = None


@dataclass
class ExchangeResult:
    access_token: str
    item_id: str
    institution_name: str


class BaseBankingProvider(ABC):
    """Contract that all banking providers must satisfy."""

    provider_name: str = "base"

    @abstractmethod
    def create_link_token(self, user_id: int) -> LinkTokenResult:
        """Generate an ephemeral token for the client-side connection widget."""

    @abstractmethod
    def exchange_public_token(self, public_token: str, **kwargs) -> ExchangeResult:
        """Exchange a temporary public token for a permanent access token."""

    @abstractmethod
    def sync_transactions(
        self,
        access_token: str,
        cursor: Optional[str] = None,
    ) -> SyncResult:
        """Fetch new/modified/removed transactions since the last cursor."""

    @abstractmethod
    def get_institution_name(self, access_token: str) -> str:
        """Resolve the human-readable institution name from an access token."""
