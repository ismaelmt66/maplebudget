"""Tests for financial health score calculation."""

from tests.conftest import *  # noqa: F401, F403


class TestHealthScore:
    def test_health_score_empty_user(self, client, auth_headers):
        resp = client.get("/financial-health-score", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "score" in data
        assert "grade" in data
        assert "breakdown" in data
        assert 0 <= data["score"] <= 100

    def test_health_score_with_data(self, client, auth_headers):
        cat_income = client.post("/categories", json={"name": "Salary", "type": "income"}, headers=auth_headers).json()["id"]
        cat_expense = client.post("/categories", json={"name": "Food", "type": "expense", "budget_limit": 500}, headers=auth_headers).json()["id"]

        client.post("/transactions", json={"amount": 5000, "date": "2026-01-01", "category_id": cat_income}, headers=auth_headers)
        client.post("/transactions", json={"amount": 200, "date": "2026-01-05", "category_id": cat_expense}, headers=auth_headers)

        resp = client.get("/financial-health-score", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["score"] > 0
        assert data["breakdown"]["savings_rate"] > 0

    def test_health_score_breakdown_keys(self, client, auth_headers):
        resp = client.get("/financial-health-score", headers=auth_headers)
        breakdown = resp.json()["breakdown"]
        assert "savings_rate" in breakdown
        assert "budget_compliance" in breakdown
        assert "emergency_fund" in breakdown
        assert "goal_progress" in breakdown
        assert "diversification" in breakdown
