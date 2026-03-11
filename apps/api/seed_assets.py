import sys
import random
from datetime import date as dt_date, timedelta
from db import SessionLocal, engine, Base
from models import User, Asset, AssetHistory

def seed_assets(email: str):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            print(f"Error: User {email} not found.")
            return

        # Check if user already has assets
        if db.query(Asset).filter(Asset.user_id == user.id).count() > 0:
            print("Assets already seeded for this user.")
            return

        # Create assets
        assets_data = [
            {"name": "Compte Courant BCEE", "type": "checking", "balance": 4530.20},
            {"name": "Livret A", "type": "savings", "balance": 12500.00},
            {"name": "PEA Bourse", "type": "stock", "balance": 28450.50},
            {"name": "Portefeuille Crypto", "type": "crypto", "balance": 8200.75}
        ]

        today = dt_date.today()
        
        for data in assets_data:
            a = Asset(name=data["name"], type=data["type"], balance=data["balance"], user_id=user.id)
            db.add(a)
            db.commit()
            db.refresh(a)

            # Generate history backwards for 6 months (one point per 7 days approx)
            current_balance = float(data["balance"])
            
            # Start 6 months ago (approx 180 days)
            days_back = 180
            
            while days_back >= 0:
                d = today - timedelta(days=days_back)
                
                # Add some variations depending on asset type
                if data["type"] == "checking":
                    current_balance += random.uniform(-500, +500)
                elif data["type"] == "savings":
                    current_balance += random.uniform(0, 150) # Mostly goes up
                elif data["type"] == "stock":
                    current_balance *= random.uniform(0.98, 1.03) # 2% down to 3% up
                elif data["type"] == "crypto":
                    current_balance *= random.uniform(0.90, 1.15) # High volatility
                
                # Ensure no negative balances for savings/crypto for simplicity
                if current_balance < 0:
                    current_balance = 0
                
                h = AssetHistory(asset_id=a.id, date=d.strftime("%Y-%m-%d"), balance=round(current_balance, 2))
                db.add(h)
                
                days_back -= random.randint(5, 12) # Update every ~1 week

            db.commit()
            
            # Update the current balance to be the last history point to ensure consistency
            last_h = db.query(AssetHistory).filter(AssetHistory.asset_id == a.id).order_by(AssetHistory.date.desc()).first()
            if last_h:
                a.balance = last_h.balance
                db.commit()

        print(f"Successfully seeded 4 assets and their history for user {email}")

    finally:
        db.close()

if __name__ == "__main__":
    email = sys.argv[1] if len(sys.argv) > 1 else "taffa2@gmail.com"
    seed_assets(email)
