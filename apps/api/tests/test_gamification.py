"""Tests for gamification: achievements and rewards dashboard."""

from tests.conftest import *  # noqa: F401, F403


class TestAchievements:
    def test_get_achievements(self, client, auth_headers):
        resp = client.get("/achievements", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "achievements" in data
        assert "xp" in data
        assert "level" in data
        assert isinstance(data["achievements"], list)
        assert len(data["achievements"]) > 0

    def test_initial_level_is_debutant(self, client, auth_headers):
        resp = client.get("/achievements", headers=auth_headers)
        data = resp.json()
        assert data["xp"] == 0
        assert data["level"] == "Débutant"

    def test_first_tx_achievement_unlocked(self, client, auth_headers):
        cat = client.post("/categories", json={"name": "Food", "type": "expense"}, headers=auth_headers)
        cat_id = cat.json()["id"]
        client.post("/transactions", json={
            "amount": 10, "date": "2026-01-15", "category_id": cat_id,
        }, headers=auth_headers)
        resp = client.get("/achievements", headers=auth_headers)
        data = resp.json()
        first_tx = next(a for a in data["achievements"] if a["id"] == "first_tx")
        assert first_tx["is_unlocked"] is True

    def test_xp_increases_with_achievements(self, client, auth_headers):
        cat = client.post("/categories", json={"name": "Food", "type": "expense"}, headers=auth_headers)
        cat_id = cat.json()["id"]
        client.post("/transactions", json={
            "amount": 10, "date": "2026-01-15", "category_id": cat_id,
        }, headers=auth_headers)
        resp = client.get("/achievements", headers=auth_headers)
        data = resp.json()
        assert data["xp"] > 0


class TestRewardsDashboard:
    def test_rewards_dashboard(self, client, auth_headers):
        resp = client.get("/gamification/rewards", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "milestones" in data
        assert "next_achievements" in data
        assert isinstance(data["milestones"], list)
