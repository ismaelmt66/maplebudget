"""
Seed script Phase 12 — Patrimoine Pro pour taffa2.

Ce script génère pour le compte taffa2 :
  - 6 actifs variés (courant, épargne, bourse, crypto, immo, dette)
  - Historique sur 12 mois avec tendances réalistes
  - 3 règles d'allocation automatiques
  - Catégories + transactions du mois courant

Usage :
    .venv\\Scripts\\python.exe seed_phase12.py [email]
"""

import sys
import random
from datetime import date as dt_date, timedelta

from db import SessionLocal, engine, Base
from models import User, Asset, AssetHistory, AllocationRule, Category, Transaction


def seed(email: str):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    random.seed(42)  # Reproductible

    try:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            print(f"❌ Utilisateur '{email}' introuvable.")
            return

        print(f"✅ Utilisateur trouvé : {user.email} (id={user.id})")

        # ─── 1. ACTIFS ──────────────────────────────────────────────────────────
        existing_assets = db.query(Asset).filter(Asset.user_id == user.id).count()
        if existing_assets > 0:
            print(f"ℹ️  {existing_assets} actif(s) déjà présents, on efface et on recommence...")
            db.query(AssetHistory).filter(
                AssetHistory.asset_id.in_(
                    db.query(Asset.id).filter(Asset.user_id == user.id)
                )
            ).delete(synchronize_session=False)
            db.query(Asset).filter(Asset.user_id == user.id).delete()
            db.commit()

        today = dt_date.today()

        assets_data = [
            {
                "name": "Compte Courant Desjardins",
                "type": "checking",
                "current_balance": 5820.40,
                "start_balance": 3200.00,
                "volatility": (-600, 700),          # peut fluctuer beaucoup
            },
            {
                "name": "Livret Épargne RBC",
                "type": "savings",
                "current_balance": 18750.00,
                "start_balance": 12000.00,
                "volatility": (50, 200),             # croissance régulière
            },
            {
                "name": "PEA — ETF World",
                "type": "stock",
                "current_balance": 34200.50,
                "start_balance": 25000.00,
                "is_pct": True,
                "volatility": (0.98, 1.04),          # % de variation
            },
            {
                "name": "Crypto — Bitcoin / ETH",
                "type": "crypto",
                "current_balance": 11450.75,
                "start_balance": 8000.00,
                "is_pct": True,
                "volatility": (0.88, 1.18),          # très volatile
            },
            {
                "name": "Immeuble Locatif #1",
                "type": "real_estate",
                "current_balance": 185000.00,
                "start_balance": 180000.00,
                "volatility": (0, 500),              # quasi stable, légère appréciation
            },
            {
                "name": "Prêt Hypothécaire",
                "type": "liability",
                "current_balance": 142000.00,
                "start_balance": 148000.00,
                "volatility": (-300, 0),             # baisse régulière (remboursement)
            },
        ]

        created_assets: list[Asset] = []

        for data in assets_data:
            asset = Asset(
                name=data["name"],
                type=data["type"],
                balance=data["current_balance"],
                user_id=user.id,
            )
            db.add(asset)
            db.commit()
            db.refresh(asset)
            created_assets.append(asset)

            # Générer l'historique sur 12 mois (~1 point par semaine)
            bal = float(data["start_balance"])
            days_back = 365

            history_pts = []
            while days_back >= 0:
                d = today - timedelta(days=days_back)
                if data.get("is_pct"):
                    low, high = data["volatility"]
                    bal = max(0.01, bal * random.uniform(low, high))
                else:
                    low, high = data["volatility"]
                    bal = max(0.0, bal + random.uniform(low, high))
                history_pts.append((d.strftime("%Y-%m-%d"), round(bal, 2)))
                days_back -= random.randint(5, 12)

            # Forcer le dernier point à la balance finale
            history_pts.append((today.strftime("%Y-%m-%d"), data["current_balance"]))

            for date_str, balance in history_pts:
                db.add(AssetHistory(asset_id=asset.id, date=date_str, balance=balance))

            db.commit()
            print(f"  + Actif: {data['name']} ({len(history_pts)} pts d'historique)")

        # ─── 2. RÈGLES D'ALLOCATION ──────────────────────────────────────────────
        # Effacer les règles existantes
        db.query(AllocationRule).filter(AllocationRule.user_id == user.id).delete()
        db.commit()

        # Actifs cibles (épargne, bourse, crypto)
        savings_asset = next((a for a in created_assets if a.type == "savings"), None)
        stock_asset   = next((a for a in created_assets if a.type == "stock"), None)
        crypto_asset  = next((a for a in created_assets if a.type == "crypto"), None)

        rules_data = []
        if savings_asset:
            rules_data.append({
                "name": "Épargne d'urgence (10%)",
                "source_type": "all_income",
                "target_asset_id": savings_asset.id,
                "allocation_percent": 10.0,
            })
        if stock_asset:
            rules_data.append({
                "name": "Investissement Bourse (15%)",
                "source_type": "all_income",
                "target_asset_id": stock_asset.id,
                "allocation_percent": 15.0,
            })
        if crypto_asset:
            rules_data.append({
                "name": "Crypto DCA (5%)",
                "source_type": "all_income",
                "target_asset_id": crypto_asset.id,
                "allocation_percent": 5.0,
            })

        for r in rules_data:
            db.add(AllocationRule(
                user_id=user.id,
                name=r["name"],
                source_type=r["source_type"],
                source_category_id=None,
                target_asset_id=r["target_asset_id"],
                allocation_percent=r["allocation_percent"],
                is_active=True,
            ))
        db.commit()
        print(f"\n  + {len(rules_data)} règles d'allocation créées")

        # ─── 3. CATÉGORIES & TRANSACTIONS ────────────────────────────────────────
        # Vérifier si des catégories existent déjà
        existing_cats = db.query(Category).filter(Category.user_id == user.id).count()
        if existing_cats == 0:
            cats_data = [
                # Revenus
                {"name": "Salaire",       "type": "income",   "budget_limit": None},
                {"name": "Revenus Locatifs", "type": "income","budget_limit": None},
                {"name": "Dividendes",    "type": "income",   "budget_limit": None},
                # Dépenses
                {"name": "Logement",      "type": "expense",  "budget_limit": 1800.00},
                {"name": "Alimentation",  "type": "expense",  "budget_limit": 600.00},
                {"name": "Transport",     "type": "expense",  "budget_limit": 350.00},
                {"name": "Abonnements",   "type": "expense",  "budget_limit": 120.00},
                {"name": "Loisirs",       "type": "expense",  "budget_limit": 300.00},
                {"name": "Santé",         "type": "expense",  "budget_limit": 150.00},
                {"name": "Vêtements",     "type": "expense",  "budget_limit": 200.00},
            ]
            created_cats: dict[str, Category] = {}
            for cd in cats_data:
                c = Category(name=cd["name"], type=cd["type"], budget_limit=cd["budget_limit"], user_id=user.id)
                db.add(c)
                db.commit()
                db.refresh(c)
                created_cats[cd["name"]] = c
            print(f"  + {len(cats_data)} catégories créées")
        else:
            # Utiliser les catégories existantes
            cats = db.query(Category).filter(Category.user_id == user.id).all()
            created_cats = {c.name: c for c in cats}
            print(f"  ℹ️  Catégories existantes utilisées ({len(cats)})")

        # Générer des transactions sur les 3 derniers mois
        existing_txs = db.query(Transaction).filter(Transaction.user_id == user.id).count()
        if existing_txs == 0:
            tx_templates = [
                # Revenus
                {"cat": "Salaire",          "amounts": (4800, 4800), "monthly": True, "day": 15, "notes": ["Salaire mensuel"]},
                {"cat": "Revenus Locatifs", "amounts": (1200, 1200), "monthly": True, "day": 1,  "notes": ["Loyer appart"]},
                {"cat": "Dividendes",       "amounts": (80, 350),    "monthly": False,"notes": ["ETF World dividende", "Portefeuille mixte"]},
                # Dépenses
                {"cat": "Logement",         "amounts": (1650, 1650), "monthly": True, "day": 1,  "notes": ["Remboursement prêt"]},
                {"cat": "Alimentation",     "amounts": (180, 250),   "monthly": False,"notes": ["Épicerie Costco", "IGA semaine", "Carrefour", "Metro"]},
                {"cat": "Transport",        "amounts": (60, 250),    "monthly": False,"notes": ["Essence", "OPUS mensuel", "Entretien voiture"]},
                {"cat": "Abonnements",      "amounts": (15, 55),     "monthly": False,"notes": ["Netflix", "Spotify", "AWS", "Adobe CC"]},
                {"cat": "Loisirs",          "amounts": (30, 200),    "monthly": False,"notes": ["Restaurant", "Cinema", "Sport", "Livre"]},
                {"cat": "Santé",            "amounts": (20, 120),    "monthly": False,"notes": ["Médecin", "Pharmacie", "Dentiste"]},
                {"cat": "Vêtements",        "amounts": (35, 180),    "monthly": False,"notes": ["Uniqlo", "Zara", "Printemps"]},
            ]

            tx_count = 0
            for months_back in range(3):
                ref_date = today.replace(day=1) - timedelta(days=months_back * 30)
                month_start = ref_date.replace(day=1)

                for tmpl in tx_templates:
                    cat_obj = created_cats.get(tmpl["cat"])
                    if not cat_obj:
                        continue

                    if tmpl.get("monthly"):
                        day = tmpl.get("day", 1)
                        try:
                            tx_date = month_start.replace(day=day)
                        except ValueError:
                            tx_date = month_start
                        amt = float(tmpl["amounts"][0])
                        note = random.choice(tmpl["notes"])
                        db.add(Transaction(
                            amount=amt, date=tx_date.strftime("%Y-%m-%d"),
                            note=note, user_id=user.id, category_id=cat_obj.id
                        ))
                        tx_count += 1
                    else:
                        n_tx = random.randint(1, 4)
                        for _ in range(n_tx):
                            day = random.randint(1, 28)
                            try:
                                tx_date = month_start.replace(day=day)
                            except ValueError:
                                tx_date = month_start
                            low, high = tmpl["amounts"]
                            amt = round(random.uniform(low, high), 2)
                            note = random.choice(tmpl["notes"])
                            db.add(Transaction(
                                amount=amt, date=tx_date.strftime("%Y-%m-%d"),
                                note=note, user_id=user.id, category_id=cat_obj.id
                            ))
                            tx_count += 1

            db.commit()
            print(f"  + {tx_count} transactions générées sur les 3 derniers mois")
        else:
            print(f"  ℹ️  {existing_txs} transactions existantes, aucune création")

        print(f"\n🎉 Seed Phase 12 terminé pour {email} !")
        print(f"   Patrimoine net estimé: ~{185000 + 34200 + 18750 + 11450 + 5820 - 142000:,.0f} $")
        print(f"   Ouvre http://localhost:3001/assets pour voir le résultat !")

    finally:
        db.close()


if __name__ == "__main__":
    email = sys.argv[1] if len(sys.argv) > 1 else "taffa2@gmail.com"
    seed(email)
