"""Service de détection automatique des transactions récurrentes.

Analyse les transactions des 6 derniers mois pour identifier les patterns
récurrents (même note + montant similaire avec tolérance de 10%).
"""

from datetime import date, datetime, timedelta
from collections import defaultdict
from typing import Optional
from sqlalchemy.orm import Session

import models


FREQUENCY_INTERVALS = {
    "daily": 1,
    "weekly": 7,
    "biweekly": 14,
    "monthly": 30,
    "quarterly": 91,
    "yearly": 365,
}


class RecurringDetectionEngine:
    """Moteur de détection des transactions récurrentes."""

    def detect_recurring_patterns(
        self, db: Session, user_id: int
    ) -> list[dict]:
        """Détecte les patterns récurrents dans les 6 derniers mois.

        Regroupe les transactions par note + montant (tolérance 10%),
        garde les groupes avec 3+ occurrences, calcule la fréquence
        et la confiance.
        """
        six_months_ago = (date.today() - timedelta(days=180)).strftime("%Y-%m-%d")

        txs = (
            db.query(models.Transaction, models.Category)
            .join(models.Category, models.Transaction.category_id == models.Category.id)
            .filter(models.Transaction.user_id == user_id)
            .filter(models.Transaction.date >= six_months_ago)
            .order_by(models.Transaction.date.asc())
            .all()
        )

        # Regroupe les transactions par note (ou nom de catégorie si note vide)
        groups: dict[str, list[tuple]] = defaultdict(list)
        for t, c in txs:
            key = (t.note or c.name or "").strip().lower()
            if key:
                groups[key].append((t, c))

        results = []

        for key, items in groups.items():
            if len(items) < 3:
                continue

            # Parser les dates
            items_with_dates = []
            for t, c in items:
                try:
                    d = datetime.strptime(t.date, "%Y-%m-%d").date()
                    items_with_dates.append((t, c, d, float(t.amount)))
                except ValueError:
                    pass

            if len(items_with_dates) < 3:
                continue

            # Vérifier que les montants sont similaires (tolérance 10%)
            amounts = [x[3] for x in items_with_dates]
            avg_amount = sum(amounts) / len(amounts)
            if any(abs(a - avg_amount) / max(avg_amount, 0.01) > 0.10 for a in amounts):
                continue

            # Calculer les intervalles entre occurrences
            dates = [x[2] for x in items_with_dates]
            intervals = [(dates[i + 1] - dates[i]).days for i in range(len(dates) - 1)]

            if not intervals:
                continue

            avg_interval = sum(intervals) / len(intervals)
            frequency = self._determine_frequency(avg_interval)

            if frequency is None:
                continue

            confidence = self._calculate_confidence(intervals, FREQUENCY_INTERVALS[frequency])

            last_t, last_c, last_date, _ = items_with_dates[-1]
            next_occ = self._predict_next(last_date, frequency)

            results.append({
                "name": last_t.note or last_c.name or key,
                "amount": avg_amount,
                "frequency": frequency,
                "next_occurrence": next_occ,
                "last_occurrence": last_date.strftime("%Y-%m-%d"),
                "confidence_score": confidence,
                "category_name": last_c.name,
            })

        # Trier par confiance décroissante
        results.sort(key=lambda x: x["confidence_score"], reverse=True)
        return results

    def _calculate_confidence(self, intervals: list[int], expected_interval: int) -> float:
        """Calcule un score de confiance entre 0 et 1.

        Basé sur la régularité des intervalles par rapport à l'intervalle attendu.
        """
        if not intervals or expected_interval <= 0:
            return 0.0

        deviations = [abs(iv - expected_interval) / max(expected_interval, 1) for iv in intervals]
        avg_deviation = sum(deviations) / len(deviations)

        # Score inversement proportionnel à la déviation
        confidence = max(0.0, 1.0 - avg_deviation)

        # Bonus pour nombre d'occurrences élevé
        count_bonus = min(0.1, len(intervals) * 0.01)
        return min(1.0, round(confidence + count_bonus, 2))

    def _predict_next(self, last_date: date, frequency: str) -> str:
        """Prédit la prochaine occurrence à partir de la dernière date."""
        interval_days = FREQUENCY_INTERVALS.get(frequency, 30)
        next_date = last_date + timedelta(days=interval_days)
        return next_date.strftime("%Y-%m-%d")

    def _determine_frequency(self, avg_interval: float) -> Optional[str]:
        """Détermine la fréquence en fonction de l'intervalle moyen en jours."""
        if avg_interval <= 1.5:
            return "daily"
        if 5 <= avg_interval <= 9:
            return "weekly"
        if 12 <= avg_interval <= 16:
            return "biweekly"
        if 25 <= avg_interval <= 35:
            return "monthly"
        if 80 <= avg_interval <= 100:
            return "quarterly"
        if 350 <= avg_interval <= 380:
            return "yearly"
        return None
