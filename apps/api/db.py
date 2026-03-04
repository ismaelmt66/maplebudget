"""Configuration de la base de données et utilitaire de session.

Par défaut on utilise SQLite en développement ; l’URL de connexion peut être
surchargée via des variables d’environnement ou la configuration Docker avant
de déployer sur Postgres ou un autre SGBD.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

DATABASE_URL = "sqlite:///./app.db"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},  # required for SQLite + FastAPI
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
