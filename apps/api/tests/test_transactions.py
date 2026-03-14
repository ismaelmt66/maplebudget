"""Tests for transaction CRUD, export, and suggest-category."""

from tests.conftest import *  # noqa: F401, F403


class TestTransactions:
    def _create_category(self, client, headers, name="Food", cat_type="expense"):
        resp = client.post("/categories", json={"name": name, "type": cat_type}, headers=headers)
        return resp.json()["id"]

    def test_create_transaction(self, client, auth_headers):
        cat_id = self._create_category(client, auth_headers)
        resp = client.post("/transactions", json={
            "amount": 42.50, "date": "2026-01-15", "note": "Lunch", "category_id": cat_id,
        }, headers=auth_headers)
        assert resp.status_code == 201
        data = resp.json()
        assert data["amount"] == 42.50
        assert data["category"]["name"] == "Food"

    def test_list_transactions(self, client, auth_headers):
        cat_id = self._create_category(client, auth_headers)
        for i in range(3):
            client.post("/transactions", json={
                "amount": 10 + i, "date": f"2026-01-{10+i:02d}", "category_id": cat_id,
            }, headers=auth_headers)
        resp = client.get("/transactions", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        txs = data["data"] if isinstance(data, dict) and "data" in data else data
        assert len(txs) == 3

    def test_update_transaction(self, client, auth_headers):
        cat_id = self._create_category(client, auth_headers)
        create = client.post("/transactions", json={
            "amount": 25, "date": "2026-01-10", "category_id": cat_id,
        }, headers=auth_headers)
        tx_id = create.json()["id"]
        resp = client.put(f"/transactions/{tx_id}", json={"amount": 30, "note": "Updated"}, headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["amount"] == 30

    def test_delete_transaction(self, client, auth_headers):
        cat_id = self._create_category(client, auth_headers)
        create = client.post("/transactions", json={
            "amount": 25, "date": "2026-01-10", "category_id": cat_id,
        }, headers=auth_headers)
        tx_id = create.json()["id"]
        resp = client.delete(f"/transactions/{tx_id}", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["deleted"] is True

    def test_invalid_category(self, client, auth_headers):
        resp = client.post("/transactions", json={
            "amount": 10, "date": "2026-01-10", "category_id": 9999,
        }, headers=auth_headers)
        assert resp.status_code == 400

    def test_export_csv(self, client, auth_headers):
        cat_id = self._create_category(client, auth_headers)
        client.post("/transactions", json={
            "amount": 50, "date": "2026-01-15", "category_id": cat_id,
        }, headers=auth_headers)
        resp = client.get("/transactions/export/csv", headers=auth_headers)
        assert resp.status_code == 200
        assert "text/csv" in resp.headers["content-type"]
