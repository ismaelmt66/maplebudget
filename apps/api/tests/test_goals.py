"""Tests for financial goals CRUD."""

from tests.conftest import *  # noqa: F401, F403


class TestGoals:
    def test_create_goal(self, client, auth_headers):
        resp = client.post("/goals", json={
            "title": "Emergency Fund", "target_amount": 10000,
            "current_amount": 2500, "target_date": "2027-12-31",
        }, headers=auth_headers)
        assert resp.status_code == 201
        data = resp.json()
        assert data["title"] == "Emergency Fund"
        assert data["target_amount"] == 10000

    def test_list_goals(self, client, auth_headers):
        client.post("/goals", json={
            "title": "Fund A", "target_amount": 5000, "target_date": "2027-06-01",
        }, headers=auth_headers)
        client.post("/goals", json={
            "title": "Fund B", "target_amount": 8000, "target_date": "2027-12-01",
        }, headers=auth_headers)
        resp = client.get("/goals", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        goals = data["data"] if isinstance(data, dict) and "data" in data else data
        assert len(goals) == 2

    def test_update_goal(self, client, auth_headers):
        create = client.post("/goals", json={
            "title": "Trip", "target_amount": 3000, "target_date": "2027-06-01",
        }, headers=auth_headers)
        goal_id = create.json()["id"]
        resp = client.put(f"/goals/{goal_id}", json={"current_amount": 1500}, headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["current_amount"] == 1500

    def test_delete_goal(self, client, auth_headers):
        create = client.post("/goals", json={
            "title": "Trip", "target_amount": 3000, "target_date": "2027-06-01",
        }, headers=auth_headers)
        goal_id = create.json()["id"]
        resp = client.delete(f"/goals/{goal_id}", headers=auth_headers)
        assert resp.status_code == 200

    def test_goal_plan(self, client, auth_headers):
        create = client.post("/goals", json={
            "title": "House", "target_amount": 50000,
            "current_amount": 10000, "target_date": "2030-01-01",
        }, headers=auth_headers)
        goal_id = create.json()["id"]
        resp = client.get(f"/goals/{goal_id}/plan", headers=auth_headers)
        assert resp.status_code == 200
        plan = resp.json()
        assert plan["goal_id"] == goal_id
        assert plan["monthly_required"] > 0
