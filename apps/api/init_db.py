from db import Base, engine
import models  # noqa: F401  (importe les modèles pour que Base les connaisse)

def init_db():
    Base.metadata.create_all(bind=engine)

if __name__ == "__main__":
    init_db()
