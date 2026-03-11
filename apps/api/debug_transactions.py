"""Debug script that calls the list_transactions logic directly without FastAPI."""
import traceback
import sys
sys.path.insert(0, '.')

from db import SessionLocal, Base, engine
import models

Base.metadata.create_all(bind=engine)
db = SessionLocal()

# Get user
user = db.query(models.User).filter(models.User.email == "cors_test_fresh2@test.com").first()
print("User:", user.id, user.email)

# Try fetching transactions
try:
    txs = db.query(models.Transaction).filter(models.Transaction.user_id == user.id).order_by(models.Transaction.id.desc()).all()
    print("Raw transactions:", txs)
    
    # Try serializing
    import schemas
    from pydantic import TypeAdapter
    ta = TypeAdapter(list[schemas.TransactionOut])
    result = ta.validate_python(txs, from_attributes=True)
    print("Serialized OK:", result)
except Exception:
    print("=== EXCEPTION ===")
    traceback.print_exc()

db.close()
