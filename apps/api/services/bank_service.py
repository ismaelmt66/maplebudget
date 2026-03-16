"""Service d'intégration bancaire via Plaid.

Si PLAID_CLIENT_ID n'est pas configuré, le service bascule automatiquement
en mode DÉMO qui génère des transactions réalistes sans credentials.
"""

import os
import random
import uuid
from datetime import date, timedelta

PLAID_CLIENT_ID = os.getenv("PLAID_CLIENT_ID", "")
PLAID_SECRET = os.getenv("PLAID_SECRET", "")
PLAID_ENV = os.getenv("PLAID_ENV", "sandbox")

DEMO_MODE = not (PLAID_CLIENT_ID and PLAID_SECRET)


def _make_plaid_client():
    from plaid.api import plaid_api
    import plaid

    cfg = plaid.Configuration(
        host={
            "sandbox": plaid.Environment.Sandbox,
            "development": plaid.Environment.Development,
            "production": plaid.Environment.Production,
        }.get(PLAID_ENV, plaid.Environment.Sandbox),
        api_key={"clientId": PLAID_CLIENT_ID, "secret": PLAID_SECRET},
    )
    return plaid_api.PlaidApi(plaid.ApiClient(cfg))


# ─────────────────────────────────────────────
# DEMO mode — données synthétiques réalistes
# ─────────────────────────────────────────────

_DEMO_BANKS = [
    {"id": "demo_rbc", "name": "RBC Banque Royale", "logo": "🏦"},
    {"id": "demo_td", "name": "TD Canada Trust", "logo": "🏛️"},
    {"id": "demo_bmo", "name": "BMO Banque de Montréal", "logo": "🏢"},
    {"id": "demo_desjardins", "name": "Desjardins", "logo": "🌿"},
    {"id": "demo_scotiabank", "name": "Banque Scotia", "logo": "🔴"},
]

_DEMO_TRANSACTIONS = [
    # (description, amount, category_hint, type)
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
    ("Clinique médicale", -0.00, "Santé", "expense"),
    ("Cinéma Banque Scotia", -15.00, "Loisirs", "expense"),
    ("Bonus travail", 500.00, "Salaire", "income"),
    ("Assurance auto", -89.00, "Assurances", "expense"),
]


def create_demo_link_token(user_id: int) -> str:
    """Génère un faux link_token pour le mode démo."""
    return f"demo-link-{user_id}-{uuid.uuid4().hex[:16]}"


def exchange_demo_token(public_token: str, institution_id: str) -> dict:
    """Simule l'échange d'un token demo."""
    bank = next((b for b in _DEMO_BANKS if b["id"] == institution_id), _DEMO_BANKS[0])
    return {
        "access_token": f"demo-access-{uuid.uuid4().hex}",
        "item_id": f"demo-item-{uuid.uuid4().hex[:12]}",
        "institution_name": bank["name"],
    }


def get_demo_transactions(cursor: str | None = None) -> tuple[list[dict], str]:
    """Génère des transactions démo pour le mois en cours et le précédent."""
    today = date.today()
    txs = []

    for offset_days in range(0, 60, 1):
        tx_date = today - timedelta(days=offset_days)
        # ~40% chance of a transaction on any given day
        if random.random() > 0.40:
            continue
        template = random.choice(_DEMO_TRANSACTIONS)
        amount = template[1] * (0.85 + random.random() * 0.3)  # ±15% variance
        txs.append({
            "transaction_id": f"demo-tx-{uuid.uuid4().hex[:16]}",
            "date": tx_date.isoformat(),
            "name": template[0],
            "amount": round(-amount, 2),  # Plaid uses positive=debit convention inverted
            "category_hint": template[2],
            "tx_type": template[3],
        })

    new_cursor = f"demo-cursor-{uuid.uuid4().hex[:8]}"
    return txs, new_cursor


# ─────────────────────────────────────────────
# REAL Plaid mode
# ─────────────────────────────────────────────

def create_link_token(user_id: int) -> str:
    from plaid.model.link_token_create_request import LinkTokenCreateRequest
    from plaid.model.link_token_create_request_user import LinkTokenCreateRequestUser
    from plaid.model.products import Products
    from plaid.model.country_code import CountryCode

    client = _make_plaid_client()
    req = LinkTokenCreateRequest(
        products=[Products("transactions")],
        client_name="MapleBudget",
        country_codes=[CountryCode("CA"), CountryCode("US")],
        language="fr",
        user=LinkTokenCreateRequestUser(client_user_id=str(user_id)),
    )
    resp = client.link_token_create(req)
    return resp["link_token"]


def exchange_public_token(public_token: str) -> dict:
    from plaid.model.item_public_token_exchange_request import ItemPublicTokenExchangeRequest

    client = _make_plaid_client()
    req = ItemPublicTokenExchangeRequest(public_token=public_token)
    resp = client.item_public_token_exchange(req)
    return {
        "access_token": resp["access_token"],
        "item_id": resp["item_id"],
    }


def get_institution_name(access_token: str) -> str:
    from plaid.model.item_get_request import ItemGetRequest
    from plaid.model.institutions_get_by_id_request import InstitutionsGetByIdRequest
    from plaid.model.country_code import CountryCode

    try:
        client = _make_plaid_client()
        item_resp = client.item_get(ItemGetRequest(access_token=access_token))
        inst_id = item_resp["item"]["institution_id"]
        inst_resp = client.institutions_get_by_id(
            InstitutionsGetByIdRequest(institution_id=inst_id, country_codes=[CountryCode("CA")])
        )
        return inst_resp["institution"]["name"]
    except Exception:
        return "Banque connectée"


def sync_transactions(access_token: str, cursor: str | None) -> tuple[list[dict], str]:
    from plaid.model.transactions_sync_request import TransactionsSyncRequest

    client = _make_plaid_client()
    req = TransactionsSyncRequest(access_token=access_token)
    if cursor:
        req = TransactionsSyncRequest(access_token=access_token, cursor=cursor)

    all_added = []
    has_more = True
    next_cursor = cursor or ""

    while has_more:
        resp = client.transactions_sync(req)
        all_added.extend(resp["added"])
        has_more = resp["has_more"]
        next_cursor = resp["next_cursor"]
        if has_more:
            req = TransactionsSyncRequest(access_token=access_token, cursor=next_cursor)

    normalized = []
    for tx in all_added:
        normalized.append({
            "transaction_id": tx["transaction_id"],
            "date": tx["date"].isoformat() if hasattr(tx["date"], "isoformat") else str(tx["date"]),
            "name": tx["name"],
            "amount": float(tx["amount"]),  # Plaid: positive = debit
            "category_hint": (tx.get("personal_finance_category", {}) or {}).get("primary", ""),
            "tx_type": "expense" if float(tx["amount"]) > 0 else "income",
        })

    return normalized, next_cursor
