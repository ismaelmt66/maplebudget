"""Transaction business logic extracted from the router.

Contains: suggest_category (AI + heuristic), process-recurring generation.
CRUD stays thin in the router; these are the complex operations.
"""

from __future__ import annotations

import calendar as _calendar
import os
from datetime import date as dt_date, datetime, timedelta

from sqlalchemy.orm import Session

import models
import schemas


def suggest_category(
    db: Session,
    user_id: int,
    description: str,
) -> schemas.SuggestCategoryResponse:
    """AI-first category suggestion with keyword fallback."""
    cats = db.query(models.Category).filter(models.Category.user_id == user_id).all()
    if not cats:
        return schemas.SuggestCategoryResponse(category_name="Aucune catégorie", confidence=0.0)

    desc_lower = description.lower().strip()

    groq_key = os.environ.get("GROQ_API_KEY")
    if groq_key:
        try:
            from groq import Groq as _GroqClient
            client = _GroqClient(api_key=groq_key)
            cat_list = "\n".join([f"- id={c.id}: {c.name} ({c.type})" for c in cats])
            prompt = (
                "Tu es un assistant de catégorisation financière.\n"
                f"Voici les catégories disponibles:\n{cat_list}\n\n"
                f'Description de la transaction: "{description}"\n\n'
                "Réponds UNIQUEMENT avec l'ID de la catégorie la plus appropriée (juste le nombre entier, rien d'autre)."
            )
            resp = client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=10,
                temperature=0,
            )
            raw = resp.choices[0].message.content.strip()
            cat_id = int("".join(c for c in raw if c.isdigit()))
            matched = next((c for c in cats if c.id == cat_id), None)
            if matched:
                return schemas.SuggestCategoryResponse(
                    category_id=matched.id, category_name=matched.name, confidence=0.9,
                )
        except Exception:
            pass

    return _heuristic_suggest(cats, desc_lower)


def _heuristic_suggest(
    cats: list[models.Category],
    description: str,
) -> schemas.SuggestCategoryResponse:
    keyword_map = {
        "alimentation": ["nourriture", "épicerie", "restaurant", "café", "food", "pizza", "burger", "iga", "metro", "maxi"],
        "transport": ["uber", "taxi", "bus", "stm", "train", "essence", "parking", "auto", "voiture"],
        "logement": ["loyer", "rent", "hydro", "électricité", "internet", "assurance", "maison"],
        "divertissement": ["netflix", "spotify", "amazon", "jeux", "cinéma", "concert", "sortie"],
        "santé": ["pharmacie", "médecin", "docteur", "dentiste", "gym", "sport"],
        "shopping": ["vêtements", "amazon", "achat", "shopping", "magasin"],
        "revenu": ["salaire", "paie", "revenu", "income", "virement"],
    }
    best_cat = None
    best_score = 0.0
    for cat in cats:
        score = 0.0
        cat_name_lower = cat.name.lower()
        if cat_name_lower in description or description in cat_name_lower:
            score = 0.85
        else:
            for kw_cat, keywords in keyword_map.items():
                if kw_cat in cat_name_lower:
                    for kw in keywords:
                        if kw in description:
                            score = max(score, 0.7)
            if any(word in description for word in cat_name_lower.split()):
                score = max(score, 0.6)
        if score > best_score:
            best_score = score
            best_cat = cat

    if best_cat and best_score > 0:
        return schemas.SuggestCategoryResponse(
            category_id=best_cat.id, category_name=best_cat.name, confidence=best_score,
        )
    return schemas.SuggestCategoryResponse(
        category_id=cats[0].id, category_name=cats[0].name, confidence=0.1,
    )


# ── Recurring transaction generation ─────────────────────────────────

def _add_interval(d: dt_date, interval: str) -> dt_date:
    if interval == "daily":
        return d + timedelta(days=1)
    if interval == "weekly":
        return d + timedelta(weeks=1)
    if interval == "monthly":
        month = d.month + 1
        year = d.year
        if month > 12:
            month = 1
            year += 1
        day = min(d.day, _calendar.monthrange(year, month)[1])
        return d.replace(year=year, month=month, day=day)
    if interval == "yearly":
        try:
            return d.replace(year=d.year + 1)
        except ValueError:
            return d.replace(year=d.year + 1, day=28)
    return d


def process_recurring_transactions(db: Session, user_id: int) -> dict:
    """Generate missing occurrences for all recurring transactions."""
    today = dt_date.today()
    recurring_txs = (
        db.query(models.Transaction)
        .filter(
            models.Transaction.user_id == user_id,
            models.Transaction.is_recurring == True,  # noqa: E712
            models.Transaction.recurrence_interval != None,  # noqa: E711
        )
        .order_by(models.Transaction.date.desc())
        .all()
    )
    seen: dict = {}
    for t in recurring_txs:
        key = (t.category_id, t.recurrence_interval, round(float(t.amount), 2))
        if key not in seen:
            seen[key] = t

    generated = []
    for key, last_tx in seen.items():
        interval = last_tx.recurrence_interval
        try:
            last_date = datetime.strptime(last_tx.date, "%Y-%m-%d").date()
        except ValueError:
            continue
        next_date = last_date
        iterations = 0
        while iterations < 366:
            iterations += 1
            next_date = _add_interval(next_date, interval)
            if next_date > today:
                break
            new_t = models.Transaction(
                amount=last_tx.amount,
                date=next_date.strftime("%Y-%m-%d"),
                note=last_tx.note,
                category_id=last_tx.category_id,
                user_id=user_id,
                is_recurring=True,
                recurrence_interval=interval,
            )
            db.add(new_t)
            db.flush()
            generated.append({
                "date": next_date.strftime("%Y-%m-%d"),
                "amount": float(last_tx.amount),
                "category_id": last_tx.category_id,
                "interval": interval,
            })
    db.commit()
    return {"generated": generated, "count": len(generated)}
