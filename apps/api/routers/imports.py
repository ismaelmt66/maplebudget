"""Transaction import routes: CSV and OFX/QFX file upload with validation."""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import Optional

import models
from auth import get_current_user
from db import get_db
from services.import_service import parse_csv, parse_ofx, import_transactions

router = APIRouter(prefix="/import", tags=["import"])


@router.post("/csv")
async def import_csv(
    file: UploadFile = File(...),
    default_category_id: Optional[int] = Form(None),
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="File must be a .csv file")

    content = await file.read()
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        try:
            text = content.decode("latin-1")
        except UnicodeDecodeError:
            raise HTTPException(status_code=400, detail="Unable to decode file. Use UTF-8 or Latin-1 encoding.")

    parsed, parse_errors = parse_csv(text)
    if not parsed and parse_errors:
        raise HTTPException(status_code=400, detail={"message": "Failed to parse CSV", "errors": parse_errors})

    cat_id = _resolve_default_category(db, current.id, default_category_id)
    result = import_transactions(db, current.id, parsed, cat_id)

    return {
        "imported": result.imported,
        "skipped": result.skipped,
        "errors": parse_errors + result.errors,
        "total_rows": len(parsed) + result.skipped,
    }


@router.post("/ofx")
async def import_ofx(
    file: UploadFile = File(...),
    default_category_id: Optional[int] = Form(None),
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file uploaded")

    ext = file.filename.lower().rsplit(".", 1)[-1] if "." in file.filename else ""
    if ext not in ("ofx", "qfx"):
        raise HTTPException(status_code=400, detail="File must be .ofx or .qfx")

    content = await file.read()
    try:
        text = content.decode("utf-8")
    except UnicodeDecodeError:
        text = content.decode("latin-1")

    parsed, parse_errors = parse_ofx(text)
    if not parsed and parse_errors:
        raise HTTPException(status_code=400, detail={"message": "Failed to parse OFX/QFX", "errors": parse_errors})

    cat_id = _resolve_default_category(db, current.id, default_category_id)
    result = import_transactions(db, current.id, parsed, cat_id)

    return {
        "imported": result.imported,
        "skipped": result.skipped,
        "errors": parse_errors + result.errors,
        "total_rows": len(parsed) + result.skipped,
    }


@router.post("/preview/csv")
async def preview_csv(
    file: UploadFile = File(...),
    current: models.User = Depends(get_current_user),
):
    """Parse a CSV without importing, to let the user review before committing."""
    content = await file.read()
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = content.decode("latin-1")

    parsed, errors = parse_csv(text)
    return {
        "preview": [
            {"date": t.date, "amount": t.amount, "description": t.description}
            for t in parsed[:50]
        ],
        "total": len(parsed),
        "errors": errors,
    }


def _resolve_default_category(db: Session, user_id: int, category_id: Optional[int]) -> int:
    """Return the given category ID if valid, or find/create a default 'Import' category."""
    if category_id:
        cat = db.query(models.Category).filter(
            models.Category.id == category_id,
            models.Category.user_id == user_id,
        ).first()
        if cat:
            return cat.id

    default = db.query(models.Category).filter(
        models.Category.user_id == user_id,
        models.Category.name.ilike("%import%"),
    ).first()
    if default:
        return default.id

    fallback = db.query(models.Category).filter(
        models.Category.user_id == user_id,
    ).first()
    if fallback:
        return fallback.id

    new_cat = models.Category(name="Import", type="expense", user_id=user_id)
    db.add(new_cat)
    db.commit()
    db.refresh(new_cat)
    return new_cat.id
