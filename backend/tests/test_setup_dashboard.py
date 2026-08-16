"""
Backend tests for the setup flow + new dashboard fields (iteration 2).
The DB is cleared before this test file runs (see conftest).
Covers:
  1. First-time setup: needs_setup true, POST /api/auth/setup returns token, auto-owner.
  2. Setup guard: second setup call returns 409.
  3. Login/logout + /me.
  4. Seed data via API and verify all new dashboard fields:
     summary values, business volume, liquidity & limits, credit-card totals.
  5. Regression: wholesale flow, transfer, negative balance, poonji.
"""
import os
import pytest
import requests
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[2] / "frontend" / ".env")
BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

EMAIL = "owner2@test.com"
PASSWORD = "Owner@12345"


@pytest.fixture(scope="module")
def token():
    # Setup status may be true (fresh DB) or false (already ran). Handle both.
    r = requests.get(f"{API}/auth/setup-status")
    assert r.status_code == 200
    if r.json()["needs_setup"]:
        r = requests.post(f"{API}/auth/setup", json={
            "email": EMAIL, "password": PASSWORD, "name": "Test Owner"
        })
        assert r.status_code == 200, r.text
        body = r.json()
        assert "access_token" in body
        assert body["user"]["email"] == EMAIL
        return body["access_token"]
    # already exists - login
    r = requests.post(f"{API}/auth/login", json={"email": EMAIL, "password": PASSWORD})
    assert r.status_code == 200, f"cannot login pre-existing owner: {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def client(token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def state():
    return {}


# ---------- 1. Setup + guard ----------
def test_setup_flow_and_guard(token):
    # After setup, needs_setup should be False
    r = requests.get(f"{API}/auth/setup-status")
    assert r.status_code == 200
    assert r.json()["needs_setup"] is False

    # Second call must be blocked with 409
    r = requests.post(f"{API}/auth/setup", json={
        "email": "another@test.com", "password": "Whatever@12345", "name": "X"
    })
    assert r.status_code == 409, r.text


def test_login_and_me(client):
    r = client.get(f"{API}/auth/me")
    assert r.status_code == 200
    assert r.json()["email"] == EMAIL

    # bad login
    r = requests.post(f"{API}/auth/login", json={"email": EMAIL, "password": "wrong"})
    assert r.status_code == 401


# ---------- 2. Seed data ----------
def test_seed_data(client, state):
    def acc(payload):
        r = client.post(f"{API}/accounts", json=payload)
        assert r.status_code == 200, r.text
        return r.json()

    cash = acc({"type": "cash", "name": "Cash", "opening_balance": 20000})
    hdfc = acc({"type": "bank", "name": "HDFC Bank", "bank_name": "HDFC",
                "last4": "1234", "opening_balance": 50000})
    gpay = acc({"type": "upi", "name": "Google Pay", "opening_balance": 15000})
    state.update({"cash": cash["id"], "hdfc": hdfc["id"], "gpay": gpay["id"]})

    # Stock item (purchase) - creates 1 in-stock unit at 14000
    r = client.post(f"{API}/stock", json={
        "mobile_model": "Samsung A15", "imei": "IMEI-STK-1", "purchase_price": 14000,
    })
    assert r.status_code == 200
    state["stock_item"] = r.json()["id"]

    # Retail sale iPhone 15 (this creates its own stock cost line? Depends on impl - only sale)
    r = client.post(f"{API}/retail/sales", json={
        "mobile_model": "iPhone 15", "imei": "IMEI-SALE-1",
        "sale_price": 12000, "cost_price": 8000, "account_id": state["hdfc"],
    })
    assert r.status_code == 200, r.text
    assert r.json()["profit"] == 4000

    # Fixed Poonji
    r = client.post(f"{API}/poonji", json={"amount": 100000, "description": "Capital"})
    assert r.status_code == 200

    # Credit card with limit 200000
    r = client.post(f"{API}/creditcards", json={"name": "HDFC CC", "last4": "5555", "limit": 200000})
    assert r.status_code == 200
    card_id = r.json()["id"]
    state["card"] = card_id

    # CC spend 30000
    r = client.post(f"{API}/creditcards/{card_id}/transactions", json={
        "kind": "spend", "amount": 30000, "description": "Purchase on card",
    })
    assert r.status_code == 200
    assert r.json()["outstanding"] == 30000


# ---------- 3. Dashboard math ----------
def test_dashboard_values(client, state):
    r = client.get(f"{API}/dashboard/summary")
    assert r.status_code == 200, r.text
    d = r.json()

    # Summary cards
    assert d["stock_value"] == 14000, d
    # Paisa = Cash 20000 + HDFC(50000+12000=62000) + GPay 15000 = 97000
    assert d["total_paisa"] == 97000, d
    assert d["credit_card_outstanding"] == 30000, d
    assert d["fixed_poonji"] == 100000, d
    assert d["total_profit"] == 4000, d

    # Business volume
    assert d["total_stock_units"] == 1, d
    assert d["total_purchase"] == 14000, d
    assert d["retail_sales_total"] == 12000, d
    assert d["wholesale_sales_total"] == 0, d

    # Liquidity
    assert d["wholesale_receivable"] == 0, d
    assert d["cash_balance"] == 20000, d
    assert d["total_bank"] == 62000, d
    assert d["total_upi"] == 15000, d
    assert d["credit_limit_total"] == 200000, d
    assert d["available_credit_limit"] == 170000, d

    # accounts breakdown
    names = {a["name"]: a["current_balance"] for a in d["accounts"]}
    assert names["Cash"] == 20000
    assert names["HDFC Bank"] == 62000
    assert names["Google Pay"] == 15000


# ---------- 4. Regression: wholesale + transfer + negative + poonji separation ----------
def test_wholesale_supply_does_not_touch_paisa(client, state):
    r = client.post(f"{API}/wholesale/customers", json={"name": "Shop X"})
    assert r.status_code == 200
    cust = r.json()["id"]

    before = client.get(f"{API}/dashboard/summary").json()
    r = client.post(f"{API}/wholesale/supplies", json={
        "customer_id": cust, "description": "Supply", "amount": 5000, "cost": 3000,
    })
    assert r.status_code == 200
    after = client.get(f"{API}/dashboard/summary").json()
    assert after["total_paisa"] == before["total_paisa"]
    assert after["wholesale_receivable"] - before["wholesale_receivable"] == 5000

    # payment increases paisa and reduces receivable
    r = client.post(f"{API}/wholesale/payments", json={
        "customer_id": cust, "amount": 5000, "account_id": state["hdfc"],
    })
    assert r.status_code == 200
    after2 = client.get(f"{API}/dashboard/summary").json()
    assert after2["total_paisa"] - after["total_paisa"] == 5000
    assert after2["wholesale_receivable"] == 0


def test_transfer_paisa_unchanged(client, state):
    before = client.get(f"{API}/dashboard/summary").json()["total_paisa"]
    r = client.post(f"{API}/transfers", json={
        "source_account_id": state["hdfc"], "dest_account_id": state["cash"], "amount": 1000,
    })
    assert r.status_code == 200
    after = client.get(f"{API}/dashboard/summary").json()["total_paisa"]
    assert after == before


def test_negative_balance_blocked(client, state):
    r = client.post(f"{API}/transfers", json={
        "source_account_id": state["cash"], "dest_account_id": state["hdfc"], "amount": 10_000_000,
    })
    assert r.status_code == 400
