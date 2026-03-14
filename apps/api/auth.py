"""Authentication utilities: password hashing, JWT token lifecycle, and
the FastAPI dependency that extracts the current user.

All secrets come from Settings (environment variables).  Access tokens are
short-lived (default 15 min); refresh tokens are long-lived and carry a
distinct ``type`` claim so they cannot be used as bearer tokens.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

import models
from db import get_db
from settings import get_settings

_settings = get_settings()

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/token")


# ── Password helpers ─────────────────────────────────────────────────

def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    return pwd_context.verify(password, hashed)


# ── Token creation ───────────────────────────────────────────────────

def create_access_token(subject: str, expires_minutes: Optional[int] = None) -> str:
    """Short-lived JWT for API authorization."""
    minutes = expires_minutes or _settings.ACCESS_TOKEN_EXPIRE_MINUTES
    expire = datetime.now(timezone.utc) + timedelta(minutes=minutes)
    payload = {
        "sub": subject,
        "exp": expire,
        "type": "access",
        "jti": uuid.uuid4().hex,
    }
    return jwt.encode(payload, _settings.SECRET_KEY, algorithm=_settings.JWT_ALGORITHM)


def create_refresh_token(subject: str) -> str:
    """Long-lived JWT used only to obtain new access tokens."""
    expire = datetime.now(timezone.utc) + timedelta(days=_settings.REFRESH_TOKEN_EXPIRE_DAYS)
    payload = {
        "sub": subject,
        "exp": expire,
        "type": "refresh",
        "jti": uuid.uuid4().hex,
    }
    return jwt.encode(payload, _settings.SECRET_KEY, algorithm=_settings.JWT_ALGORITHM)


# ── Token validation ─────────────────────────────────────────────────

def decode_token(token: str, *, expected_type: str = "access") -> str:
    """Validate a JWT and return the ``sub`` claim.

    Raises ``JWTError`` when the token is invalid, expired, or has the
    wrong ``type`` claim.
    """
    try:
        payload = jwt.decode(
            token,
            _settings.SECRET_KEY,
            algorithms=[_settings.JWT_ALGORITHM],
        )
        sub: str | None = payload.get("sub")
        token_type: str | None = payload.get("type")
        if not sub:
            raise JWTError("Missing sub")
        if token_type != expected_type:
            raise JWTError(f"Expected {expected_type} token, got {token_type}")
        return sub
    except JWTError:
        raise


# ── FastAPI dependency ───────────────────────────────────────────────

def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> models.User:
    """Extract and validate the current user from the bearer token."""
    try:
        sub = decode_token(token, expected_type="access")
        user_id = int(sub)
    except (JWTError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    return user
