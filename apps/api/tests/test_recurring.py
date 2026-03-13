"""Tests for the RecurringDetectionEngine and recurring transaction endpoints.

Run with:
    cd apps/api && pip install -r requirements.txt pytest
    pytest tests/test_recurring.py -v
"""

from __future__ import annotations

import sys
import os
from datetime import date, timedelta
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine as sa_create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from db import Base, get_db  # noqa: E402
from main import app, get_current_user  # noqa: E402
import models  # noqa: E402, F401 — ensures all ORM models are registered
from services.recurring_detection import RecurringDetectionEngine  # noqa: E402


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def make_tx(
    tx_id: int = 1,
    amount: float = 50.0,
    tx_date: str = "2024-01-01",
    note: str = "Netflix",
    category_name: str = "Loisirs",
    category_type: str = "expense",
) -> MagicMock:
    """Create a mock Transaction object."""
    tx = MagicMock()
    tx.id = tx_id
    tx.amount = amount
    tx.date = tx_date
    tx.note = note
    tx.category = MagicMock()
    tx.category.name = category_name
    tx.category.type = category_type
    return tx


def make_monthly_txs(note: str = "Netflix", amount: float = 14.99, count: int = 4) -> list:
    """Create a list of monthly transactions spaced ~30 days apart."""
    txs = []
    start = date(2024, 1, 1)
    for i in range(count):
        d = start + timedelta(days=30 * i)
        txs.append(make_tx(tx_id=i + 1, amount=amount, tx_date=d.isoformat(), note=note))
    return txs


def make_weekly_txs(note: str = "Gym", amount: float = 25.0, count: int = 4) -> list:
    """Create a list of weekly transactions spaced 7 days apart."""
    txs = []
    start = date(2024, 1, 1)
    for i in range(count):
        d = start + timedelta(weeks=i)
        txs.append(make_tx(tx_id=i + 1, amount=amount, tx_date=d.isoformat(), note=note))
    return txs


def make_engine(txs: list) -> RecurringDetectionEngine:
    """Create a RecurringDetectionEngine with a mocked DB."""
    db = MagicMock()
    query_mock = MagicMock()
    filter_mock = MagicMock()
    order_mock = MagicMock()
    order_mock.all.return_value = txs
    filter_mock.order_by.return_value = order_mock
    query_mock.filter.return_value = filter_mock
    db.query.return_value = query_mock
    engine = RecurringDetectionEngine(db=db, user_id=1)
    return engine


# ---------------------------------------------------------------------------
# Unit tests: detect_recurring_patterns
# ---------------------------------------------------------------------------


def test_detect_monthly_pattern():
    """Monthly transactions (30-day intervals) should be detected."""
    txs = make_monthly_txs(note="Netflix", amount=14.99, count=4)
    engine = make_engine(txs)
    patterns = engine.detect_recurring_patterns()
    assert len(patterns) == 1
    assert patterns[0]["frequency"] == "monthly"
    assert patterns[0]["name"] == "Netflix"


def test_detect_weekly_pattern():
    """Weekly transactions (7-day intervals) should be detected."""
    txs = make_weekly_txs(note="Gym", amount=25.0, count=4)
    engine = make_engine(txs)
    patterns = engine.detect_recurring_patterns()
    assert len(patterns) == 1
    assert patterns[0]["frequency"] == "weekly"


def test_detect_no_pattern_less_than_3():
    """Groups with fewer than 3 transactions should not be detected."""
    txs = make_monthly_txs(note="Netflix", amount=14.99, count=2)
    engine = make_engine(txs)
    patterns = engine.detect_recurring_patterns()
    assert len(patterns) == 0


def test_detect_biweekly_pattern():
    """Biweekly transactions (14-day intervals) should be detected."""
    txs = []
    start = date(2024, 1, 1)
    for i in range(4):
        d = start + timedelta(weeks=2 * i)
        txs.append(make_tx(tx_id=i + 1, amount=100.0, tx_date=d.isoformat(), note="Loyer"))
    engine = make_engine(txs)
    patterns = engine.detect_recurring_patterns()
    assert len(patterns) == 1
    assert patterns[0]["frequency"] == "biweekly"


