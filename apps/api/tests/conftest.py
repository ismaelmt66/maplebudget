"""Shared test fixtures for NexLedger API tests."""

import os
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-ci")
os.environ.setdefault("DATABASE_URL", "sqlite:///./test_nexledger.db")

import pytest
from fastapi.testclient import TestClient

from main import app, _rate_limit_store
from db import Base, engine


@pytest.fixture(autouse=True)
def setup_db():
    _rate_limit_store.clear()
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def auth_headers(client):
    """Register a user and return auth headers."""
    client.post("/auth/register", json={"email": "user@test.com", "password": "testpassword123"})
    resp = client.post("/auth/token", data={"username": "user@test.com", "password": "testpassword123"})
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def admin_headers(client, auth_headers):
    """Promote the test user to admin and return headers."""
    from db import SessionLocal
    import models
    db = SessionLocal()
    user = db.query(models.User).filter(models.User.email == "user@test.com").first()
    user.role = "admin"
    db.commit()
    db.close()
    return auth_headers
