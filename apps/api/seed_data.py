"""Seed script: creates a demo user with categories, transactions, goals, and assets.

Usage:
    cd apps/api
    python seed_data.py
"""

import os
import random
from datetime import date, timedelta

os.environ.setdefault("SECRET_KEY", "dev-seed-key")

from db import Base, engine, SessionLocal
from auth import hash_password
import models
import analytics.models  # noqa: F401

Base.metadata.create_all(bind=engine)

db = SessionLocal()


def seed():
    existing = db.query(models.User).filter(models.User.email == "demo@nexledger.com").first()
    if existing:
        print("Demo user already exists. Skipping seed.")
        return

    # 1. Create demo user
    user = models.User(
        email="demo@nexledger.com",
        hashed_password=hash_password("demo1234"),
        name="Demo User",
        role="admin",
        country="Canada",
        currency="CAD",
        income_level="50k-100k",
        financial_knowledge="intermediate",
        risk_tolerance="medium",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    print(f"Created user: {user.email} (id={user.id})")

    # 2. Create categories
    categories_data = [
        ("Salary", "income", None),
        ("Freelance", "income", None),
        ("Housing", "expense", 1200),
        ("Groceries", "expense", 500),
        ("Transport", "expense", 200),
        ("Entertainment", "expense", 150),
        ("Health", "expense", 100),
        ("Subscriptions", "expense", 80),
        ("Clothing", "expense", 100),
        ("Savings", "expense", 500),
    ]
    cats = {}
    for name, cat_type, budget_limit in categories_data:
        cat = models.Category(
            name=name, type=cat_type,
            budget_limit=budget_limit, user_id=user.id,
        )
        db.add(cat)
        db.commit()
        db.refresh(cat)
        cats[name] = cat
    print(f"Created {len(cats)} categories")

    # 3. Generate 6 months of transactions
    today = date.today()
    tx_count = 0
    for month_offset in range(6):
        month_start = (today.replace(day=1) - timedelta(days=30 * month_offset)).replace(day=1)

        # Salary
        db.add(models.Transaction(
            amount=4500, date=month_start.strftime("%Y-%m-%d"),
            note="Monthly salary", category_id=cats["Salary"].id,
            user_id=user.id,
        ))
        tx_count += 1

        # Occasional freelance
        if random.random() > 0.5:
            db.add(models.Transaction(
                amount=random.choice([500, 800, 1200]),
                date=(month_start + timedelta(days=random.randint(5, 25))).strftime("%Y-%m-%d"),
                note="Freelance project", category_id=cats["Freelance"].id,
                user_id=user.id,
            ))
            tx_count += 1

        # Expense transactions
        expense_cats = [c for c in cats.values() if c.type == "expense"]
        for _ in range(random.randint(15, 25)):
            cat = random.choice(expense_cats)
            base = float(cat.budget_limit) if cat.budget_limit else 50
            amount = round(random.uniform(base * 0.1, base * 0.4), 2)
            day = random.randint(1, 28)
            tx_date = month_start.replace(day=day)
            notes = {
                "Groceries": ["Metro", "IGA", "Costco", "Walmart"],
                "Transport": ["Gas station", "STM pass", "Uber"],
                "Entertainment": ["Netflix", "Cinema", "Restaurant"],
                "Health": ["Pharmacy", "Dentist", "Gym"],
                "Subscriptions": ["Spotify", "Apple Music", "Cloud storage"],
                "Housing": ["Rent", "Hydro", "Internet"],
                "Clothing": ["H&M", "Zara", "Winners"],
                "Savings": ["Emergency fund", "TFSA deposit"],
            }
            note = random.choice(notes.get(cat.name, ["Misc"]))
            db.add(models.Transaction(
                amount=amount, date=tx_date.strftime("%Y-%m-%d"),
                note=note, category_id=cat.id, user_id=user.id,
            ))
            tx_count += 1

    db.commit()
    print(f"Created {tx_count} transactions")

    # 4. Create goals
    goals_data = [
        ("Emergency Fund", 15000, 8500, "2027-06-01"),
        ("Vacation", 5000, 1200, "2026-12-01"),
        ("Down Payment", 50000, 12000, "2029-01-01"),
    ]
    for title, target, current, target_date in goals_data:
        db.add(models.Goal(
            title=title, target_amount=target,
            current_amount=current, target_date=target_date,
            user_id=user.id,
        ))
    db.commit()
    print(f"Created {len(goals_data)} goals")

    # 5. Create assets
    assets_data = [
        ("Chequing Account", "checking", 3200),
        ("Savings Account", "savings", 8500),
        ("TFSA", "savings", 12000),
        ("Stock Portfolio", "stock", 5500),
        ("Crypto", "crypto", 1200),
    ]
    for name, asset_type, balance in assets_data:
        db.add(models.Asset(
            name=name, type=asset_type,
            balance=balance, user_id=user.id,
        ))
    db.commit()
    print(f"Created {len(assets_data)} assets")

    # 6. Create budget alerts
    for cat_name in ["Groceries", "Entertainment", "Transport"]:
        cat = cats[cat_name]
        if cat.budget_limit:
            db.add(models.BudgetAlert(
                user_id=user.id, category_id=cat.id,
                monthly_limit=float(cat.budget_limit),
                created_at=today.strftime("%Y-%m-%d"),
            ))
    db.commit()
    print("Created budget alerts")

    print(f"\n=== Seed complete ===")
    print(f"Login: demo@nexledger.com / demo1234")


if __name__ == "__main__":
    try:
        seed()
    finally:
        db.close()
