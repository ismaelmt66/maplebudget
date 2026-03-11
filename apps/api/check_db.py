from db import SessionLocal, Base, engine
import models

Base.metadata.create_all(bind=engine)
db = SessionLocal()
users = db.query(models.User).all()
print("Users in DB:", [u.email for u in users])
db.close()
