from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import re

from models import Transaction, Category, Goal, Asset

class FinancialAIEngine:
    """
    Moteur Heuristique Avancé (God Mode) pour MapleBudget.
    Analyse les transactions, les objectifs et les actifs pour générer
    des réponses financières ultra-contextualisées en Markdown.
    """
    
    def __init__(self, db: Session, user_id: int):
        self.db = db
        self.user_id = user_id
        
        # Charger les données de l'utilisateur en mémoire pour l'analyse
        self.transactions = (
            self.db.query(Transaction, Category)
            .join(Category, Transaction.category_id == Category.id)
            .filter(Transaction.user_id == self.user_id)
            .order_by(Transaction.date.desc())
            .all()
        )
        
        self.goals = self.db.query(Goal).filter(Goal.user_id == self.user_id).all()
        self.assets = self.db.query(Asset).filter(Asset.user_id == self.user_id).all()
        
    def _get_current_month_boundaries(self):
        now = datetime.now()
        start = now.replace(day=1).strftime("%Y-%m-%d")
        # Approximation simple de la fin du mois
        end = (now.replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(days=1)
        return start, end.strftime("%Y-%m-%d")

    def _get_last_month_boundaries(self):
        now = datetime.now()
        first_day_this_month = now.replace(day=1)
        last_day_last_month = first_day_this_month - timedelta(days=1)
        first_day_last_month = last_day_last_month.replace(day=1)
        return first_day_last_month.strftime("%Y-%m-%d"), last_day_last_month.strftime("%Y-%m-%d")

    def analyze_spending_trends(self):
        """Compare les dépenses du mois courant avec le mois précédent."""
        curr_start, curr_end = self._get_current_month_boundaries()
        prev_start, prev_end = self._get_last_month_boundaries()
        
        curr_expenses = sum(t.amount for t, c in self.transactions if c.type == 'expense' and curr_start <= t.date <= curr_end)
        prev_expenses = sum(t.amount for t, c in self.transactions if c.type == 'expense' and prev_start <= t.date <= prev_end)
        
        if prev_expenses == 0:
            return f"C'est votre premier mois actif ! Vous avez dépensé **{curr_expenses:.2f} €** jusqu'à présent."
            
        diff_pct = ((curr_expenses - prev_expenses) / prev_expenses) * 100
        
        if diff_pct > 0:
            return f"⚠️ Attention : Vos dépenses ce mois-ci (**{curr_expenses:.2f} €**) sont en hausse de **{diff_pct:.1f}%** par rapport au mois dernier."
        else:
            return f"📉 Bonne nouvelle : Vos dépenses ce mois-ci (**{curr_expenses:.2f} €**) ont baissé de **{abs(diff_pct):.1f}%** par rapport au mois dernier. Continuez ainsi !"

    def find_top_categories(self, limit=3):
        """Identifie les catégories avec les plus grosses dépenses."""
        from collections import defaultdict
        cat_totals = defaultdict(float)
        
        for t, c in self.transactions:
            if c.type == 'expense':
                cat_totals[c.name] += float(t.amount)
                
        sorted_cats = sorted(cat_totals.items(), key=lambda x: x[1], reverse=True)[:limit]
        
        if not sorted_cats:
            return "Je n'ai pas trouvé assez de dépenses pour identifier une tendance."
            
        res = "Voici vos plus gros pôles de dépenses globaux :\n"
        for i, (name, total) in enumerate(sorted_cats, 1):
            res += f"{i}. **{name}** : {total:.2f} €\n"
        return res

    def analyze_subscriptions(self):
        """Détecte les potentielles dépenses récurrentes (abonnements)."""
        from collections import defaultdict
        
        # On regroupe les dépenses par nom/montant (simplification)
        tx_counts = defaultdict(list)
        for t, c in self.transactions:
            if c.type == 'expense':
                tx_counts[(t.note or "Inconnu", float(t.amount))].append(t)
                
        subs = [k for k, v in tx_counts.items() if len(v) >= 2]
        
        if not subs:
            return "Je n'ai pas détecté d'abonnements ou de frais récurrents évidents."
            
        total_monthly = sum(amount for _, amount in subs)
        total_yearly = total_monthly * 12
        
        res = f"J'ai détecté **{len(subs)} dépenses récurrentes** suspectées d'être des abonnements :\n"
        for note, amount in subs[:5]:
            label = note if note != "Inconnu" else "Paiement sans note"
            res += f"- {label} : **{amount:.2f} €/mois**\n"
            
        res += f"\n> [!WARNING]\n> Cela représente **{total_yearly:.2f} € par an**. Envisagez de nettoyer ce qui ne vous sert plus !"
        return res

    def general_financial_summary(self):
        """Génère un résumé global ultra-complet."""
        total_assets = sum(a.balance for a in self.assets)
        total_goals = sum(g.current_amount for g in self.goals)
        
        res = "### 📊 Votre Bilan Financier Instantané\n\n"
        res += f"- **Patrimoine Net total** : {total_assets:.2f} €\n"
        res += f"- **Épargne sécurisée (Objectifs)** : {total_goals:.2f} €\n\n"
        
        res += "### 📈 Tendance du Mois\n"
        res += self.analyze_spending_trends() + "\n\n"
        
        res += "### 💡 Analyse des Catégories\n"
        res += self.find_top_categories() + "\n"
        
        return res

    def process_query(self, message: str) -> str:
        """Point d'entrée principal. Dispatche la requête selon les mots-clés (NLP Heuristique)."""
        msg = message.lower()
        
        # 1. Intention "Résumé global" ou "Analyse globale"
        if re.search(r'\b(tout|resume|bilan|global|complet|analyse)\b', msg):
            return self.general_financial_summary()
            
        # 2. Intention "Abonnements / Frais fixes"
        elif re.search(r'\b(abonnement|recurrent|fixe|netflix|spotify|prime)\b', msg):
            return self.analyze_subscriptions()
            
        # 3. Intention "Catégories / Où part mon argent"
        elif re.search(r'\b(depense|categorie|part|fric|argent)\b', msg):
            res = "Voici une analyse de vos sorties d'argent :\n\n"
            res += self.find_top_categories(limit=5)
            res += "\n> [!TIP]\n> Pour économiser, essayez de réduire les dépenses dans le Top 1 ou Top 2 !"
            return res
            
        # 4. Intention "Objectifs / Économies / Vacances"
        elif re.search(r'\b(objectif|economiser|epargne|vacances|voyage|projet)\b', msg):
            res = "Parlons de vos projets !\n\n"
            if not self.goals:
                res += "Vous n'avez aucun objectif défini. Allez dans l'onglet **Objectifs** pour commencer à épargner pour vos rêves (ex: Vacances 🌴).\n"
            else:
                for g in self.goals:
                    pct = (float(g.current_amount) / float(g.target_amount) * 100) if g.target_amount > 0 else 0
                    res += f"- **{g.title}** : {g.current_amount:.2f} € / {g.target_amount:.2f} € ({pct:.1f}% complété)\n"
                
                res += "\n> [!NOTE]\n> Transférez au moins 10% de vos revenus restants à la fin du mois vers ces objectifs pour les atteindre plus vite."
            return res
            
        # Fallback (Générique mais intelligent)
        else:
            return f"""
C'est une excellente question, mais j'ai besoin d'un peu plus de contexte.

En tant que votre **Coach IA**, je peux analyser :
1. **Vos abonnements** cachés (tapez *"quels sont mes abonnements ?"*)
2. **Vos tendances de dépenses** (tapez *"où part mon argent ?"*)
3. **Le bilan complet** (tapez *"fais un bilan complet"*)

Que souhaitez-vous explorer aujourd'hui ? 🤖
"""
