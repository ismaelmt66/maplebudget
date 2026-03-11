"""Utilitaires d’authentification : hachage de mots de passe et gestion des
jetons JWT.

La configuration de développement est codée en dur ; en production, remplacez
par des variables d’environnement.
"""

from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import jwt, JWTError
from passlib.context import CryptContext
from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from db import get_db
import models

# DEV defaults (should be overridden via environment variables in production)
SECRET_KEY = "dev_secret_change_me"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24h

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")


def hash_password(password: str) -> str:
    """Hache un mot de passe en clair avec un algorithme lent adapté au
    stockage."""
    return pwd_context.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    """Vérifie un mot de passe en clair contre une valeur déjà hachée."""
    return pwd_context.verify(password, hashed)


def create_access_token(subject: str, expires_minutes: Optional[int] = None) -> str:
    """Génère un jeton JWT (bearer) contenant l’identifiant utilisateur (`sub`).

    L’expiration du jeton est configurable mais vaut 24 h par défaut.
    """
    minutes = expires_minutes or ACCESS_TOKEN_EXPIRE_MINUTES
    expire = datetime.now(timezone.utc) + timedelta(minutes=minutes)
    to_encode = {"sub": subject, "exp": expire}
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> str:
    """Valide un JWT et retourne la revendication `sub` (id utilisateur).

    Lève une JWTError si le jeton est invalide ou expiré.
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        sub = payload.get("sub")
        if not sub:
            raise JWTError("Missing sub")
        return sub
    except JWTError:
        raise

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/token")

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> models.User:
    """Extrait et valide l’utilisateur courant à partir du jeton bearer."""
    try:
        sub = decode_token(token)
        user_id = int(sub)
    except (JWTError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid token")

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user