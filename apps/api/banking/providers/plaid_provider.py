"""Plaid banking provider implementation.

Wraps the plaid-python SDK behind the BaseBankingProvider interface.
All Plaid-specific imports and data transformations live here — nothing
else in the codebase touches the Plaid SDK directly.
"""

from __future__ import annotations

import os
from typing import Optional

from banking.providers.base_provider import (
    BaseBankingProvider,
    ExchangeResult,
    LinkTokenResult,
    NormalizedTransaction,
    SyncResult,
)


class PlaidProvider(BaseBankingProvider):
    provider_name = "plaid"

    def __init__(self):
        self._client_id = os.getenv("PLAID_CLIENT_ID", "")
        self._secret = os.getenv("PLAID_SECRET", "")
        self._env = os.getenv("PLAID_ENV", "sandbox")

    def _make_client(self):
        import plaid
        from plaid.api import plaid_api

        host_map = {
            "sandbox": plaid.Environment.Sandbox,
            "development": plaid.Environment.Development,
            "production": plaid.Environment.Production,
        }
        cfg = plaid.Configuration(
            host=host_map.get(self._env, plaid.Environment.Sandbox),
            api_key={"clientId": self._client_id, "secret": self._secret},
        )
        return plaid_api.PlaidApi(plaid.ApiClient(cfg))

    def create_link_token(self, user_id: int) -> LinkTokenResult:
        from plaid.model.country_code import CountryCode
        from plaid.model.link_token_create_request import LinkTokenCreateRequest
        from plaid.model.link_token_create_request_user import LinkTokenCreateRequestUser
        from plaid.model.products import Products

        client = self._make_client()
        req = LinkTokenCreateRequest(
            products=[Products("transactions")],
            client_name="NexLedger",
            country_codes=[CountryCode("CA"), CountryCode("US")],
            language="fr",
            user=LinkTokenCreateRequestUser(client_user_id=str(user_id)),
        )
        resp = client.link_token_create(req)
        return LinkTokenResult(link_token=resp["link_token"])

    def exchange_public_token(self, public_token: str, **kwargs) -> ExchangeResult:
        from plaid.model.item_public_token_exchange_request import ItemPublicTokenExchangeRequest

        client = self._make_client()
        resp = client.item_public_token_exchange(
            ItemPublicTokenExchangeRequest(public_token=public_token)
        )
        institution_name = self.get_institution_name(resp["access_token"])
        return ExchangeResult(
            access_token=resp["access_token"],
            item_id=resp["item_id"],
            institution_name=institution_name,
        )

    def sync_transactions(
        self,
        access_token: str,
        cursor: Optional[str] = None,
    ) -> SyncResult:
        from plaid.model.transactions_sync_request import TransactionsSyncRequest

        client = self._make_client()
        all_added: list[NormalizedTransaction] = []
        all_modified: list[NormalizedTransaction] = []
        all_removed_ids: list[str] = []
        has_more = True
        next_cursor = cursor or ""

        while has_more:
            req_kwargs = {"access_token": access_token}
            if next_cursor:
                req_kwargs["cursor"] = next_cursor
            resp = client.transactions_sync(TransactionsSyncRequest(**req_kwargs))

            for tx in resp.get("added", []):
                all_added.append(self._normalize(tx))
            for tx in resp.get("modified", []):
                all_modified.append(self._normalize(tx))
            for tx in resp.get("removed", []):
                tid = tx.get("transaction_id")
                if tid:
                    all_removed_ids.append(tid)

            has_more = resp.get("has_more", False)
            next_cursor = resp.get("next_cursor", next_cursor)

        return SyncResult(
            added=all_added,
            modified=all_modified,
            removed_ids=all_removed_ids,
            next_cursor=next_cursor,
        )

    def get_institution_name(self, access_token: str) -> str:
        from plaid.model.country_code import CountryCode
        from plaid.model.institutions_get_by_id_request import InstitutionsGetByIdRequest
        from plaid.model.item_get_request import ItemGetRequest

        try:
            client = self._make_client()
            item_resp = client.item_get(ItemGetRequest(access_token=access_token))
            inst_id = item_resp["item"]["institution_id"]
            inst_resp = client.institutions_get_by_id(
                InstitutionsGetByIdRequest(institution_id=inst_id, country_codes=[CountryCode("CA")])
            )
            return inst_resp["institution"]["name"]
        except Exception:
            return "Banque connectée"

    @staticmethod
    def _normalize(tx: dict) -> NormalizedTransaction:
        amount = float(tx.get("amount", 0))
        date_val = tx.get("date", "")
        if hasattr(date_val, "isoformat"):
            date_val = date_val.isoformat()
        pfc = tx.get("personal_finance_category") or {}
        return NormalizedTransaction(
            external_id=tx["transaction_id"],
            date=str(date_val),
            name=tx.get("name", ""),
            amount=amount,
            category_hint=pfc.get("primary", "") if isinstance(pfc, dict) else "",
            tx_type="expense" if amount > 0 else "income",
            pending=tx.get("pending", False),
        )
