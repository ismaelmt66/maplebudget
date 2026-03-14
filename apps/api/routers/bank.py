"""Bank connection and transaction sync router.

Replaces the banking logic previously embedded in social.py.  Uses
the provider-agnostic BankService — no Plaid-specific code here.
"""

from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models
import schemas
from auth import get_current_user
from banking.bank_service import get_bank_service
from db import get_db

router = APIRouter(prefix="/bank", tags=["Banking"])


@router.get("/status")
def bank_status():
    svc = get_bank_service()
    return {"demo_mode": svc.is_demo, "provider": svc.provider_name}


@router.get("/link-token", response_model=schemas.BankLinkTokenOut)
def get_link_token(current: models.User = Depends(get_current_user)):
    svc = get_bank_service()
    try:
        result = svc.create_link_token(current.id)
        return schemas.BankLinkTokenOut(
            link_token=result.link_token,
            demo_mode=result.demo_mode,
            demo_banks=result.demo_banks,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Banking provider error: {exc}")


@router.post("/exchange-token", response_model=schemas.BankConnectionOut)
def exchange_token(
    payload: schemas.BankExchangeRequest,
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    svc = get_bank_service()
    try:
        conn = svc.exchange_token(
            db, current.id, payload.public_token,
            institution_id=payload.institution_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Exchange error: {exc}")

    try:
        svc.sync_connection(db, conn, current.id)
    except Exception:
        pass

    tx_count = db.query(models.Transaction).filter(
        models.Transaction.bank_connection_id == conn.id
    ).count()
    return schemas.BankConnectionOut(
        id=conn.id, institution_name=conn.institution_name,
        item_id=conn.item_id, tx_count=tx_count,
    )


@router.post("/sync/{connection_id}")
def sync_bank(
    connection_id: int,
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    conn = db.query(models.BankConnection).filter(
        models.BankConnection.id == connection_id,
        models.BankConnection.user_id == current.id,
    ).first()
    if not conn:
        raise HTTPException(status_code=404, detail="Connexion bancaire introuvable.")
    svc = get_bank_service()
    return svc.sync_connection(db, conn, current.id)


@router.post("/sync-all")
def sync_all_banks(
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    svc = get_bank_service()
    results = svc.sync_all(db, current.id)
    return {"synced": len(results), "results": results}


@router.get("/connections", response_model=List[schemas.BankConnectionOut])
def list_bank_connections(
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    connections = db.query(models.BankConnection).filter(
        models.BankConnection.user_id == current.id
    ).all()
    result = []
    for conn in connections:
        tx_count = db.query(models.Transaction).filter(
            models.Transaction.bank_connection_id == conn.id
        ).count()
        result.append(schemas.BankConnectionOut(
            id=conn.id, institution_name=conn.institution_name,
            item_id=conn.item_id, tx_count=tx_count,
            last_sync=conn.last_synced_at,
        ))
    return result


@router.delete("/connections/{connection_id}")
def delete_bank_connection(
    connection_id: int,
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    conn = db.query(models.BankConnection).filter(
        models.BankConnection.id == connection_id,
        models.BankConnection.user_id == current.id,
    ).first()
    if not conn:
        raise HTTPException(status_code=404, detail="Connexion introuvable.")
    db.query(models.Transaction).filter(
        models.Transaction.bank_connection_id == connection_id
    ).delete()
    db.delete(conn)
    db.commit()
    return {"message": "Connexion bancaire supprimée."}
