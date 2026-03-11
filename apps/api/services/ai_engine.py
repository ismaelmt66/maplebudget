"""
God Mode AI Coach for NexLedger.

process_query() uses an LLM (Groq by default, Anthropic as fallback) with a rich
financial context injected as system prompt — answers ANY question in French.

Set ONE of these env vars in apps/api/.env:
  GROQ_API_KEY=gsk_...        (free at console.groq.com)
  ANTHROPIC_API_KEY=sk-ant-... (paid, console.anthropic.com)
"""

import math
import os
import re
import unicodedata
import calendar
from collections import defaultdict
from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from models import Transaction, Category, Goal, Asset

try:
    from groq import Groq as _GroqClient
    _GROQ_AVAILABLE = True
except ImportError:
    _GROQ_AVAILABLE = False

try:
    import anthropic as _anthropic_lib
    _ANTHROPIC_AVAILABLE = True
except ImportError:
    _ANTHROPIC_AVAILABLE = False


def _strip_accents(text: str) -> str:
    """Remove accents for robust French NLP matching."""
    return "".join(
        c for c in unicodedata.normalize("NFD", text)
        if unicodedata.category(c) != "Mn"
    )


class FinancialAIEngine:
    """
    Moteur IA God Mode pour NexLedger.
    Analyse transactions, objectifs et actifs → rapports Markdown ultra-riches.
    """

    def __init__(self, db: Session, user_id: int):
        self.db = db
        self.user_id = user_id

        self.transactions = (
            self.db.query(Transaction, Category)
            .join(Category, Transaction.category_id == Category.id)
            .filter(Transaction.user_id == self.user_id)
            .order_by(Transaction.date.desc())
            .all()
        )
        self.goals = self.db.query(Goal).filter(Goal.user_id == self.user_id).all()
        self.assets = self.db.query(Asset).filter(Asset.user_id == self.user_id).all()

    # ─── Date Helpers ──────────────────────────────────────────────────────────

    def _get_current_month_boundaries(self):
        now = datetime.now()
        start = now.replace(day=1).strftime("%Y-%m-%d")
        end = (now.replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(days=1)
        return start, end.strftime("%Y-%m-%d")

    def _get_last_month_boundaries(self):
        now = datetime.now()
        first_day_this_month = now.replace(day=1)
        last_day_last_month = first_day_this_month - timedelta(days=1)
        first_day_last_month = last_day_last_month.replace(day=1)
        return first_day_last_month.strftime("%Y-%m-%d"), last_day_last_month.strftime("%Y-%m-%d")

    def _get_month_boundaries(self, months_ago: int):
        """Returns (start, end) for the month `months_ago` months before current."""
        now = datetime.now()
        year = now.year
        month = now.month - months_ago
        while month <= 0:
            month += 12
            year -= 1
        last_day = calendar.monthrange(year, month)[1]
        return f"{year}-{month:02d}-01", f"{year}-{month:02d}-{last_day:02d}"

    # ─── Core Stats Engine ────────────────────────────────────────────────────

    def _get_monthly_stats(self, start: str, end: str) -> dict:
        """Compute income / expenses / net / savings_rate / by_category for any date range."""
        income = 0.0
        expenses = 0.0
        by_category: dict[str, float] = defaultdict(float)
        tx_count = 0

        for t, c in self.transactions:
            if start <= t.date <= end:
                amount = float(t.amount)
                tx_count += 1
                if c.type == "income":
                    income += amount
                else:
                    expenses += amount
                    by_category[c.name] += amount

        net = income - expenses
        savings_rate = (net / income * 100) if income > 0 else 0.0
        return {
            "income": income,
            "expenses": expenses,
            "net": net,
            "savings_rate": savings_rate,
            "by_category": dict(by_category),
            "tx_count": tx_count,
        }

    def _get_avg_monthly_expenses(self, n_months: int = 3) -> float:
        """Average monthly expenses over last N months."""
        totals = []
        for i in range(1, n_months + 1):
            s, e = self._get_month_boundaries(i)
            stats = self._get_monthly_stats(s, e)
            if stats["expenses"] > 0:
                totals.append(stats["expenses"])
        return sum(totals) / len(totals) if totals else 0.0

    def _get_savings_grade(self, savings_rate: float) -> str:
        if savings_rate >= 40:
            return "S — Épargne Légendaire 🏆"
        elif savings_rate >= 25:
            return "A — Excellent 🌟"
        elif savings_rate >= 15:
            return "B — Bon 👍"
        elif savings_rate >= 5:
            return "C — À améliorer ⚠️"
        else:
            return "D — Critique 🔴"

    # ─── Deep Analysis Modules ────────────────────────────────────────────────

    def _get_savings_data(self) -> dict:
        """Full savings intelligence: FI number, burn rate, grade, years to FI."""
        curr_start, curr_end = self._get_current_month_boundaries()
        curr = self._get_monthly_stats(curr_start, curr_end)
        last_start, last_end = self._get_last_month_boundaries()
        last = self._get_monthly_stats(last_start, last_end)

        ref_income = curr["income"] if curr["income"] > 0 else last["income"]
        ref_expenses = curr["expenses"] if curr["expenses"] > 0 else last["expenses"]

        avg_expenses = self._get_avg_monthly_expenses(3)
        monthly_expenses = avg_expenses if avg_expenses > 0 else ref_expenses

        savings_rate = ((ref_income - ref_expenses) / ref_income * 100) if ref_income > 0 else 0.0
        monthly_savings = ref_income - ref_expenses

        annual_expenses = monthly_expenses * 12
        fi_number = annual_expenses * 25

        total_assets = sum(float(a.balance) for a in self.assets if a.type != "liability")
        burn_rate = (total_assets / monthly_expenses) if monthly_expenses > 0 else 99.0

        remaining_to_fi = max(fi_number - total_assets, 0)
        years_to_fi_linear = (
            remaining_to_fi / (monthly_savings * 12) if monthly_savings > 0 else None
        )

        # Years to FI with 6% compound growth (monthly compounding)
        years_to_fi_invested = None
        if monthly_savings > 0 and fi_number > total_assets:
            r = 0.06 / 12
            fv = total_assets
            for yr in range(1, 101):
                for _ in range(12):
                    fv = fv * (1 + r) + monthly_savings
                if fv >= fi_number:
                    years_to_fi_invested = yr
                    break

        return {
            "ref_income": ref_income,
            "ref_expenses": ref_expenses,
            "monthly_savings": monthly_savings,
            "savings_rate": savings_rate,
            "grade": self._get_savings_grade(savings_rate),
            "fi_number": fi_number,
            "total_assets": total_assets,
            "burn_rate": burn_rate,
            "years_to_fi_linear": years_to_fi_linear,
            "years_to_fi_invested": years_to_fi_invested,
            "monthly_expenses": monthly_expenses,
        }

    def _detect_anomalies(self) -> list:
        """Detect unusual transactions: amount > mean + 2σ per category."""
        cat_amounts: dict[str, list] = defaultdict(list)
        for t, c in self.transactions:
            if c.type == "expense":
                cat_amounts[c.name].append(float(t.amount))

        anomalies = []
        for t, c in self.transactions:
            if c.type != "expense":
                continue
            amounts = cat_amounts[c.name]
            if len(amounts) < 3:
                continue
            mean = sum(amounts) / len(amounts)
            variance = sum((x - mean) ** 2 for x in amounts) / len(amounts)
            std = math.sqrt(variance)
            if std == 0:
                continue
            threshold = mean + 2 * std
            if float(t.amount) > threshold:
                anomalies.append({
                    "category": c.name,
                    "amount": float(t.amount),
                    "date": t.date,
                    "note": t.note or "—",
                    "mean": mean,
                    "threshold": threshold,
                    "z_score": (float(t.amount) - mean) / std,
                })

        anomalies.sort(key=lambda x: -x["z_score"])
        return anomalies[:10]

    def _get_spending_trend(self) -> list:
        """Returns month-over-month stats for last 3 months + current month."""
        months = []
        for i in range(3, -1, -1):
            if i == 0:
                s, e = self._get_current_month_boundaries()
                label = "Ce mois"
            else:
                s, e = self._get_month_boundaries(i)
                label = datetime.strptime(s, "%Y-%m-%d").strftime("%b %Y")
            stats = self._get_monthly_stats(s, e)
            months.append({
                "label": label,
                "income": stats["income"],
                "expenses": stats["expenses"],
                "net": stats["net"],
                "savings_rate": stats["savings_rate"],
            })
        return months

    def _get_goal_analysis(self) -> list:
        """Feasibility analysis for each goal."""
        if not self.goals:
            return []

        s_data = self._get_savings_data()
        monthly_surplus = s_data["monthly_savings"]
        results = []

        for g in self.goals:
            remaining = float(g.target_amount) - float(g.current_amount)
            pct = (
                float(g.current_amount) / float(g.target_amount) * 100
                if g.target_amount > 0 else 100.0
            )
            try:
                target_date = datetime.strptime(g.target_date, "%Y-%m-%d")
                days_left = (target_date - datetime.now()).days
                months_left = max(days_left / 30, 0)
            except Exception:
                months_left = None
                days_left = None

            monthly_required = (remaining / months_left) if (months_left and months_left > 0) else None
            feasible = (
                monthly_surplus >= monthly_required
                if (monthly_required is not None) else None
            )
            results.append({
                "title": g.title,
                "current": float(g.current_amount),
                "target": float(g.target_amount),
                "remaining": remaining,
                "pct": pct,
                "months_left": months_left,
                "monthly_required": monthly_required,
                "monthly_surplus": monthly_surplus,
                "feasible": feasible,
            })

        return results

    # ─── Report Generators ────────────────────────────────────────────────────

    def _god_mode_report(self) -> str:
        """Complete 360° financial bilan — the ultimate overview."""
        today = datetime.now().strftime("%d/%m/%Y")
        curr_start, curr_end = self._get_current_month_boundaries()
        curr = self._get_monthly_stats(curr_start, curr_end)
        last_start, last_end = self._get_last_month_boundaries()
        last = self._get_monthly_stats(last_start, last_end)

        s_data = self._get_savings_data()
        trend = self._get_spending_trend()
        anomalies = self._detect_anomalies()
        goal_analysis = self._get_goal_analysis()

        total_assets = sum(float(a.balance) for a in self.assets if a.type != "liability")
        total_liabilities = sum(float(a.balance) for a in self.assets if a.type == "liability")
        net_worth = total_assets - total_liabilities

        expense_delta = curr["expenses"] - last["expenses"]
        expense_delta_pct = (expense_delta / last["expenses"] * 100) if last["expenses"] > 0 else 0.0

        report = f"## 🧠 God Mode — Rapport 360° au {today}\n\n"
        report += "> [!NOTE]\n"
        report += f"> Analyse basée sur **{len(self.transactions)} transactions**, **{len(self.assets)} actifs**, **{len(self.goals)} objectif(s)**.\n\n"
        report += "---\n\n"

        # ── KPIs
        income_icon = "📈" if curr["income"] > 0 else "⚠️"
        exp_icon = "🔴" if expense_delta > 0 else "🟢"
        report += "### 💼 KPIs du Mois en Cours\n\n"
        report += "| Indicateur | Valeur | vs Mois Dernier |\n"
        report += "|---|---|---|\n"
        report += f"| {income_icon} Revenus | **{curr['income']:,.2f} $** | — |\n"
        report += f"| {exp_icon} Dépenses | **{curr['expenses']:,.2f} $** | {expense_delta:+,.2f} $ ({expense_delta_pct:+.1f}%) |\n"
        report += f"| 💰 Solde Net | **{curr['net']:,.2f} $** | — |\n"
        report += f"| 🏦 Patrimoine Net | **{net_worth:,.2f} $** | — |\n"
        report += f"| 🎯 Taux d'Épargne | **{s_data['savings_rate']:.1f}%** | Grade : {s_data['grade']} |\n"
        report += f"| ⏳ Runway | **{s_data['burn_rate']:.1f} mois** | sur actifs actuels |\n\n"
        report += "---\n\n"

        # ── 4-month trend
        report += "### 📅 Évolution sur 4 Mois\n\n"
        report += "| Mois | Revenus | Dépenses | Net | Épargne |\n"
        report += "|---|---|---|---|---|\n"
        for m in trend:
            net_icon = "🟢" if m["net"] >= 0 else "🔴"
            report += f"| **{m['label']}** | {m['income']:,.0f} $ | {m['expenses']:,.0f} $ | {net_icon} {m['net']:+,.0f} $ | {m['savings_rate']:.1f}% |\n"
        report += "\n---\n\n"

        # ── Top spending categories
        if curr["by_category"]:
            top_cats = sorted(curr["by_category"].items(), key=lambda x: -x[1])[:5]
            report += "### 💸 Top Dépenses du Mois\n\n"
            report += "| # | Catégorie | Montant | Part |\n"
            report += "|---|---|---|---|\n"
            for i, (cat, amt) in enumerate(top_cats, 1):
                pct = (amt / curr["expenses"] * 100) if curr["expenses"] > 0 else 0
                bar = "█" * int(pct / 10) + "░" * (10 - int(pct / 10))
                report += f"| {i} | {cat} | {amt:,.2f} $ | {bar} {pct:.1f}% |\n"
            report += "\n---\n\n"

        # ── Anomalies
        if anomalies:
            report += f"### 🚨 {len(anomalies)} Anomalie(s) Détectée(s)\n\n"
            for a in anomalies[:3]:
                report += f"- **{a['category']}** — {a['date']} : **{a['amount']:.2f} $** *(moy. : {a['mean']:.2f} $, seuil : {a['threshold']:.2f} $)*\n"
            report += "\n---\n\n"

        # ── Goals
        if goal_analysis:
            report += "### 🎯 Objectifs\n\n"
            for g in goal_analysis:
                bar_len = int(min(g["pct"], 100) / 10)
                bar = "█" * bar_len + "░" * (10 - bar_len)
                feasible_str = ""
                if g["feasible"] is True:
                    feasible_str = " ✅ Faisable"
                elif g["feasible"] is False:
                    feasible_str = " ⚠️ Effort requis"
                report += f"- **{g['title']}** : {g['current']:,.0f} $ / {g['target']:,.0f} $ [{bar}] {g['pct']:.0f}%{feasible_str}\n"
            report += "\n---\n\n"

        # ── FI snapshot
        fi_progress = (
            min(s_data["total_assets"] / s_data["fi_number"] * 100, 100)
            if s_data["fi_number"] > 0 else 0
        )
        fi_bar = "█" * int(fi_progress / 10) + "░" * (10 - int(fi_progress / 10))
        report += "### 🏝️ Chemin vers l'Indépendance Financière\n\n"
        report += f"- **Nombre FI** (25× dépenses annuelles) : {s_data['fi_number']:,.0f} $\n"
        report += f"- **Actifs actuels** : {s_data['total_assets']:,.0f} $ [{fi_bar}] {fi_progress:.1f}%\n"
        if s_data["years_to_fi_invested"]:
            report += f"- **Horizon FI estimé** (avec 6%/an) : **{s_data['years_to_fi_invested']} ans**\n"

        report += "\n> [!TIP]\n> Tapez **'épargne'**, **'objectifs'**, **'anomalies'**, **'flux'** ou **'abonnements'** pour approfondir chaque analyse."
        return report

    def _savings_intelligence(self) -> str:
        """Deep savings analysis: rate, FI number, grade, projections."""
        s = self._get_savings_data()

        report = "## 💰 Intelligence Épargne\n\n"
        report += f"### 📊 Taux d'Épargne : **{s['savings_rate']:.1f}%** — {s['grade']}\n\n"
        report += "| Indicateur | Valeur |\n"
        report += "|---|---|\n"
        report += f"| Revenus de référence | {s['ref_income']:,.2f} $ |\n"
        report += f"| Dépenses de référence | {s['ref_expenses']:,.2f} $ |\n"
        report += f"| Épargne mensuelle | **{s['monthly_savings']:,.2f} $** |\n"
        report += f"| Épargne annuelle | **{s['monthly_savings'] * 12:,.2f} $** |\n\n"

        # FI Number
        fi_progress = (
            min(s["total_assets"] / s["fi_number"] * 100, 100)
            if s["fi_number"] > 0 else 0
        )
        fi_filled = int(fi_progress / 5)
        fi_bar = "█" * fi_filled + "░" * (20 - fi_filled)
        report += "### 🏝️ Votre Numéro de Liberté Financière\n\n"
        report += f"> Nombre FI = 25 × dépenses annuelles ({s['monthly_expenses'] * 12:,.0f} $) = **{s['fi_number']:,.0f} $**\n\n"
        report += f"`[{fi_bar}]` **{fi_progress:.1f}%** accompli\n\n"
        report += f"- Actifs actuels : **{s['total_assets']:,.0f} $**\n"
        report += f"- Reste à accumuler : **{max(s['fi_number'] - s['total_assets'], 0):,.0f} $**\n\n"

        # Projections
        report += "### 🚀 Projections vers la Liberté Financière\n\n"
        report += "| Scénario | Horizon Estimé |\n"
        report += "|---|---|\n"
        if s["years_to_fi_linear"]:
            report += f"| Épargne linéaire (sans investissement) | {s['years_to_fi_linear']:.1f} ans |\n"
        else:
            report += "| Épargne linéaire | Impossible (épargne négative ou nulle) |\n"
        if s["years_to_fi_invested"]:
            report += f"| Épargne investie à 6%/an | **{s['years_to_fi_invested']} ans** |\n"
        else:
            report += "| Épargne investie à 6%/an | Augmentez votre épargne mensuelle |\n"

        # Runway
        report += "\n### 🔥 Runway\n\n"
        report += f"- **Burn rate** : {s['burn_rate']:.1f} mois de dépenses couverts par vos actifs\n"
        if s["burn_rate"] < 3:
            report += "- 🔴 Runway dangereux — constituez un fonds d'urgence de 3–6 mois en priorité !\n"
        elif s["burn_rate"] < 6:
            report += "- 🟡 Runway limité — visez 6 mois pour une sécurité optimale.\n"
        else:
            report += "- ✅ Runway solide — bonne marge de sécurité.\n"

        # Grade reference
        report += "\n### 📈 Repères de Taux d'Épargne\n\n"
        report += "| Grade | Taux | Signification |\n"
        report += "|---|---|---|\n"
        report += "| 🏆 S | ≥ 40% | Chemin express vers la liberté financière |\n"
        report += "| 🌟 A | 25–39% | Excellent — dépassez la majorité |\n"
        report += "| 👍 B | 15–24% | Bon — dans la bonne direction |\n"
        report += "| ⚠️ C | 5–14% | Attention — cherchez des leviers de réduction |\n"
        report += "| 🔴 D | < 5% | Critique — revoyez vos dépenses urgemment |\n"
        return report

    def _cashflow_deep_dive(self) -> str:
        """Cash-flow analysis with daily velocity and 3-month projection."""
        trend = self._get_spending_trend()
        curr_start, curr_end = self._get_current_month_boundaries()
        curr = self._get_monthly_stats(curr_start, curr_end)

        report = "## 💸 Cash-Flow — Analyse Avancée\n\n"

        # Monthly trend table
        report += "### 📅 Flux Mensuels sur 4 Mois\n\n"
        report += "| Mois | Revenus | Dépenses | Net | Taux Épargne |\n"
        report += "|---|---|---|---|---|\n"
        for m in trend:
            net_icon = "🟢" if m["net"] >= 0 else "🔴"
            report += f"| **{m['label']}** | {m['income']:,.0f} $ | {m['expenses']:,.0f} $ | {net_icon} {m['net']:+,.0f} $ | {m['savings_rate']:.1f}% |\n"
        report += "\n"

        # Daily velocity
        now = datetime.now()
        day_of_month = now.day
        if day_of_month > 0 and curr["expenses"] > 0:
            daily_expense = curr["expenses"] / day_of_month
            daily_income = curr["income"] / day_of_month
            days_in_month = calendar.monthrange(now.year, now.month)[1]
            projected_expenses = daily_expense * days_in_month
            projected_income = daily_income * days_in_month
            report += "### ⚡ Vélocité Journalière (ce mois)\n\n"
            report += "| Indicateur | Valeur |\n"
            report += "|---|---|\n"
            report += f"| Dépense journalière moyenne | **{daily_expense:,.2f} $** |\n"
            report += f"| Revenu journalier moyen | **{daily_income:,.2f} $** |\n"
            report += f"| Projection dépenses fin de mois | **{projected_expenses:,.2f} $** |\n"
            report += f"| Projection revenus fin de mois | **{projected_income:,.2f} $** |\n"
            report += f"| Net projeté fin de mois | **{projected_income - projected_expenses:+,.2f} $** |\n\n"

        # 3-month averages
        valid_months = [m for m in trend[:-1] if m["income"] > 0 or m["expenses"] > 0]
        if valid_months:
            avg_income = sum(m["income"] for m in valid_months) / len(valid_months)
            avg_expenses = sum(m["expenses"] for m in valid_months) / len(valid_months)
            avg_net = avg_income - avg_expenses
            report += "### 📊 Moyennes sur 3 Mois\n\n"
            report += f"- Revenu moyen mensuel : **{avg_income:,.2f} $**\n"
            report += f"- Dépenses moyennes mensuelles : **{avg_expenses:,.2f} $**\n"
            report += f"- Net mensuel moyen : **{avg_net:+,.2f} $**\n"
            report += f"- Capacité d'épargne annuelle estimée : **{avg_net * 12:+,.2f} $**\n\n"

        # Expense breakdown (current month)
        if curr["by_category"]:
            report += "### 💡 Répartition des Dépenses (Mois Actuel)\n\n"
            report += "| Catégorie | Montant | Part |\n"
            report += "|---|---|---|\n"
            for cat, amt in sorted(curr["by_category"].items(), key=lambda x: -x[1]):
                pct = (amt / curr["expenses"] * 100) if curr["expenses"] > 0 else 0
                report += f"| {cat} | {amt:,.2f} $ | {pct:.1f}% |\n"

        return report

    def _goal_power_analysis(self) -> str:
        """Goal feasibility with progress bars and monthly allocation advice."""
        goals = self._get_goal_analysis()
        s_data = self._get_savings_data()

        report = "## 🎯 Analyse Avancée des Objectifs\n\n"

        if not goals:
            report += "> [!NOTE]\n> Vous n'avez pas encore d'objectifs définis. Créez-en dans l'onglet **Objectifs** pour commencer à planifier vos projets de vie.\n"
            return report

        total_monthly_required = sum(
            g["monthly_required"] for g in goals if g["monthly_required"] is not None
        )

        report += "### 💼 Vue d'Ensemble\n\n"
        report += f"- **Épargne mensuelle disponible** : {s_data['monthly_savings']:,.2f} $\n"
        report += f"- **Total mensuel requis (tous objectifs)** : {total_monthly_required:,.2f} $\n"
        if total_monthly_required > 0:
            coverage = min(s_data["monthly_savings"] / total_monthly_required * 100, 100)
            feasibility = (
                "✅ Tous faisables"
                if coverage >= 100
                else f"⚠️ Couverture partielle ({coverage:.0f}%)"
            )
            report += f"- **Faisabilité globale** : {feasibility}\n"
        report += "\n---\n\n"

        for g in goals:
            bar_len = int(min(g["pct"], 100) / 10)
            bar = "█" * bar_len + "░" * (10 - bar_len)
            icon = "✅" if g["pct"] >= 100 else "🎯"
            report += f"### {icon} {g['title']}\n\n"
            report += f"`[{bar}]` **{g['pct']:.1f}%** — {g['current']:,.2f} $ / {g['target']:,.2f} $\n\n"
            report += f"- Reste à épargner : **{g['remaining']:,.2f} $**\n"
            if g["months_left"] is not None:
                report += f"- Temps restant : **{g['months_left']:.0f} mois**\n"
                if g["monthly_required"] is not None:
                    report += f"- Effort mensuel requis : **{g['monthly_required']:,.2f} $/mois**\n"
                    if g["feasible"]:
                        surplus_after = s_data["monthly_savings"] - g["monthly_required"]
                        report += f"- ✅ Faisable — Surplus après cet objectif : {surplus_after:,.2f} $\n"
                    else:
                        gap = g["monthly_required"] - s_data["monthly_savings"]
                        report += f"- ⚠️ Il manque **{gap:,.2f} $/mois** — envisagez d'allonger l'échéance ou de réduire les dépenses.\n"
            report += "\n"

        report += "> [!TIP]\n> Utilisez les **Règles d'Allocation** pour automatiser le versement vers vos objectifs à chaque paie."
        return report

    def _spending_intelligence(self) -> str:
        """Spending breakdown with month-over-month comparison and opportunities."""
        curr_start, curr_end = self._get_current_month_boundaries()
        curr = self._get_monthly_stats(curr_start, curr_end)
        last_start, last_end = self._get_last_month_boundaries()
        last = self._get_monthly_stats(last_start, last_end)

        report = "## 💸 Intelligence des Dépenses\n\n"

        delta = curr["expenses"] - last["expenses"]
        delta_pct = (delta / last["expenses"] * 100) if last["expenses"] > 0 else 0
        icon = "🔴" if delta > 0 else "🟢"

        report += "### 📊 Comparaison Mensuelle\n\n"
        report += "| Période | Dépenses | Variation |\n"
        report += "|---|---|---|\n"
        report += f"| Mois dernier | {last['expenses']:,.2f} $ | — |\n"
        report += f"| Ce mois | {curr['expenses']:,.2f} $ | {icon} {delta:+,.2f} $ ({delta_pct:+.1f}%) |\n\n"

        # Top 5 categories with MoM comparison
        if curr["by_category"]:
            report += "### 🏆 Vos 5 Plus Grosses Catégories (Ce Mois)\n\n"
            report += "| # | Catégorie | Ce mois | Mois dernier | Variation |\n"
            report += "|---|---|---|---|---|\n"
            top = sorted(curr["by_category"].items(), key=lambda x: -x[1])[:5]
            for i, (cat, amt) in enumerate(top, 1):
                last_amt = last["by_category"].get(cat, 0)
                cat_delta = amt - last_amt
                cat_icon = "🔴" if cat_delta > 5 else "🟢" if cat_delta < -5 else "➡️"
                report += f"| {i} | {cat} | {amt:,.2f} $ | {last_amt:,.2f} $ | {cat_icon} {cat_delta:+,.2f} $ |\n"
            report += "\n"

        # All-time top categories
        all_cats: dict[str, float] = defaultdict(float)
        for t, c in self.transactions:
            if c.type == "expense":
                all_cats[c.name] += float(t.amount)

        if all_cats:
            top_all = sorted(all_cats.items(), key=lambda x: -x[1])[:5]
            report += "### 📈 Top Catégories Globales (Tous Temps)\n\n"
            report += "| # | Catégorie | Total |\n"
            report += "|---|---|---|\n"
            for i, (cat, amt) in enumerate(top_all, 1):
                report += f"| {i} | {cat} | {amt:,.2f} $ |\n"
            report += "\n"

        # Optimization opportunities
        report += "### 💡 Opportunités d'Optimisation\n\n"
        opportunities = []
        if curr["expenses"] > 0 and curr["by_category"]:
            top_cats_curr = sorted(curr["by_category"].items(), key=lambda x: -x[1])
            top_cat, top_amt = top_cats_curr[0]
            top_pct = top_amt / curr["expenses"] * 100
            if top_pct > 40:
                opportunities.append(
                    f"- **{top_cat}** représente **{top_pct:.0f}%** de vos dépenses ce mois. "
                    f"Une réduction de 10% libérerait **{top_amt * 0.1:,.2f} $**."
                )
        if delta_pct > 20:
            opportunities.append(
                f"- Vos dépenses ont bondi de **{delta_pct:.0f}%** ce mois. "
                "Identifiez les achats exceptionnels et vérifiez s'ils se répéteront."
            )
        if not opportunities:
            opportunities.append("- ✅ Vos dépenses semblent sous contrôle ce mois-ci !")

        for op in opportunities:
            report += op + "\n"

        return report

    def _anomaly_report(self) -> str:
        """Report of unusual transactions detected via statistical analysis (mean + 2σ)."""
        anomalies = self._detect_anomalies()

        report = "## 🚨 Détecteur d'Anomalies Financières\n\n"
        report += "> [!NOTE]\n> Une anomalie est une transaction dont le montant dépasse la moyenne de sa catégorie de plus de 2 écarts-types.\n\n"

        if not anomalies:
            report += "✅ **Aucune anomalie détectée !** Vos transactions sont dans les normes historiques de chaque catégorie.\n"
            return report

        report += f"**{len(anomalies)} transaction(s) inhabituelle(s) détectée(s) :**\n\n"
        report += "| Catégorie | Date | Montant | Moyenne | Seuil | Score Z |\n"
        report += "|---|---|---|---|---|---|\n"
        for a in anomalies:
            report += f"| {a['category']} | {a['date']} | **{a['amount']:.2f} $** | {a['mean']:.2f} $ | {a['threshold']:.2f} $ | {a['z_score']:.1f}σ |\n"

        report += "\n### 🔎 Que faire ?\n\n"
        report += "- Vérifiez si ces transactions sont **légitimes** (achat exceptionnel, erreur de facturation…)\n"
        report += "- Si une transaction vous est **inconnue**, contactez votre banque immédiatement.\n"
        report += "- Si c'est normal (ex: assurance annuelle), **ignorez** — l'IA s'adaptera avec le temps.\n"
        return report

    def _analyze_subscriptions(self) -> str:
        """Enhanced subscription detection with annual cost projection."""
        tx_groups: dict[tuple, list] = defaultdict(list)
        for t, c in self.transactions:
            if c.type == "expense":
                key = (t.note or "Sans note", round(float(t.amount), 2))
                tx_groups[key].append(t.date)

        subs = [
            (note, amt, dates)
            for (note, amt), dates in tx_groups.items()
            if len(dates) >= 2
        ]
        subs.sort(key=lambda x: -x[1])

        report = "## 🔄 Analyse des Abonnements & Frais Récurrents\n\n"

        if not subs:
            report += "> [!NOTE]\n> Aucun abonnement détecté (minimum 2 occurrences avec même montant et même libellé).\n"
            return report

        total_monthly = sum(amt for _, amt, _ in subs)
        total_yearly = total_monthly * 12

        report += "### 💰 Résumé\n\n"
        report += f"- **{len(subs)} abonnement(s)** détecté(s)\n"
        report += f"- Coût mensuel estimé : **{total_monthly:,.2f} $**\n"
        report += f"- Coût annuel estimé : **{total_yearly:,.2f} $**\n\n"

        report += "### 📋 Détail des Abonnements\n\n"
        report += "| Libellé | Montant/mois | Occurrences | Dernière fois |\n"
        report += "|---|---|---|---|\n"
        for note, amt, dates in subs[:10]:
            last_date = sorted(dates, reverse=True)[0]
            report += f"| {note} | **{amt:.2f} $** | {len(dates)}x | {last_date} |\n"

        report += "\n### 💡 Conseils\n\n"
        report += "- Passez en revue cette liste : utilisez-vous vraiment **tous** ces services ?\n"
        report += f"- Annuler 1 abonnement à **15 $/mois** = **{15 * 12:.0f} $** économisés par an.\n"
        report += "- Regroupez les abonnements familiaux pour diviser les coûts.\n"

        if total_yearly > 1000:
            report += f"\n> [!WARNING]\n> Vos abonnements coûtent plus de **{total_yearly:,.0f} $**/an. Auditez-les régulièrement !"

        return report

    def _smart_fallback(self, original_message: str) -> str:
        """Contextual fallback with a command menu based on available data."""
        report = "## 🤖 Coach IA — À votre service\n\n"

        if self.transactions:
            report += "### ✅ Analyses disponibles\n\n"
            report += "| Commande | Description |\n"
            report += "|---|---|\n"
            report += "| *bilan complet* | Rapport 360° — KPIs, tendances, anomalies |\n"
            report += "| *épargne* | Taux d'épargne, numéro FI, liberté financière |\n"
            report += "| *dépenses* | Décomposition, comparaison, opportunités |\n"
            report += "| *flux* / *cash-flow* | Vélocité journalière, projections |\n"
            report += "| *anomalies* | Transactions inhabituelles détectées par IA |\n"
            if self.goals:
                report += "| *objectifs* | Faisabilité, effort mensuel, progrès |\n"
            report += "| *abonnements* | Frais récurrents et optimisation |\n"
        else:
            report += "> [!NOTE]\n> Ajoutez des transactions pour débloquer les analyses personnalisées.\n\n"

        report += f"\n*Votre question : « {original_message} »*\n"
        report += "\nPosez votre question différemment ou choisissez une commande ci-dessus !"
        return report

    # ─── Context Builder ──────────────────────────────────────────────────────

    def _build_financial_context(self) -> str:
        """Build a comprehensive plain-text summary of the user's finances for the LLM."""
        lines = []
        today = datetime.now().strftime("%d/%m/%Y")
        lines.append(f"Date du jour : {today}")
        lines.append("")

        # ── Assets / Net worth
        if self.assets:
            total_pos = sum(float(a.balance) for a in self.assets if a.type != "liability")
            total_liab = sum(float(a.balance) for a in self.assets if a.type == "liability")
            net_worth = total_pos - total_liab
            lines.append(f"PATRIMOINE NET : {net_worth:,.2f} $")
            lines.append(f"  Actifs totaux : {total_pos:,.2f} $")
            lines.append(f"  Dettes totales : {total_liab:,.2f} $")
            lines.append("  Détail des actifs :")
            for a in self.assets:
                lines.append(f"    - {a.name} ({a.type}) : {float(a.balance):,.2f} $")
        else:
            lines.append("PATRIMOINE : aucun actif enregistré")
        lines.append("")

        # ── Current month stats
        curr_start, curr_end = self._get_current_month_boundaries()
        curr = self._get_monthly_stats(curr_start, curr_end)
        lines.append(f"MOIS EN COURS ({curr_start} → {curr_end}) :")
        lines.append(f"  Revenus       : {curr['income']:,.2f} $")
        lines.append(f"  Dépenses      : {curr['expenses']:,.2f} $")
        lines.append(f"  Solde net     : {curr['net']:,.2f} $")
        lines.append(f"  Taux d'épargne: {curr['savings_rate']:.1f}%")
        if curr["by_category"]:
            lines.append("  Dépenses par catégorie ce mois :")
            for cat, amt in sorted(curr["by_category"].items(), key=lambda x: -x[1]):
                lines.append(f"    - {cat} : {amt:,.2f} $")
        lines.append("")

        # ── Last 3 months trend
        lines.append("HISTORIQUE 3 DERNIERS MOIS :")
        for i in range(3, 0, -1):
            s, e = self._get_month_boundaries(i)
            stats = self._get_monthly_stats(s, e)
            label = datetime.strptime(s, "%Y-%m-%d").strftime("%B %Y")
            lines.append(
                f"  {label}: revenus {stats['income']:,.2f} $, "
                f"dépenses {stats['expenses']:,.2f} $, "
                f"net {stats['net']:+,.2f} $"
            )
        lines.append("")

        # ── Goals
        if self.goals:
            lines.append("OBJECTIFS D'ÉPARGNE :")
            for g in self.goals:
                pct = (float(g.current_amount) / float(g.target_amount) * 100) if g.target_amount > 0 else 0
                lines.append(
                    f"  - {g.title} : {float(g.current_amount):,.2f} $ / {float(g.target_amount):,.2f} $ "
                    f"({pct:.1f}%) — échéance {g.target_date}"
                )
        else:
            lines.append("OBJECTIFS : aucun objectif défini")
        lines.append("")

        # ── Subscriptions (recurring)
        tx_groups: dict[tuple, int] = defaultdict(int)
        for t, c in self.transactions:
            if c.type == "expense":
                key = (t.note or "Sans note", round(float(t.amount), 2))
                tx_groups[key] += 1
        subs = [(note, amt, cnt) for (note, amt), cnt in tx_groups.items() if cnt >= 2]
        if subs:
            total_sub = sum(amt for _, amt, _ in subs)
            lines.append(f"ABONNEMENTS DÉTECTÉS ({len(subs)}) — total estimé {total_sub:,.2f} $/mois :")
            for note, amt, cnt in sorted(subs, key=lambda x: -x[1])[:8]:
                lines.append(f"  - {note} : {amt:.2f} $/mois ({cnt} occurrences)")
        lines.append("")

        # ── Savings data
        s = self._get_savings_data()
        lines.append("ÉPARGNE & LIBERTÉ FINANCIÈRE :")
        lines.append(f"  Taux d'épargne : {s['savings_rate']:.1f}% (grade {s['grade']})")
        lines.append(f"  Épargne mensuelle : {s['monthly_savings']:,.2f} $")
        lines.append(f"  Numéro FI (25× dép. annuelles) : {s['fi_number']:,.0f} $")
        lines.append(f"  Actifs actuels : {s['total_assets']:,.0f} $ ({min(s['total_assets'] / s['fi_number'] * 100, 100) if s['fi_number'] > 0 else 0:.1f}% du FI)")
        lines.append(f"  Runway : {s['burn_rate']:.1f} mois")
        if s["years_to_fi_invested"]:
            lines.append(f"  Horizon FI (avec 6%/an) : {s['years_to_fi_invested']} ans")
        lines.append("")

        # ── Anomalies
        anomalies = self._detect_anomalies()
        if anomalies:
            lines.append(f"ANOMALIES DÉTECTÉES ({len(anomalies)}) :")
            for a in anomalies[:5]:
                lines.append(
                    f"  - {a['category']} le {a['date']} : {a['amount']:.2f} $ "
                    f"(moy. {a['mean']:.2f} $, z={a['z_score']:.1f}σ)"
                )
        lines.append("")

        # ── Recent transactions (last 10)
        recent = self.transactions[:10]
        if recent:
            lines.append("DERNIÈRES TRANSACTIONS :")
            for t, c in recent:
                direction = "+" if c.type == "income" else "-"
                lines.append(f"  {t.date} | {direction}{float(t.amount):,.2f} $ | {c.name} | {t.note or ''}")

        return "\n".join(lines)

    # ─── Main Dispatch (LLM-powered) ──────────────────────────────────────────

    def _build_system_prompt(self) -> str:
        financial_context = self._build_financial_context()
        return f"""Tu es un coach financier personnel expert, intégré dans l'application NexLedger.
Tu as accès aux données financières réelles de l'utilisateur ci-dessous.
Tu réponds TOUJOURS en français, de façon claire, précise et personnalisée.
Tu utilises du Markdown (gras, listes, tableaux) pour structurer tes réponses.
Tu ne refuses jamais de répondre à une question financière.
Tu bases TOUTES tes réponses sur les données réelles fournies — jamais sur des hypothèses génériques.
Si une question dépasse les données disponibles, tu le dis clairement et proposes une piste.

═══════════════════════════════════════
DONNÉES FINANCIÈRES DE L'UTILISATEUR
═══════════════════════════════════════
{financial_context}
═══════════════════════════════════════

Réponds à la question de l'utilisateur de façon utile, précise et actionnable."""

    def process_query(self, message: str) -> str:
        """
        Main entry point.
        Tries Groq first (free), then Anthropic, then falls back to heuristics.
        """
        groq_key = os.environ.get("GROQ_API_KEY", "")
        anthropic_key = os.environ.get("ANTHROPIC_API_KEY", "")

        # ── 1. Groq (free tier — preferred)
        if _GROQ_AVAILABLE and groq_key:
            try:
                system_prompt = self._build_system_prompt()
                client = _GroqClient(api_key=groq_key)
                response = client.chat.completions.create(
                    model="llama-3.3-70b-versatile",
                    max_tokens=1500,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": message},
                    ],
                )
                return response.choices[0].message.content
            except Exception:
                pass  # fall through to Anthropic

        # ── 2. Anthropic Claude (paid)
        if _ANTHROPIC_AVAILABLE and anthropic_key:
            try:
                system_prompt = self._build_system_prompt()
                client = _anthropic_lib.Anthropic(api_key=anthropic_key)
                response = client.messages.create(
                    model="claude-haiku-4-5-20251001",
                    max_tokens=1500,
                    system=system_prompt,
                    messages=[{"role": "user", "content": message}],
                )
                return response.content[0].text
            except Exception:
                pass  # fall through to heuristic

        # ── 3. Heuristic fallback (no API key configured)
        return self._heuristic_dispatch(message)

    def _heuristic_dispatch(self, message: str) -> str:
        """Fallback heuristic dispatch using regex pattern matching."""
        msg = _strip_accents(message.lower())

        if re.search(r"\b(tout|resume|bilan|global|complet|analyse|rapport|360|synthese)\b", msg):
            return self._god_mode_report()
        if re.search(r"\b(epargne|taux|liberte|fi\b|independan|retraite|fire|runway|burn)\b", msg):
            return self._savings_intelligence()
        if re.search(r"\b(flux|cash|tresorerie|cashflow|revenu|salaire|projection|velocite)\b", msg):
            return self._cashflow_deep_dive()
        if re.search(r"\b(objectif|goal|projet|vacance|voyage|achat|immobilier|voiture|mariage)\b", msg):
            return self._goal_power_analysis()
        if re.search(r"\b(abonnement|recurrent|netflix|spotify|prime|fixe|mensualite)\b", msg):
            return self._analyze_subscriptions()
        if re.search(r"\b(alerte|anomalie|suspect|inhabituel|bizarre|fraude|verifier)\b", msg):
            return self._anomaly_report()
        if re.search(r"\b(depense|categorie|argent|budget|cout|fric|payer)\b", msg):
            return self._spending_intelligence()
        return self._smart_fallback(message)

    # ─── Patrimoine Analysis (unchanged) ─────────────────────────────────────

    def analyze_patrimoine(self) -> str:
        """Analyse complète du patrimoine : score santé, projections, fonds d'urgence, dettes, recommandations."""
        if not self.assets:
            return "## 📊 Analyse Patrimoine\n\n> [!NOTE]\n> Vous n'avez aucun actif enregistré. Commencez par ajouter vos comptes (courant, épargne, placements) pour débloquer l'analyse complète."

        today_str = datetime.now().strftime("%d/%m/%Y")

        # ─── 1. KPIs de base
        type_totals: dict[str, float] = defaultdict(float)
        total_pos = 0.0
        total_liabilities = 0.0

        for a in self.assets:
            bal = float(a.balance)
            if a.type == "liability":
                total_liabilities += bal
            else:
                total_pos += bal
                type_totals[a.type] += bal

        net_worth = total_pos - total_liabilities

        # ─── 2. Diversification
        asset_types = [t for t, v in type_totals.items() if v > 0]
        n_types = len(asset_types)
        diversity_score = min(n_types * 25, 100)
        diversity_label = (
            "🟢 Excellente" if diversity_score >= 75
            else "🟡 Moyenne" if diversity_score >= 50
            else "🔴 Faible"
        )

        # ─── 3. Fonds d'urgence
        curr_start, curr_end = self._get_current_month_boundaries()
        monthly_expenses = sum(
            float(t.amount) for t, c in self.transactions
            if c.type == "expense" and curr_start <= t.date <= curr_end
        )
        if monthly_expenses == 0:
            last_start, last_end = self._get_last_month_boundaries()
            monthly_expenses = sum(
                float(t.amount) for t, c in self.transactions
                if c.type == "expense" and last_start <= t.date <= last_end
            )

        liquid_balance = type_totals.get("checking", 0) + type_totals.get("savings", 0)
        emergency_3m = monthly_expenses * 3
        emergency_6m = monthly_expenses * 6
        months_covered = (liquid_balance / monthly_expenses) if monthly_expenses > 0 else 99.0
        months_covered = min(months_covered, 99.0)

        if monthly_expenses > 0:
            if months_covered >= 6:
                ef_status = "✅ Optimal (6+ mois)"
                ef_score = 25
            elif months_covered >= 3:
                ef_status = "🟡 Suffisant (3–6 mois)"
                ef_score = 15
            elif months_covered >= 1:
                ef_status = "⚠️ Partiel (1–3 mois)"
                ef_score = 8
            else:
                ef_status = "🔴 Insuffisant (< 1 mois)"
                ef_score = 0
        else:
            ef_status = "ℹ️ Données insuffisantes"
            ef_score = 25

        # ─── 4. Ratio dette/actif
        debt_ratio = (total_liabilities / (total_pos + 0.01)) * 100
        if debt_ratio < 20:
            debt_label = "🟢 Faible"
            debt_score = 25
        elif debt_ratio < 40:
            debt_label = "🟡 Modéré"
            debt_score = 15
        elif debt_ratio < 60:
            debt_label = "🟠 Élevé"
            debt_score = 8
        else:
            debt_label = "🔴 Critique"
            debt_score = 0

        # ─── 5. Score de Santé Financière
        div_pts = diversity_score // 4
        if net_worth >= 50_000:
            nw_pts = 25
        elif net_worth >= 10_000:
            nw_pts = 20
        elif net_worth >= 1_000:
            nw_pts = 15
        elif net_worth > 0:
            nw_pts = 10
        else:
            nw_pts = 0

        health_score = ef_score + debt_score + div_pts + nw_pts
        health_label = (
            "🟢 Excellent" if health_score >= 80
            else "🟡 Bon" if health_score >= 60
            else "🟠 À améliorer" if health_score >= 40
            else "🔴 Critique"
        )

        # ─── 6. Projections par intérêts composés
        annual_rates: dict[str, float] = {
            "stock": 0.06,
            "crypto": 0.07,
            "savings": 0.025,
            "real_estate": 0.03,
            "checking": 0.005,
        }
        liability_rate = 0.05

        weighted_rate = (
            sum(annual_rates.get(atype, 0.02) * balance / total_pos for atype, balance in type_totals.items())
            if total_pos > 0 else 0.0
        )

        # On récupère la capacité d'épargne mensuelle réelle (via l'historique de tx)
        try:
            s_data = self._get_savings_data()
            monthly_savings = float(s_data.get("monthly_savings", 0.0))
            if monthly_savings < 0:
                monthly_savings = 0.0
        except Exception:
            monthly_savings = 0.0

        def project_net_worth(years: int) -> float:
            # Répartition théorique de l'épargne mensuelle proportionnellement au portefeuille actuel
            # Si pas d'actifs productifs, on met tout dans 'savings' (épargne classique)
            weights = {atype: balance / total_pos for atype, balance in type_totals.items()} if total_pos > 0 else {"savings": 1.0}
            
            future_assets = 0.0
            
            for atype in type_totals.keys() | weights.keys():
                balance = type_totals.get(atype, 0.0)
                r = annual_rates.get(atype, 0.02)
                r_monthly = r / 12
                pmt = monthly_savings * weights.get(atype, 0.0)
                n_months = years * 12
                
                # Formule complète : Intérêts composés sur Capital + Intérêts composés sur Versements Mensuels (Annuity)
                if r > 0:
                    fv_capital = balance * ((1 + r) ** years)
                    fv_annuity = pmt * (((1 + r_monthly) ** n_months - 1) / r_monthly) * (1 + r_monthly)
                    future_assets += fv_capital + fv_annuity
                else:
                    future_assets += balance + (pmt * n_months)

            # Dettes amorties (simplification : on suppose qu'elles n'augmentent pas si on les rembourse, 
            # mais ici on garde la logique stricte d'intérêt si non remboursées)
            future_liabilities = total_liabilities * ((1 + liability_rate) ** years)
            return future_assets - future_liabilities

        proj_10 = project_net_worth(10)
        proj_20 = project_net_worth(20)
        proj_30 = project_net_worth(30)

        def growth_str(proj: float) -> str:
            if net_worth == 0:
                return "N/A"
            pct = (proj - net_worth) / abs(net_worth) * 100
            # Formater les grands pourcentages (ex: +1250%)
            return f"+{pct:,.0f}%"

        # ─── 7. Recommandations personnalisées
        recommendations = []

        if monthly_expenses > 0 and months_covered < 3:
            missing = emergency_3m - liquid_balance
            recommendations.append(
                f"🛡️ **Constituez votre fonds d'urgence** : Il vous manque **{missing:,.2f} $** pour atteindre 3 mois de dépenses. Mettez en place une règle d'allocation pour y verser 10% de vos revenus automatiquement."
            )

        if "stock" not in type_totals and "crypto" not in type_totals and net_worth > 3_000:
            recommendations.append(
                "📈 **Investissez en bourse** : Votre patrimoine est concentré en liquidités. Allouez 10–20% en ETF indiciels (S&P 500, MSCI World) pour profiter des intérêts composés sur le long terme (~6%/an historique)."
            )

        if debt_ratio > 40:
            recommendations.append(
                f"💳 **Réduisez vos dettes en urgence** : Ratio de {debt_ratio:.1f}%. Stratégie **Avalanche** recommandée — remboursez en priorité la dette au taux le plus élevé pour minimiser le coût total."
            )
        elif debt_ratio > 20:
            recommendations.append(
                f"💳 **Gérez activement vos dettes** : Ratio de {debt_ratio:.1f}%. Stratégie **Snowball** — remboursez la plus petite dette d'abord pour libérer du cash-flow et maintenir la motivation."
            )

        if diversity_score < 50:
            recommendations.append(
                "🌐 **Diversifiez votre patrimoine** : Moins de 2 classes d'actifs détectées. Explorez l'immobilier, les placements boursiers ou l'épargne réglementée pour réduire le risque global."
            )

        if health_score >= 80:
            recommendations.append(
                "🏆 **Patrimoine en excellent état !** Pensez à optimiser la fiscalité de vos placements (PEA, assurance-vie, PERI) pour maximiser le rendement net d'impôts."
            )

        if not recommendations:
            recommendations.append(
                "✅ **Votre patrimoine est solide.** Continuez à alimenter vos actifs régulièrement et profitez de la puissance des intérêts composés sur le long terme."
            )

        # ─── 8. Labels lisibles par type
        type_labels = {
            "checking": "Compte Courant", "savings": "Épargne",
            "stock": "Bourse", "crypto": "Crypto", "real_estate": "Immobilier",
        }

        # ─── 9. Rapport Final (Propulsé par IA Groq Llama 3)
        raw_stats = f"""
Patrimoine Net : {net_worth:,.2f} $
Actifs Productifs : {total_pos:,.2f} $
Dettes : {total_liabilities:,.2f} $ (Ratio: {debt_ratio:.1f}%)
Score de Diversification : {diversity_score}/100 ({n_types} classes d'actifs)
Score Santé Globale : {health_score}/100
Fonds d'Urgence : {liquid_balance:,.2f} $ (Objectif 3 mois: {emergency_3m:,.2f} $)
Projection 10 ans (intérêts composés {weighted_rate*100:.1f}%) : {proj_10:,.2f} $
Projection 20 ans : {proj_20:,.2f} $
Projection 30 ans : {proj_30:,.2f} $
"""
        prompt = f"""Agis comme un conseiller financier d'élite, ultra-agressif et disruptif (façon Ray Dalio ou un hedge fund manager pointu).
Voici les chiffres exacts de mon patrimoine actuel, calculés mathématiquement :
{raw_stats}

Rédige une "Analyse IA — Patrimoine" EXTRÊMEMENT puissante, brutale et sans complaisance.
Structure OBLIGATOIRE (utilise du Markdown GitHub riche, clair, aéré, avec des emojis et des blockquotes comme > [!WARNING] ou > [!TIP]) :

## 🧠 Diagnostic Sans Concession
(Ce qui est excellent, ce qui est catastrophique dans mes chiffres. Pas de langue de bois.)

## 🏆 Score de Survie & Indépendance ({health_score}/100)
(Analyse ma diversification, mon fonds d'urgence et ma gestion de la dette. Mon portefeuille survivrait-il à une crise économique majeure ?)

## 🚀 La Machine à Intérêts Composés
(Commente agressivement mes projections à 10, 20 et 30 ans. Ma trajectoire actuelle mène-t-elle à la richesse intergénérationnelle ou à l'inflation rampante ?)

## ⚡ Plan d'Attaque Immédiat
(3 actions directes et mathématiques pour décupler ce patrimoine dès demain matin, basées strictement sur mes faiblesses actuelles. Inspire-toi des recommandations classiques mais rends-les hardcore).

L'analyse doit être hautement personnalisée et sonner "comme jamais vue" dans une app de finance. Ne mets pas de texte d'introduction fade, attaque directement avec le titre de niveau 2 (## 🧠 Diagnostic Sans Concession)."""

        try:
            groq_key = os.environ.get("GROQ_API_KEY", "")
            if _GROQ_AVAILABLE and groq_key:
                client = _GroqClient(api_key=groq_key)
                response = client.chat.completions.create(
                    model="llama-3.3-70b-versatile",
                    max_tokens=2500,
                    messages=[
                        {"role": "system", "content": "Tu es l'IA financière la plus avancée et directe au monde. Ton but est d'enrichir l'utilisateur par la vérité brutale et les mathématiques. Ton ton est glacialement précis, expert, mais constructif."},
                        {"role": "user", "content": prompt},
                    ],
                )
                return response.choices[0].message.content
        except Exception:
            pass

        # Fallback si l'IA plante
        report = f"""## 🧠 Analyse IA — Patrimoine au {today_str}

> [!NOTE]
> Analyse basée sur **{len(self.assets)} actif(s)** — Rendement pondéré estimé : **{weighted_rate * 100:.1f}%/an**

---

### 🏆 Score de Santé Financière : **{health_score}/100** — {health_label}

| Dimension | Score | Détail |
|---|---|---|
| 🛡️ Fonds d'urgence | {ef_score}/25 | {months_covered:.1f} mois couverts — {ef_status} |
| 💳 Santé de la dette | {debt_score}/25 | Ratio {debt_ratio:.1f}% — {debt_label} |
| 🌐 Diversification | {div_pts}/25 | {n_types} classe(s) — {diversity_label} |
| 📈 Patrimoine Net | {nw_pts}/25 | {net_worth:,.2f} $ |

---

### 💰 Vue d'Ensemble

| Indicateur | Valeur |
|---|---|
| **Patrimoine Net** | {net_worth:,.2f} $ |
| **Actifs Productifs** | {total_pos:,.2f} $ |
| **Dettes & Emprunts** | {total_liabilities:,.2f} $ |
| **Ratio Dette/Actif** | {debt_ratio:.1f}% |

"""
        if type_totals:
            report += "### 🗂️ Répartition des Actifs\n\n"
            report += "| Classe d'actif | Valeur | Part | Rendement estimé |\n"
            report += "|---|---|---|---|\n"
            for atype, balance in sorted(type_totals.items(), key=lambda x: -x[1]):
                pct = (balance / total_pos * 100) if total_pos > 0 else 0
                rate = annual_rates.get(atype, 0.02) * 100
                label = type_labels.get(atype, atype.capitalize())
                report += f"| {label} | {balance:,.2f} $ | {pct:.1f}% | ~{rate:.1f}%/an |\n"
            if total_liabilities > 0:
                liab_pct = total_liabilities / (total_pos + total_liabilities) * 100 if (total_pos + total_liabilities) > 0 else 0
                report += f"| Dettes | -{total_liabilities:,.2f} $ | {liab_pct:.1f}% du brut | ~{liability_rate * 100:.1f}%/an (coût) |\n"
            report += "\n---\n\n"

        if monthly_expenses > 0:
            report += f"""### 🛡️ Fonds d'Urgence

| Cible | Montant | Statut |
|---|---|---|
| **3 mois** (minimum) | {emergency_3m:,.2f} $ | {"✅ Atteint" if liquid_balance >= emergency_3m else f"⚠️ Manque {max(0, emergency_3m - liquid_balance):,.0f} $"} |
| **6 mois** (idéal) | {emergency_6m:,.2f} $ | {"✅ Atteint" if liquid_balance >= emergency_6m else f"⚠️ Manque {max(0, emergency_6m - liquid_balance):,.0f} $"} |
| **Disponible** | {liquid_balance:,.2f} $ | {ef_status} |

---

"""
        report += f"""### 🚀 Projections par Intérêts Composés

> [!TIP]
> Ces projections supposent un rendement annuel pondéré de **{weighted_rate * 100:.1f}%** sur vos actifs actuels, sans apport supplémentaire. Chaque euro investi s'ajoute exponentiellement !

| Horizon | Patrimoine Net Estimé | Croissance |
|---|---|---|
| **Aujourd'hui** | {net_worth:,.2f} $ | — |
| **Dans 10 ans** | {proj_10:,.2f} $ | {growth_str(proj_10)} |
| **Dans 20 ans** | {proj_20:,.2f} $ | {growth_str(proj_20)} |
| **Dans 30 ans** | {proj_30:,.2f} $ | {growth_str(proj_30)} |

"""
        if total_liabilities > 0:
            cost_10y = total_liabilities * ((1 + liability_rate) ** 10) - total_liabilities
            report += f"""### 💳 Stratégie de Remboursement des Dettes

Dettes actuelles : **{total_liabilities:,.2f} $** | Coût en intérêts sur 10 ans si non remboursées : **{cost_10y:,.2f} $**

**Stratégie Avalanche** *(économise le plus en intérêts)*
- Remboursez en priorité la dette au taux d'intérêt le plus élevé

**Stratégie Snowball** *(motivation maximale)*
- Remboursez en priorité la plus petite dette

---

"""
        report += "### 💡 Recommandations Personnalisées\n\n"
        for rec in recommendations:
            report += f"- {rec}\n"

        report += "\n> [!TIP]\n> Utilisez les **Règles d'Allocation** pour automatiser votre épargne : définissez qu'un % de vos revenus soit viré automatiquement vers vos actifs cibles à chaque paie."

        return report

    def predict_cashflow(self) -> dict:
        """Math-based cashflow forecasting for the Dashboard Widget."""
        now = datetime.now()
        start_date, end_date = self._get_current_month_boundaries()
        stats = self._get_monthly_stats(start_date, end_date)
        
        try:
            days_in_month = (datetime.strptime(end_date, "%Y-%m-%d") - datetime.strptime(start_date, "%Y-%m-%d")).days + 1
            days_passed = (now - datetime.strptime(start_date, "%Y-%m-%d")).days + 1
            days_passed = max(1, days_passed) # avoid division by zero
        except Exception:
            days_in_month = 30
            days_passed = 15
            
        run_rate = stats["expenses"] / days_passed
        remaining_days = max(0, days_in_month - days_passed)
        
        projected_expenses = stats["expenses"] + (run_rate * remaining_days)
        projected_net = stats["income"] - projected_expenses
        
        return {
            "current_income": stats["income"],
            "current_expenses": stats["expenses"],
            "projected_expenses": projected_expenses,
            "projected_net": projected_net,
            "run_rate": run_rate,
            "remaining_days": remaining_days
        }
