"""Service de détection de transactions récurrentes.

Analyse l'historique des transactions d'un utilisateur pour identifier
les patterns récurrents (abonnements, loyer, salaire, etc.).
"""

from __future__ import annotations

import math
from datetime import date, timedelta
from collections import defaultdict
from typing import Optional

from sqlalchemy.orm import Session

import models


class RecurringDetectionEngine:
    """Détecte les patterns de transactions récurrentes à partir de l'historique."""

    FREQUENCY_RANGES = {
        "daily": (1, 2),
        "weekly": (5, 9),
        "biweekly": (12, 18),
        "monthly": (25, 35),
        "quarterly": (80, 100),
        "yearly": (340, 395),
    }

    def __init__(self, db: Session, user_id: int) -> None:
        self.db = db
        self.user_id = user_id

    def detect_recurring_patterns(self) -> list[dict]:
        """Analyse les 6 derniers mois de transactions et retourne les patterns détectés.

        Returns:
            Liste de dicts avec: name, amount, frequency, confidence_score,
            last_occurrence, next_occurrence, category_name
        """
        six_months_ago = (date.today() - timedelta(days=182)).isoformat()

        txs = (
            self.db.query(models.Transaction)
            .filter(
                models.Transaction.user_id == self.user_id,
                models.Transaction.date >= six_months_ago,
            )
            .order_by(models.Transaction.date.asc())
            .all()
        )

        # Regrouper par (note, catégorie) avec montants similaires (±10%)
        groups: dict[str, list[models.Transaction]] = defaultdict(list)
        for tx in txs:
            key = self._group_key(tx)
            groups[key].append(tx)

        patterns = []
        for key, group_txs in groups.items():
            if len(group_txs) < 3:
                continue

            # Trier par date
            sorted_txs = sorted(group_txs, key=lambda t: t.date)

            # Calculer les intervalles entre transactions consécutives
            dates = [date.fromisoformat(t.date) for t in sorted_txs]
            intervals = [(dates[i + 1] - dates[i]).days for i in range(len(dates) - 1)]

            if not intervals:
                continue

            avg_interval = sum(intervals) / len(intervals)
            frequency = self._determine_frequency(avg_interval)

            if frequency is None:
                continue

            confidence = self._calculate_confidence(intervals, self._expected_interval(frequency))

            last_tx = sorted_txs[-1]
            last_date = last_tx.date
            next_date = self._predict_next(last_date, frequency)

            # Montant médian du groupe
            amounts = sorted(float(t.amount) for t in sorted_txs)
            median_amount = amounts[len(amounts) // 2]

            category_name = last_tx.category.name if last_tx.category else None

            patterns.append(
                {
                    "name": self._group_name(sorted_txs),
                    "amount": round(median_amount, 2),
                    "frequency": frequency,
                    "confidence_score": round(confidence, 2),
                    "last_occurrence": last_date,
                    "next_occurrence": next_date,
                    "category_name": category_name,
                }
            )

        return patterns

    # ------------------------------------------------------------------
    # Helpers privés
    # ------------------------------------------------------------------

    def _group_key(self, tx: models.Transaction) -> str:
        """Clé de regroupement basée sur la note et le montant arrondi."""
        note = (tx.note or "").strip().lower()
        # Arrondir le montant à la dizaine la plus proche pour regrouper les montants proches
        rounded = round(float(tx.amount) / 10) * 10
        return f"{note}|{rounded}"

    def _group_name(self, txs: list[models.Transaction]) -> str:
        """Choisit le meilleur nom pour le groupe."""
        notes = [t.note for t in txs if t.note and t.note.strip()]
        if notes:
            # Retourner la note la plus fréquente
            return max(set(notes), key=notes.count)
        if txs and txs[0].category:
            return txs[0].category.name
        return "Transaction récurrente"

    def _determine_frequency(self, avg_interval: float) -> Optional[str]:
        """Détermine la fréquence à partir de l'intervalle moyen en jours."""
        for freq, (low, high) in self.FREQUENCY_RANGES.items():
            if low <= avg_interval <= high:
                return freq
        return None

    def _expected_interval(self, frequency: str) -> int:
        """Retourne l'intervalle attendu en jours pour une fréquence donnée."""
        expected = {
            "daily": 1,
            "weekly": 7,
            "biweekly": 14,
            "monthly": 30,
            "quarterly": 91,
            "yearly": 365,
        }
        return expected.get(frequency, 30)

    def _calculate_confidence(self, intervals: list[int], expected_interval: int) -> float:
        """Calcule un score de confiance 0.0–1.0 basé sur la régularité des intervalles.

        Plus la variance est faible, plus le score est élevé.
        """
        if not intervals:
            return 0.0

        if len(intervals) == 1:
            diff = abs(intervals[0] - expected_interval)
            return max(0.0, 1.0 - diff / max(expected_interval, 1))

        mean = sum(intervals) / len(intervals)
        variance = sum((x - mean) ** 2 for x in intervals) / len(intervals)
        std_dev = math.sqrt(variance)

        # Normaliser : std_dev = 0 → confiance 1.0 ; std_dev >= expected/2 → confiance ~0
        normalized = std_dev / max(expected_interval / 2, 1)
        confidence = max(0.0, 1.0 - normalized)

        # Bonus si la moyenne est proche de l'intervalle attendu
        mean_diff = abs(mean - expected_interval) / max(expected_interval, 1)
        mean_score = max(0.0, 1.0 - mean_diff)

        return min(1.0, (confidence * 0.7 + mean_score * 0.3))

    def _predict_next(self, last_date: str, frequency: str) -> str:
        """Prédit la prochaine occurrence à partir de la dernière date et de la fréquence."""
        delta_map = {
            "daily": timedelta(days=1),
            "weekly": timedelta(weeks=1),
            "biweekly": timedelta(weeks=2),
            "monthly": timedelta(days=30),
            "quarterly": timedelta(days=91),
            "yearly": timedelta(days=365),
        }
        delta = delta_map.get(frequency, timedelta(days=30))
        last = date.fromisoformat(last_date)
        return (last + delta).isoformat()
