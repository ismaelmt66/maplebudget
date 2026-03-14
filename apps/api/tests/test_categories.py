"""Tests for category CRUD operations."""

from tests.conftest import *  # noqa: F401, F403


class TestCategories:
    def test_create_category(self, client, auth_headers):
        resp = client.post("/categories", json={"name": "Food", "type": "expense"}, headers=auth_headers)
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "Food"
        assert data["type"] == "expense"

    def test_list_categories(self, client, auth_headers):
        client.post("/categories", json={"name": "Food", "type": "expense"}, headers=auth_headers)
        client.post("/categories", json={"name": "Salary", "type": "income"}, headers=auth_headers)
        resp = client.get("/categories", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        cats = data["data"] if isinstance(data, dict) and "data" in data else data
        assert len(cats) == 2

    def test_update_category(self, client, auth_headers):
        create = client.post("/categories", json={"name": "Food", "type": "expense"}, headers=auth_headers)
        cat_id = create.json()["id"]
        resp = client.put(f"/categories/{cat_id}", json={"name": "Groceries", "budget_limit": 500}, headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["name"] == "Groceries"
        assert resp.json()["budget_limit"] == 500

    def test_delete_category(self, client, auth_headers):
        create = client.post("/categories", json={"name": "Food", "type": "expense"}, headers=auth_headers)
        cat_id = create.json()["id"]
        resp = client.delete(f"/categories/{cat_id}", headers=auth_headers)
        assert resp.status_code == 200

    def test_unauthorized_access(self, client):
        resp = client.get("/categories")
        assert resp.status_code == 401