def test_detect_no_pattern_outside_ranges():
    """Transactions with intervals outside known ranges should not be detected."""
    txs = [
        make_tx(tx_id=1, amount=50.0, tx_date="2024-01-01", note="Weird"),
        make_tx(tx_id=2, amount=50.0, tx_date="2024-02-20", note="Weird"),
        make_tx(tx_id=3, amount=50.0, tx_date="2024-05-01", note="Weird"),
    ]
    engine = make_engine(txs)
    # Intervals: 50, 71 days → avg 60.5 days → outside all known ranges → no pattern
    result = engine.detect_recurring_patterns()
    assert isinstance(result, list)
    assert len(result) == 0


# ---------------------------------------------------------------------------
# Unit tests: _calculate_confidence
# ---------------------------------------------------------------------------


def test_confidence_score_high_consistent_intervals():
    """Perfectly consistent intervals should yield a high confidence score."""
    engine = RecurringDetectionEngine(db=MagicMock(), user_id=1)
    intervals = [30, 30, 30, 30]
    score = engine._calculate_confidence(intervals, expected_interval=30)
    assert score >= 0.8, f"Expected high confidence, got {score}"


def test_confidence_score_low_irregular_intervals():
    """Highly irregular intervals should yield a low confidence score."""
    engine = RecurringDetectionEngine(db=MagicMock(), user_id=1)
    intervals = [5, 60, 10, 90]
    score = engine._calculate_confidence(intervals, expected_interval=30)
    assert score < 0.5, f"Expected low confidence, got {score}"


def test_confidence_score_single_interval():
    """Single interval matching expected should yield high confidence."""
    engine = RecurringDetectionEngine(db=MagicMock(), user_id=1)
    score = engine._calculate_confidence([30], expected_interval=30)
    assert score >= 0.9


def test_confidence_score_empty_intervals():
    """Empty intervals list should return 0.0."""
    engine = RecurringDetectionEngine(db=MagicMock(), user_id=1)
    score = engine._calculate_confidence([], expected_interval=30)
    assert score == 0.0


# ---------------------------------------------------------------------------
# Unit tests: _determine_frequency
# ---------------------------------------------------------------------------


def test_determine_frequency_monthly():
    engine = RecurringDetectionEngine(db=MagicMock(), user_id=1)
    assert engine._determine_frequency(30.0) == "monthly"
    assert engine._determine_frequency(25.0) == "monthly"
    assert engine._determine_frequency(35.0) == "monthly"


def test_determine_frequency_weekly():
    engine = RecurringDetectionEngine(db=MagicMock(), user_id=1)
    assert engine._determine_frequency(7.0) == "weekly"
    assert engine._determine_frequency(5.0) == "weekly"
    assert engine._determine_frequency(9.0) == "weekly"


def test_determine_frequency_biweekly():
    engine = RecurringDetectionEngine(db=MagicMock(), user_id=1)
    assert engine._determine_frequency(14.0) == "biweekly"
    assert engine._determine_frequency(12.0) == "biweekly"
    assert engine._determine_frequency(18.0) == "biweekly"


def test_determine_frequency_unknown():
    """Intervals outside all known ranges should return None."""
    engine = RecurringDetectionEngine(db=MagicMock(), user_id=1)
    assert engine._determine_frequency(50.0) is None
    assert engine._determine_frequency(200.0) is None


def test_determine_frequency_quarterly():
    engine = RecurringDetectionEngine(db=MagicMock(), user_id=1)
    assert engine._determine_frequency(91.0) == "quarterly"


def test_determine_frequency_yearly():
    engine = RecurringDetectionEngine(db=MagicMock(), user_id=1)
    assert engine._determine_frequency(365.0) == "yearly"


# ---------------------------------------------------------------------------
# Unit tests: _predict_next
# ---------------------------------------------------------------------------


