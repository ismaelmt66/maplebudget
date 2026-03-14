"""Pluggable cache abstraction layer.

Supports two backends:
- **In-memory** (default): dict-based, suitable for single-worker dev.
- **Redis**: activated when REDIS_URL is set in environment.

All existing call sites (`get_ai_analysis_cache`, `set_ai_analysis_cache`,
`invalidate_ai_analysis_cache`) continue to work without changes.

New generic API:
    cache_get(key)  → value | None
    cache_set(key, value, ttl_seconds)
    cache_delete(key)
"""

from __future__ import annotations

import json
import logging
import os
import time
from typing import Any

logger = logging.getLogger("nexledger.cache")

_REDIS_URL = os.environ.get("REDIS_URL", "")
_redis_client = None
DEFAULT_TTL = 3600


def _get_redis():
    global _redis_client
    if _redis_client is not None:
        return _redis_client
    if not _REDIS_URL:
        return None
    try:
        import redis
        _redis_client = redis.from_url(_REDIS_URL, decode_responses=True)
        _redis_client.ping()
        logger.info("Redis cache connected at %s", _REDIS_URL)
        return _redis_client
    except Exception as exc:
        logger.warning("Redis unavailable (%s), falling back to in-memory cache", exc)
        return None


# ── In-memory fallback ───────────────────────────────────────────────

_memory_store: dict[str, tuple[float, Any]] = {}


def cache_get(key: str) -> Any | None:
    r = _get_redis()
    if r:
        val = r.get(key)
        if val is not None:
            try:
                return json.loads(val)
            except (json.JSONDecodeError, TypeError):
                return val
        return None

    entry = _memory_store.get(key)
    if entry is None:
        return None
    expires_at, value = entry
    if time.time() > expires_at:
        _memory_store.pop(key, None)
        return None
    return value


def cache_set(key: str, value: Any, ttl: int = DEFAULT_TTL) -> None:
    r = _get_redis()
    if r:
        r.setex(key, ttl, json.dumps(value) if not isinstance(value, str) else value)
        return
    _memory_store[key] = (time.time() + ttl, value)


def cache_delete(key: str) -> None:
    r = _get_redis()
    if r:
        r.delete(key)
        return
    _memory_store.pop(key, None)


# ── Legacy API (backward-compatible) ─────────────────────────────────

def get_ai_analysis_cache(user_id: int) -> str | None:
    return cache_get(f"ai_analysis:{user_id}")


def set_ai_analysis_cache(user_id: int, report: str) -> None:
    cache_set(f"ai_analysis:{user_id}", report, DEFAULT_TTL)


def invalidate_ai_analysis_cache(user_id: int) -> None:
    cache_delete(f"ai_analysis:{user_id}")
