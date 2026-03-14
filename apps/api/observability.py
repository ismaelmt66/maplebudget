"""Observability hooks for NexLedger.

Provides optional Sentry integration and a timing middleware for
request latency tracking.  Both are no-ops when not configured.

Activate Sentry by setting SENTRY_DSN in environment.
"""

from __future__ import annotations

import logging
import os
import time

from fastapi import FastAPI, Request

logger = logging.getLogger("nexledger.observability")


def init_sentry(app: FastAPI) -> None:
    """Initialize Sentry if SENTRY_DSN is configured."""
    dsn = os.environ.get("SENTRY_DSN", "")
    if not dsn:
        logger.info("SENTRY_DSN not set — Sentry disabled")
        return
    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration

        sentry_sdk.init(
            dsn=dsn,
            traces_sample_rate=float(os.environ.get("SENTRY_TRACES_RATE", "0.1")),
            profiles_sample_rate=float(os.environ.get("SENTRY_PROFILES_RATE", "0.1")),
            integrations=[
                FastApiIntegration(transaction_style="endpoint"),
                SqlalchemyIntegration(),
            ],
            environment=os.environ.get("SENTRY_ENV", "development"),
        )
        logger.info("Sentry initialized (env=%s)", os.environ.get("SENTRY_ENV", "development"))
    except ImportError:
        logger.warning("sentry-sdk not installed — Sentry disabled")
    except Exception as exc:
        logger.warning("Sentry init failed: %s", exc)


def add_timing_middleware(app: FastAPI) -> None:
    """Add middleware that tracks request duration in X-Process-Time header."""

    @app.middleware("http")
    async def timing_middleware(request: Request, call_next):
        start = time.perf_counter()
        response = await call_next(request)
        duration_ms = (time.perf_counter() - start) * 1000
        response.headers["X-Process-Time"] = f"{duration_ms:.1f}ms"
        if duration_ms > 2000:
            logger.warning(
                "Slow request: %s %s took %.0fms",
                request.method,
                request.url.path,
                duration_ms,
            )
        return response
