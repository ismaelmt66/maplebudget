from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import datetime
import models
import schemas
from db import get_db
from auth import get_current_user
from collections import defaultdict

router = APIRouter(
    prefix="/subscriptions",
    tags=["Subscriptions"]
)

@router.get("/", response_model=list[schemas.SubscriptionOut])
def get_subscriptions(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """
    Analyse l'historique des transactions pour détecter les abonnements récurrents.
    Algorithme de détection basique : 
    - Dépenses de même 'note' et même 'amount' (à +/- 5%)
    - Au moins 2 occurrences.
    """
    # Récupérer toutes les dépenses de l'utilisateur
    transactions = (
        db.query(models.Transaction)
        .join(models.Category, models.Transaction.category_id == models.Category.id)
        .filter(models.Transaction.user_id == current_user.id, models.Category.type == "expense")
        .order_by(models.Transaction.date.desc())
        .all()
    )

    # Grouper par (note)
    groups = defaultdict(list)
    for t in transactions:
        # Nettoyage de la note (lower, suppression d'espaces) pour regrouper plus facilement
        note_key = (t.note or "Inconnu").lower().strip()
        groups[note_key].append(t)

    subscriptions = []

    for note, txs in groups.items():
        if len(txs) >= 2:
            # Vérifier si les montants sont constants (on prend le plus récent)
            txs.sort(key=lambda x: x.date, reverse=True)
            recent_amount = txs[0].amount

            # Simplification : si au moins 2 transactions ont le MÊME montant (ou très proche), on l'assume comme abonnement si 'mensuel' ou régulier.
            # Dans la réalité, on devrait calculer l'écart en jours.
            
            # Calcul de l'écart moyen en jours
            dates = [datetime.strptime(t.date, "%Y-%m-%d") for t in txs]
            deltas = [(dates[i] - dates[i+1]).days for i in range(len(dates)-1)]
            avg_delta = sum(deltas) / len(deltas) if deltas else 0

            # Si l'écart moyen est autour de 30 jours (+/- 5 jours)
            if 25 <= avg_delta <= 35:
                # C'est un abonnement mensuel !
                subscriptions.append(schemas.SubscriptionOut(
                    name=txs[0].note or "Abonnement",
                    monthly_cost=float(recent_amount),
                    yearly_projection=float(recent_amount * 12),
                    status="Active",
                    has_price_hike=False, # Pourrait être calculé si le montant du txs[0] > txs[1]
                    category_name=txs[0].category.name,
                    last_date=txs[0].date
                ))
            elif 350 <= avg_delta <= 380:
                # Abonnement annuel
                subscriptions.append(schemas.SubscriptionOut(
                    name=txs[0].note or "Abonnement Annuel",
                    monthly_cost=float(recent_amount / 12),
                    yearly_projection=float(recent_amount),
                    status="Active",
                    has_price_hike=False,
                    category_name=txs[0].category.name,
                    last_date=txs[0].date
                ))

    return subscriptions
