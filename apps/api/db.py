"""Database engine, session factory, and dependency for FastAPI.

Reads DATABASE_URL from settings (environment).  Applies SQLite-specific
connect_args only when the URL targets SQLite; otherwise assumes PostgreSQL
with sane pool defaults for production.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

from settings import get_settings

_settings = get_settings()

_connect_args: dict = {}
_engine_kwargs: dict = {}

if _settings.is_sqlite:
    _connect_args = {"check_same_thread": False}
else:
    _engine_kwargs = {
        "pool_size": 10,
        "max_overflow": 20,
        "pool_pre_ping": True,
    }

engine = create_engine(
    _settings.DATABASE_URL,
    connect_args=_connect_args,
    **_engine_kwargs,
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    """FastAPI dependency that yields a scoped DB session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
