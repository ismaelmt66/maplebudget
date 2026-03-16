"""Debug script - fetch transactions and catch detailed errors."""
import requests

BASE = "http://localhost:8000"

login = requests.post(f"{BASE}/auth/token", data={"username": "cors_test_fresh2@test.com", "password": "test1234"})
token = login.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}

# Enable detailed error response by calling with debug
r = requests.get(f"{BASE}/transactions", headers=headers, params={"debug": "1"})
print("=== STATUS ===", r.status_code)
print("=== HEADERS ===")
for k, v in r.headers.items():
    print(f"  {k}: {v}")
print("=== BODY ===")
print(r.text[:2000])