def test_predict_next_monthly():
    engine = RecurringDetectionEngine(db=MagicMock(), user_id=1)
    result = engine._predict_next("2024-01-15", "monthly")
    assert result == "2024-02-14"


def test_predict_next_weekly():
    engine = RecurringDetectionEngine(db=MagicMock(), user_id=1)
    result = engine._predict_next("2024-01-01", "weekly")
    assert result == "2024-01-08"


def test_predict_next_biweekly():
    engine = RecurringDetectionEngine(db=MagicMock(), user_id=1)
    result = engine._predict_next("2024-01-01", "biweekly")
    assert result == "2024-01-15"


def test_predict_next_yearly():
    engine = RecurringDetectionEngine(db=MagicMock(), user_id=1)
    result = engine._predict_next("2024-01-01", "yearly")
    # timedelta(days=365) from 2024-01-01 = 2024-12-31 (2024 is a leap year)
    assert result == "2024-12-31"


# ---------------------------------------------------------------------------
# Integration tests using FastAPI TestClient
# ---------------------------------------------------------------------------


@pytest.fixture
def test_db():
    engine = sa_create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client(test_db):
    def override_get_db():
        try:
            yield test_db
        finally:
            pass

    # Create a test user
    user = models.User(email="test@example.com", hashed_password="hashed")
    test_db.add(user)
    test_db.commit()
    test_db.refresh(user)

    def override_get_current_user():
        return user

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user

    with TestClient(app) as c:
        yield c

    app.dependency_overrides.clear()


def test_create_recurring_transaction(client):
    """Should create a recurring transaction manually."""
    payload = {
        "name": "Netflix",
        "amount": 14.99,
        "frequency": "monthly",
        "next_date": "2024-02-01",
    }
    resp = client.post("/recurring-transactions", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Netflix"
    assert data["frequency"] == "monthly"
    assert data["is_active"] is True


def test_list_recurring_transactions(client):
    """Should list all recurring transactions for the user."""
    # Create a recurring transaction first
    client.post(
        "/recurring-transactions",
        json={"name": "Spotify", "amount": 9.99, "frequency": "monthly"},
    )
    resp = client.get("/recurring-transactions")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 1
    assert data[0]["name"] == "Spotify"


def test_update_recurring_status_pause(client):
    """Should pause a recurring transaction."""
    create_resp = client.post(
        "/recurring-transactions",
        json={"name": "Amazon Prime", "amount": 6.99, "frequency": "monthly"},
    )
    rt_id = create_resp.json()["id"]

    resp = client.put(f"/recurring-transactions/{rt_id}", json={"is_active": False})
    assert resp.status_code == 200
    assert resp.json()["is_active"] is False


def test_update_recurring_status_resume(client):
    """Should resume a paused recurring transaction."""
    create_resp = client.post(
        "/recurring-transactions",
        json={"name": "Disney+", "amount": 8.99, "frequency": "monthly"},
    )
    rt_id = create_resp.json()["id"]

    client.put(f"/recurring-transactions/{rt_id}", json={"is_active": False})
    resp = client.put(f"/recurring-transactions/{rt_id}", json={"is_active": True})
    assert resp.status_code == 200
    assert resp.json()["is_active"] is True


def test_delete_recurring_transaction(client):
    """Should delete a recurring transaction."""
    create_resp = client.post(
        "/recurring-transactions",
        json={"name": "Old Subscription", "amount": 5.0, "frequency": "monthly"},
    )
    rt_id = create_resp.json()["id"]

    resp = client.delete(f"/recurring-transactions/{rt_id}")
    assert resp.status_code == 200
    assert resp.json()["ok"] is True

    # Verify it's gone
    list_resp = client.get("/recurring-transactions")
    ids = [item["id"] for item in list_resp.json()]
    assert rt_id not in ids


def test_detect_recurring_endpoint_empty(client):
    """Detect endpoint should return an empty list when there are no transactions."""
    resp = client.post("/recurring-transactions/detect")
    assert resp.status_code == 200
    assert resp.json() == []
