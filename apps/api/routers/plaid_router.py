from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
import os
import plaid
from plaid.api import plaid_api
from plaid.model.link_token_create_request import LinkTokenCreateRequest
from plaid.model.link_token_create_request_user import LinkTokenCreateRequestUser
from plaid.model.item_public_token_exchange_request import ItemPublicTokenExchangeRequest
from plaid.model.products import Products
from plaid.model.country_code import CountryCode
from plaid.model.transactions_sync_request import TransactionsSyncRequest

from db import get_db
import models
import schemas
from auth import get_current_user

router = APIRouter(
    prefix="/plaid",
    tags=["Plaid Integration"]
)

# Configuration Plaid
PLAID_CLIENT_ID = os.getenv("PLAID_CLIENT_ID", "")
PLAID_SECRET = os.getenv("PLAID_SECRET", "")
PLAID_ENV = os.getenv("PLAID_ENV", "sandbox")

if PLAID_ENV == "sandbox":
    host = plaid.Environment.Sandbox
elif PLAID_ENV == "development":
    host = plaid.Environment.Development
else:
    host = plaid.Environment.Production

configuration = plaid.Configuration(
    host=host,
    api_key={
        "clientId": PLAID_CLIENT_ID,
        "secret": PLAID_SECRET,
    }
)
api_client = plaid.ApiClient(configuration)
client = plaid_api.PlaidApi(api_client)


@router.post("/create_link_token")
def create_link_token(current_user: models.User = Depends(get_current_user)):
    """Crée un token éphémère pour initialiser le widget Plaid Link côté client."""
    try:
        request = LinkTokenCreateRequest(
            products=[Products("transactions")],
            client_name="NexLedger",
            country_codes=[CountryCode("FR"), CountryCode("US"), CountryCode("CA")],
            language="fr",
            user=LinkTokenCreateRequestUser(
                client_user_id=str(current_user.id)
            )
        )
        response = client.link_token_create(request)
        return response.to_dict()
    except plaid.ApiException as e:
        import json
        err = json.loads(e.body)
        raise HTTPException(status_code=400, detail=err["error_message"])


class ExchangeTokenRequest(schemas.BaseModel):
    public_token: str
    institution_name: str

@router.post("/exchange_public_token", response_model=schemas.BankConnectionOut)
def exchange_public_token(
    req: ExchangeTokenRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Échange le public_token du frontend contre un access_token permanent et le sauvegarde."""
    try:
        exchange_request = ItemPublicTokenExchangeRequest(public_token=req.public_token)
        exchange_response = client.item_public_token_exchange(exchange_request)
        
        access_token = exchange_response["access_token"]
        item_id = exchange_response["item_id"]
        
        # Vérifier si on a déjà cette connexion
        existing = db.query(models.BankConnection).filter(models.BankConnection.item_id == item_id).first()
        if existing:
            return existing

        new_connection = models.BankConnection(
            user_id=current_user.id,
            institution_name=req.institution_name,
            access_token=access_token,
            item_id=item_id,
            cursor=None
        )
        db.add(new_connection)
        db.commit()
        db.refresh(new_connection)
        
        return new_connection
        
    except plaid.ApiException as e:
        import json
        err = json.loads(e.body)
        raise HTTPException(status_code=400, detail=err["error_message"])

@router.get("/connections", response_model=list[schemas.BankConnectionOut])
def get_connections(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Récupère toutes les banques liées par l'utilisateur."""
    return db.query(models.BankConnection).filter(models.BankConnection.user_id == current_user.id).all()


@router.post("/sync_transactions")
def sync_transactions(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Synchronise les transactions depuis Plaid en utilisant l'API /transactions/sync."""
    connections = db.query(models.BankConnection).filter(models.BankConnection.user_id == current_user.id).all()
    if not connections:
        raise HTTPException(status_code=400, detail="Aucune connexion bancaire trouvée.")

    # Catégorie par défaut pour Plaid
    default_cat = db.query(models.Category).filter(
        models.Category.user_id == current_user.id,
        models.Category.name == "Synchronisation Bancaire"
    ).first()
    if not default_cat:
        default_cat = models.Category(name="Synchronisation Bancaire", type="expense", user_id=current_user.id)
        db.add(default_cat)
        db.commit()
        db.refresh(default_cat)

    total_added = 0
    total_modified = 0
    total_removed = 0

    for conn in connections:
        has_more = True
        while has_more:
            request = TransactionsSyncRequest(
                access_token=conn.access_token,
                cursor=conn.cursor,
                count=100
            )
            try:
                response = client.transactions_sync(request)
            except plaid.ApiException as e:
                import json
                err = json.loads(e.body)
                print(f"Plaid Sync Error for Item {conn.item_id}:", err)
                break # On passe à la connexion suivante si erreur (ex: ITEM_LOGIN_REQUIRED)

            # 1. Traiter les nouvelles transactions ajoutées
            for t in response.get("added", []):
                amt = t.get("amount", 0) # Positif chez Plaid = Dépense
                tx_type = "expense" if amt >= 0 else "income"
                abs_amt = abs(amt)
                
                # Chercher une catégorie existante ou utiliser celle par défaut
                plaid_category = t.get("category", [""])[0] if t.get("category") else "Inconnu"
                db_cat = db.query(models.Category).filter(
                    models.Category.user_id == current_user.id,
                    models.Category.name.ilike(f"%{plaid_category}%"),
                    models.Category.type == tx_type
                ).first()
                final_cat_id = db_cat.id if db_cat else default_cat.id

                # Créer la transaction locale
                new_tx = models.Transaction(
                    user_id=current_user.id,
                    category_id=final_cat_id,
                    amount=abs_amt,
                    date=t.get("date", str(datetime.now().date())),
                    note=t.get("name", "Transaction Plaid"),
                    external_id=t.get("transaction_id"),
                    bank_connection_id=conn.id
                )
                db.add(new_tx)
                total_added += 1

            # 2. Traiter les modifications (simplifié: on met à jour le montant/date)
            for t in response.get("modified", []):
                existing_tx = db.query(models.Transaction).filter(models.Transaction.external_id == t.get("transaction_id")).first()
                if existing_tx:
                    existing_tx.amount = abs(t.get("amount", 0))
                    existing_tx.date = t.get("date", existing_tx.date)
                    existing_tx.note = t.get("name", existing_tx.note)
                    total_modified += 1

            # 3. Traiter les suppressions
            for removed_t in response.get("removed", []):
                db.query(models.Transaction).filter(models.Transaction.external_id == removed_t.get("transaction_id")).delete()
                total_removed += 1

            # Mettre à jour le curseur de pagination
            conn.cursor = response.get("next_cursor")
            has_more = response.get("has_more", False)
            db.commit()

    return {
        "status": "success",
        "added": total_added,
        "modified": total_modified,
        "removed": total_removed
    }
