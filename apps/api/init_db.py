"""Script simple pour initialiser le schéma de la base.

Exécutez ce script une fois en développement pour créer le fichier sqlite, ou
dans une nouvelle instance Postgres.
"""

from db import Base, engine
import models  # noqa: F401  (import models so that metadata is registered)

def init_db():
    Base.metadata.create_all(bind=engine)

if __name__ == "__main__":
    init_db()
