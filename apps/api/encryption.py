"""Symmetric encryption helpers for sensitive data at rest.

Uses Fernet (AES-128-CBC + HMAC-SHA256) from the ``cryptography`` package.
The key is loaded from ``Settings.ENCRYPTION_KEY``.  When the key is empty
(local dev without Plaid), encryption/decryption are no-ops so the app
still runs — but a warning is logged.
"""

from __future__ import annotations

import logging

from settings import get_settings

logger = logging.getLogger(__name__)

_fernet = None


def _get_fernet():
    global _fernet
    if _fernet is not None:
        return _fernet

    key = get_settings().ENCRYPTION_KEY
    if not key:
        logger.warning(
            "ENCRYPTION_KEY is not set — sensitive values will be stored in plaintext. "
            "Generate one with: python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
        )
        return None

    from cryptography.fernet import Fernet

    _fernet = Fernet(key.encode() if isinstance(key, str) else key)
    return _fernet


def encrypt(plaintext: str) -> str:
    """Encrypt a string.  Returns the original if no key is configured."""
    f = _get_fernet()
    if f is None:
        return plaintext
    return f.encrypt(plaintext.encode()).decode()


def decrypt(ciphertext: str) -> str:
    """Decrypt a string.  Returns the original if no key is configured."""
    f = _get_fernet()
    if f is None:
        return ciphertext
    try:
        return f.decrypt(ciphertext.encode()).decode()
    except Exception:
        logger.warning("Decryption failed — returning raw value (possibly unencrypted legacy data)")
        return ciphertext
