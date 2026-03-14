"""Smoke tests for the NexLedger API.

Validates that the application starts, healthcheck endpoints respond,
and core auth flow (register + login + me) works end-to-end.
"""

import os

os.environ.setdefault("SECRET_KEY", "test-secret-key-for-ci")
os.environ.setdefault("DATABASE_URL", "sqlite:///./test_nexledger.db")

import pytest
from fastapi.testclient import TestClient

from main import app, _rate_limit_store
from db import Base, engine


@pytest.fixture(autouse=True)
def setup_db():
    """Create all tables before each test and drop them after."""
    _rate_limit_store.clear()
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


client = TestClient(app)


class TestHealthEndpoints:
    def test_healthz(self):
        resp = client.get("/healthz")
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"

    def test_readyz(self):
        resp = client.get("/readyz")
        assert resp.status_code == 200
        assert resp.json()["db"] == "ok"


class TestAuthFlow:
    def _register(self, email="test@nexledger.com", password="securepassword123"):
        return client.post("/auth/register", json={"email": email, "password": password})

    def _login(self, email="test@nexledger.com", password="securepassword123"):
        return client.post("/auth/token", data={"username": email, "password": password})

    def test_register_returns_user(self):
        resp = self._register()
        assert resp.status_code == 201
        data = resp.json()
        assert data["email"] == "test@nexledger.com"
        assert "id" in data

    def test_register_duplicate_email(self):
        self._register()
        resp = self._register()
        assert resp.status_code == 400

    def test_register_short_password(self):
        resp = self._register(password="short")
        assert resp.status_code == 400

    def test_login_returns_tokens(self):
        self._register()
        resp = self._login()
        assert resp.status_code == 200
        data = resp.json()
        assert data["access_token"]
        assert data["refresh_token"]
        assert data["mfa_required"] is False

    def test_login_wrong_password(self):
        self._register()
        resp = self._login(password="wrongpassword")
        assert resp.status_code == 401

    def test_me_with_valid_token(self):
        self._register()
        login_resp = self._login()
        token = login_resp.json()["access_token"]
        resp = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        assert resp.json()["email"] == "test@nexledger.com"

    def test_me_without_token(self):
        resp = client.get("/auth/me")
        assert resp.status_code == 401

    def test_refresh_token_flow(self):
        self._register()
        login_resp = self._login()
        refresh = login_resp.json()["refresh_token"]
        resp = client.post("/auth/refresh", json={"refresh_token": refresh})
        assert resp.status_code == 200
        data = resp.json()
        assert data["access_token"]
        assert data["refresh_token"]


class TestRateLimiting:
    def test_auth_rate_limit(self):
        """Auth endpoints should be limited to 10/minute."""
        for _ in range(11):
            client.post("/auth/token", data={"username": "x", "password": "y"})
        resp = client.post("/auth/token", data={"username": "x", "password": "y"})
        assert resp.status_code == 429
