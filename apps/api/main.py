# ruff: noqa: E402
"""NexLedger API — FastAPI application entry point.

Configures middleware, routers, and startup hooks.  All secrets and config
are loaded from environment variables via ``settings.py``.
"""

from dotenv import load_dotenv
load_dotenv()

import logging
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from settings import get_settings

logging.basicConfig(
    level=logging.DEBUG if get_settings().DEBUG else logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger("nexledger")
_settings = get_settings()


# ── Lifespan (replaces deprecated @app.on_event) ────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    if _settings.is_sqlite:
        from db import engine, Base
        import models  # noqa: F401
        import analytics.models  # noqa: F401
        Base.metadata.create_all(bind=engine)
        logger.info("SQLite dev mode — tables synced from ORM metadata")
    else:
        logger.info("Production DB detected — expecting Alembic-managed schema")
    yield


# ── App factory ──────────────────────────────────────────────────────

app = FastAPI(
    title=_settings.APP_NAME,
    version=_settings.APP_VERSION,
    lifespan=lifespan,
    docs_url="/docs" if _settings.DEBUG else None,
    redoc_url="/redoc" if _settings.DEBUG else None,
)


# ── Observability ─────────────────────────────────────────────────────

from observability import add_timing_middleware, init_sentry  # noqa: E402
init_sentry(app)
add_timing_middleware(app)


# ── CORS — restricted to configured origins ──────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=_settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


# ── Rate-limit middleware (lightweight, in-process) ──────────────────

from collections import defaultdict
import time

_rate_limit_store: dict[str, list[float]] = defaultdict(list)
_AUTH_PATHS = {"/auth/token", "/auth/register"}

def _parse_rate(rate_str: str) -> tuple[int, int]:
    count, period = rate_str.split("/")
    periods = {"second": 1, "minute": 60, "hour": 3600}
    return int(count), periods.get(period, 60)


@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    client_ip = request.client.host if request.client else "unknown"
    path = request.url.path

    if path in _AUTH_PATHS:
        max_requests, window = _parse_rate(_settings.RATE_LIMIT_AUTH)
    else:
        max_requests, window = _parse_rate(_settings.RATE_LIMIT_DEFAULT)

    key = f"{client_ip}:{path}"
    now = time.time()
    _rate_limit_store[key] = [t for t in _rate_limit_store[key] if now - t < window]

    if len(_rate_limit_store[key]) >= max_requests:
        return JSONResponse(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            content={"detail": "Too many requests. Please try again later."},
        )

    _rate_limit_store[key].append(now)
    response = await call_next(request)
    return response


# ── Security headers middleware ──────────────────────────────────────

@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    if not _settings.DEBUG:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


# ── Request ID middleware (structured logging) ───────────────────────

@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID", uuid.uuid4().hex[:16])
    request.state.request_id = request_id
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    logger.info(
        "%s %s %s [%s]",
        request.method,
        request.url.path,
        response.status_code,
        request_id,
    )
    return response


# ── Standardized error handlers ──────────────────────────────────────

from errors import register_exception_handlers  # noqa: E402
register_exception_handlers(app)


# ── Healthcheck (unauthenticated) ────────────────────────────────────

@app.get("/healthz", tags=["ops"])
async def healthz():
    return {"status": "ok"}


@app.get("/readyz", tags=["ops"])
async def readyz():
    from sqlalchemy import text
    from db import engine
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {"status": "ready", "db": "ok"}
    except Exception as exc:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"status": "not ready", "db": str(exc)},
        )


# ── Background job status ─────────────────────────────────────────────

@app.get("/jobs/{job_id}", tags=["ops"])
async def job_status_endpoint(job_id: str):
    from workers.queue import get_job
    return get_job(job_id)


# ── Routers ──────────────────────────────────────────────────────────

from routers import auth as auth_router
from routers import categories as categories_router
from routers import transactions as transactions_router
from routers import dashboard as dashboard_router
from routers import goals as goals_router
from routers import assets as assets_router
from routers import recurring as recurring_router
from routers import budget_alerts as budget_alerts_router
from routers import health as health_router
from routers import insights as insights_router
from routers import social as social_router
from routers import canada as canada_router
from routers import subscriptions as subscriptions_router
from routers import bank as bank_router
from routers import admin as admin_router
from routers import imports as imports_router
from routers import gamification as gamification_router

app.include_router(auth_router.router)
app.include_router(categories_router.router)
app.include_router(transactions_router.router)
app.include_router(dashboard_router.router)
app.include_router(goals_router.router)
app.include_router(assets_router.router)
app.include_router(recurring_router.router)
app.include_router(budget_alerts_router.router)
app.include_router(health_router.router)
app.include_router(insights_router.router)
app.include_router(social_router.router)
app.include_router(canada_router.router)
app.include_router(bank_router.router)
app.include_router(subscriptions_router.router, prefix="/analytics")
app.include_router(admin_router.router)
app.include_router(imports_router.router)
app.include_router(gamification_router.router)
