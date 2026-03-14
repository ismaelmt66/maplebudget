"""Tests for admin routes and role management."""

from tests.conftest import *  # noqa: F401, F403


class TestAdminRoutes:
    def test_non_admin_cannot_list_users(self, client, auth_headers):
        resp = client.get("/admin/users", headers=auth_headers)
        assert resp.status_code == 403

    def test_admin_can_list_users(self, client, admin_headers):
        resp = client.get("/admin/users", headers=admin_headers)
        assert resp.status_code == 200
        users = resp.json()
        assert len(users) >= 1
        assert users[0]["role"] == "admin"

    def test_admin_can_update_user_role(self, client, admin_headers):
        client.post("/auth/register", json={"email": "target@test.com", "password": "testpass123"})
        users = client.get("/admin/users", headers=admin_headers).json()
        target = next(u for u in users if u["email"] == "target@test.com")
        resp = client.patch(f"/admin/users/{target['id']}", json={"role": "admin"}, headers=admin_headers)
        assert resp.status_code == 200
        assert resp.json()["role"] == "admin"

    def test_admin_cannot_demote_self(self, client, admin_headers):
        users = client.get("/admin/users", headers=admin_headers).json()
        admin = next(u for u in users if u["role"] == "admin")
        resp = client.patch(f"/admin/users/{admin['id']}", json={"role": "user"}, headers=admin_headers)
        assert resp.status_code == 400

    def test_admin_can_deactivate_user(self, client, admin_headers):
        client.post("/auth/register", json={"email": "deactivate@test.com", "password": "testpass123"})
        users = client.get("/admin/users", headers=admin_headers).json()
        target = next(u for u in users if u["email"] == "deactivate@test.com")
        resp = client.delete(f"/admin/users/{target['id']}", headers=admin_headers)
        assert resp.status_code == 200
        assert resp.json()["deactivated"] is True
