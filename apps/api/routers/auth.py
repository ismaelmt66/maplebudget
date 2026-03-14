"""Authentication and onboarding routes.

Changes from previous version:
- Login returns refresh_token alongside access_token
- Login gates on 2FA when enabled (returns mfa_required=True)
- /auth/mfa/verify completes login when 2FA is required
- /auth/refresh issues new access token from refresh token
- /auth/change-password uses typed Pydantic schema
- /onboarding/setup-categories uses typed schema
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from jose import JWTError
from sqlalchemy.orm import Session

import models
import schemas
from auth import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_current_user,
    hash_password,
    verify_password,
)
from db import get_db

router = APIRouter()


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _log_audit(db: Session, user_id: int, action: str, details: str | None = None):
    db.add(models.AuditLog(
        user_id=user_id, action=action, details=details,
        created_at=_now_iso(),
    ))
    db.commit()


# ── Registration ─────────────────────────────────────────────────────

@router.post("/auth/register", response_model=schemas.UserOut, status_code=status.HTTP_201_CREATED)
def register(payload: schemas.UserCreate, db: Session = Depends(get_db)):
    if len(payload.password.encode("utf-8")) > 256:
        raise HTTPException(status_code=400, detail="Password too long (max 256 bytes).")
    if len(payload.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters.")
    exists = db.query(models.User).filter(models.User.email == payload.email).first()
    if exists:
        raise HTTPException(status_code=400, detail="Email already used")
    u = models.User(email=payload.email, hashed_password=hash_password(payload.password))
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


# ── Login (with 2FA gating) ─────────────────────────────────────────

@router.post("/auth/token", response_model=schemas.TokenOut)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == form.username).first()
    if not user or not verify_password(form.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if user.totp_enabled:
        return schemas.TokenOut(
            access_token="",
            refresh_token="",
            mfa_required=True,
        )

    access = create_access_token(subject=str(user.id))
    refresh = create_refresh_token(subject=str(user.id))
    _log_audit(db, user.id, "login", "Connexion réussie")
    return schemas.TokenOut(access_token=access, refresh_token=refresh)


@router.post("/auth/mfa/verify", response_model=schemas.TokenOut)
def mfa_verify(payload: schemas.MFALoginRequest, db: Session = Depends(get_db)):
    """Complete login when 2FA is enabled.  Requires email + password + TOTP code."""
    user = db.query(models.User).filter(models.User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.totp_enabled or not user.totp_secret:
        raise HTTPException(status_code=400, detail="2FA is not enabled for this account.")

    import pyotp
    totp = pyotp.TOTP(user.totp_secret)
    if not totp.verify(payload.totp_code, valid_window=1):
        raise HTTPException(status_code=401, detail="Invalid or expired TOTP code.")

    access = create_access_token(subject=str(user.id))
    refresh = create_refresh_token(subject=str(user.id))
    _log_audit(db, user.id, "login", "Connexion réussie (2FA)")
    return schemas.TokenOut(access_token=access, refresh_token=refresh)


# ── Refresh token ────────────────────────────────────────────────────

@router.post("/auth/refresh", response_model=schemas.TokenOut)
def refresh_token(payload: schemas.RefreshRequest, db: Session = Depends(get_db)):
    """Issue a new access token using a valid refresh token."""
    try:
        sub = decode_token(payload.refresh_token, expected_type="refresh")
        user_id = int(sub)
    except (JWTError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    access = create_access_token(subject=str(user.id))
    refresh = create_refresh_token(subject=str(user.id))
    return schemas.TokenOut(access_token=access, refresh_token=refresh)


# ── Current user ─────────────────────────────────────────────────────

@router.get("/auth/me", response_model=schemas.UserOut)
def me(current: models.User = Depends(get_current_user)):
    return current


# ── Onboarding ───────────────────────────────────────────────────────

@router.get("/auth/onboarding-status")
def onboarding_status(
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    has_categories = db.query(models.Category).filter(models.Category.user_id == current.id).first() is not None
    return {"is_onboarded": has_categories}


@router.get("/onboarding/default-categories")
def get_default_categories():
    return [
        {"name": "🏠 Logement", "type": "expense", "icon": "🏠", "suggested_budget": 800},
        {"name": "🍔 Alimentation", "type": "expense", "icon": "🍔", "suggested_budget": 400},
        {"name": "🚗 Transport", "type": "expense", "icon": "🚗", "suggested_budget": 200},
        {"name": "💊 Santé", "type": "expense", "icon": "💊", "suggested_budget": 100},
        {"name": "🎬 Loisirs", "type": "expense", "icon": "🎬", "suggested_budget": 150},
        {"name": "👕 Vêtements", "type": "expense", "icon": "👕", "suggested_budget": 100},
        {"name": "📱 Abonnements", "type": "expense", "icon": "📱", "suggested_budget": 80},
        {"name": "💼 Salaire", "type": "income", "icon": "💼", "suggested_budget": None},
        {"name": "💰 Épargne", "type": "expense", "icon": "💰", "suggested_budget": 300},
        {"name": "🏦 Investissements", "type": "expense", "icon": "🏦", "suggested_budget": 200},
    ]


@router.post("/onboarding/setup-categories")
def setup_onboarding_categories(
    payload: schemas.OnboardingCategoriesSetup,
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    created = []
    for cat in payload.categories:
        existing = db.query(models.Category).filter(
            models.Category.user_id == current.id,
            models.Category.name == cat.name,
        ).first()
        if not existing:
            new_cat = models.Category(
                user_id=current.id,
                name=cat.name,
                type=cat.type,
                budget_limit=cat.budget_limit,
            )
            db.add(new_cat)
            created.append(cat.name)
    db.commit()
    return {"created": len(created), "categories": created}


@router.post("/onboarding/profile", response_model=schemas.UserOut)
def update_onboarding_profile(
    payload: schemas.OnboardingProfileUpdate,
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    user = db.query(models.User).filter(models.User.id == current.id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if hasattr(user, field):
            setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return user


@router.post("/onboarding/complete")
def complete_onboarding(
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    return {"is_onboarded": True, "message": "Bienvenue sur NexLedger !"}


# ── 2FA TOTP ─────────────────────────────────────────────────────────

@router.post("/auth/2fa/setup", response_model=schemas.TwoFASetupOut)
def setup_2fa(
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    import pyotp
    import qrcode
    import base64
    from io import BytesIO

    secret = pyotp.random_base32()
    current.totp_secret = secret
    db.commit()
    totp = pyotp.TOTP(secret)
    uri = totp.provisioning_uri(name=current.email, issuer_name="NexLedger")
    img = qrcode.make(uri)
    buf = BytesIO()
    img.save(buf, format="PNG")
    qr_b64 = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()
    return schemas.TwoFASetupOut(secret=secret, provisioning_uri=uri, qr_data=qr_b64)


@router.post("/auth/2fa/verify")
def verify_2fa(
    payload: schemas.TwoFAVerifyRequest,
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    import pyotp
    if not current.totp_secret:
        raise HTTPException(status_code=400, detail="2FA non initialisé. Appelez /auth/2fa/setup d'abord.")
    totp = pyotp.TOTP(current.totp_secret)
    if not totp.verify(payload.code, valid_window=1):
        raise HTTPException(status_code=400, detail="Code invalide ou expiré.")
    current.totp_enabled = True
    db.commit()
    _log_audit(db, current.id, "2fa_enable")
    return {"ok": True, "message": "2FA activé avec succès."}


@router.post("/auth/2fa/disable")
def disable_2fa(
    payload: schemas.TwoFAVerifyRequest,
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    import pyotp
    if not current.totp_enabled or not current.totp_secret:
        raise HTTPException(status_code=400, detail="2FA non activé.")
    totp = pyotp.TOTP(current.totp_secret)
    if not totp.verify(payload.code, valid_window=1):
        raise HTTPException(status_code=400, detail="Code invalide.")
    current.totp_enabled = False
    current.totp_secret = None
    db.commit()
    _log_audit(db, current.id, "2fa_disable")
    return {"ok": True}


@router.get("/auth/2fa/status")
def get_2fa_status(current: models.User = Depends(get_current_user)):
    return {"enabled": current.totp_enabled}


# ── Password change (typed schema) ──────────────────────────────────

@router.post("/auth/change-password")
def change_password(
    payload: schemas.ChangePasswordRequest,
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    if len(payload.new_password) < 8:
        raise HTTPException(status_code=400, detail="Le nouveau mot de passe doit faire au moins 8 caractères.")
    if not verify_password(payload.old_password, current.hashed_password):
        raise HTTPException(status_code=400, detail="Mot de passe actuel incorrect.")
    current.hashed_password = hash_password(payload.new_password)
    db.commit()
    _log_audit(db, current.id, "password_change")
    return {"ok": True, "message": "Mot de passe modifié avec succès."}


# ── Audit logs ───────────────────────────────────────────────────────

@router.get("/audit-logs", response_model=list[schemas.AuditLogOut])
def get_audit_logs(
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    return (
        db.query(models.AuditLog)
        .filter(models.AuditLog.user_id == current.id)
        .order_by(models.AuditLog.created_at.desc())
        .limit(50)
        .all()
    )
