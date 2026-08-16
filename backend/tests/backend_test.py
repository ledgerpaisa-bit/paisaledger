"""
End-to-end backend tests for Mobile Business Balance & Profit Tracker.
Covers: auth, accounts CRUD, dashboard math, retail sale, wholesale supply+payment,
transfers, negative-balance protection, ledger, poonji separation, stock, credit cards, profit.
"""
import os
import pytest
import requests
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[2] / "frontend" / ".env")
BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

EMAIL = "rahuldrrr@gmail.com"
PASSWORD = "Rahul@2026"


@pytest.fixture(scope="session")
def token():
    r = requests.post(f"{API}/auth/login", json={"email": EMAIL, "password": PASSWORD})
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    body = r.json()
    assert "access_token" in body and body["user"]["email"] == EMAIL
    return body["access_token"]


@pytest.fixture(scope="session")
def client(token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def state():
    return {}


# ---------- Auth ----------
def test_login_invalid():
    r = requests.post(f"{API}/auth/login", json={"email": EMAIL, "password": "wrong"})
    assert r.status_code == 401


def test_auth_me(client):
    r = client.get(f"{API}/auth/me")
    assert r.status_code == 200
    assert r.json()["email"] == EMAIL


# ---------- Accounts creation ----------
def _create_acc(client, payload):
    r = client.post(f"{API}/accounts", json=payload)
    assert r.status_code == 200, r.text
    return r.json()


def test_create_accounts(client, state):
    # Clean up any existing TEST accounts by name prefix? We can't easily delete. Use unique names.
    import uuid
    suffix = uuid.uuid4().hex[:6]
    state["suffix"] = suffix

    cash = _create_acc(client, {"type": "cash", "name": f"TEST_Cash_{suffix}", "opening_balance": 20000})
    hdfc = _create_acc(client, {"type": "bank", "name": f"TEST_HDFC_{suffix}", "bank_name": "HDFC", "last4": "1234", "opening_balance": 50000})
    sbi = _create_acc(client, {"type": "bank", "name": f"TEST_SBI_{suffix}", "bank_name": "SBI", "opening_balance": 30000})
    upi = _create_acc(client, {"type": "upi", "name": f"TEST_GPay_{suffix}", "opening_balance": 15000})

    assert cash["current_balance"] == 20000
    assert hdfc["current_balance"] == 50000
    assert sbi["current_balance"] == 30000
    assert upi["current_balance"] == 15000

    state.update({"cash": cash["id"], "hdfc": hdfc["id"], "sbi": sbi["id"], "upi": upi["id"]})


def test_dashboard_initial_totals(client, state):
    r = client.get(f"{API}/dashboard/summary")
    assert r.status_code == 200
    d = r.json()
    state["initial_paisa"] = d["total_paisa"]
    state["initial_cash"] = d["cash_balance"]
    state["initial_bank"] = d["total_bank"]
    state["initial_upi"] = d["total_upi"]
    # verify our 4 accounts contribute at least 1,15,000 delta
    # (there may be other accounts from prior runs; just check math consistency)
    accts = d["accounts"]
    total = round(sum(a["current_balance"] for a in accts), 2)
    assert total == d["total_paisa"]


# ---------- Retail sale ----------
def test_retail_sale_credits_hdfc(client, state):
    before = client.get(f"{API}/dashboard/summary").json()
    r = client.post(f"{API}/retail/sales", json={
        "mobile_model": "TEST_iPhone15", "imei": "111222333", "sale_price": 12000,
        "cost_price": 8000, "account_id": state["hdfc"],
    })
    assert r.status_code == 200, r.text
    sale = r.json()
    assert sale["profit"] == 4000
    assert sale["account_id"] == state["hdfc"]

    after = client.get(f"{API}/dashboard/summary").json()
    assert round(after["total_paisa"] - before["total_paisa"], 2) == 12000
    hdfc = next(a for a in after["accounts"] if a["id"] == state["hdfc"])
    hdfc_before = next(a for a in before["accounts"] if a["id"] == state["hdfc"])
    assert round(hdfc["current_balance"] - hdfc_before["current_balance"], 2) == 12000


# ---------- Wholesale ----------
def test_wholesale_supply_then_payment(client, state):
    # create customer
    r = client.post(f"{API}/wholesale/customers", json={"name": f"TEST_AShop_{state['suffix']}"})
    assert r.status_code == 200
    cust_id = r.json()["id"]
    state["customer"] = cust_id

    before = client.get(f"{API}/dashboard/summary").json()

    # supply doesn't affect paisa
    r = client.post(f"{API}/wholesale/supplies", json={
        "customer_id": cust_id, "description": "Supply1", "amount": 30000, "cost": 20000,
    })
    assert r.status_code == 200
    after_supply = client.get(f"{API}/dashboard/summary").json()
    assert after_supply["total_paisa"] == before["total_paisa"]
    assert round(after_supply["wholesale_receivable"] - before["wholesale_receivable"], 2) == 30000

    # verify customer outstanding
    custs = client.get(f"{API}/wholesale/customers").json()
    c = next(c for c in custs if c["id"] == cust_id)
    assert c["outstanding"] == 30000

    # payment into SBI
    sbi_before = next(a for a in after_supply["accounts"] if a["id"] == state["sbi"])["current_balance"]
    r = client.post(f"{API}/wholesale/payments", json={
        "customer_id": cust_id, "amount": 30000, "account_id": state["sbi"],
    })
    assert r.status_code == 200
    after_pay = client.get(f"{API}/dashboard/summary").json()
    sbi_after = next(a for a in after_pay["accounts"] if a["id"] == state["sbi"])["current_balance"]
    assert round(sbi_after - sbi_before, 2) == 30000
    assert round(after_pay["total_paisa"] - after_supply["total_paisa"], 2) == 30000

    custs = client.get(f"{API}/wholesale/customers").json()
    c = next(c for c in custs if c["id"] == cust_id)
    assert c["outstanding"] == 0


# ---------- Transfer ----------
def test_transfer_hdfc_to_sbi(client, state):
    before = client.get(f"{API}/dashboard/summary").json()
    hdfc_b = next(a for a in before["accounts"] if a["id"] == state["hdfc"])["current_balance"]
    sbi_b = next(a for a in before["accounts"] if a["id"] == state["sbi"])["current_balance"]

    r = client.post(f"{API}/transfers", json={
        "source_account_id": state["hdfc"], "dest_account_id": state["sbi"], "amount": 20000,
    })
    assert r.status_code == 200, r.text

    after = client.get(f"{API}/dashboard/summary").json()
    hdfc_a = next(a for a in after["accounts"] if a["id"] == state["hdfc"])["current_balance"]
    sbi_a = next(a for a in after["accounts"] if a["id"] == state["sbi"])["current_balance"]
    assert round(hdfc_b - hdfc_a, 2) == 20000
    assert round(sbi_a - sbi_b, 2) == 20000
    assert after["total_paisa"] == before["total_paisa"]

    # ledger both entries
    src_led = client.get(f"{API}/accounts/{state['hdfc']}/ledger").json()
    dst_led = client.get(f"{API}/accounts/{state['sbi']}/ledger").json()
    assert any(t["txn_type"] == "transfer_out" and t["amount"] == 20000 for t in src_led["transactions"])
    assert any(t["txn_type"] == "transfer_in" and t["amount"] == 20000 for t in dst_led["transactions"])


# ---------- Negative balance rejection ----------
def test_negative_balance_blocked(client, state):
    # try transferring more than cash balance (cash has 20000, allow_negative=false)
    cash_before = client.get(f"{API}/accounts").json()
    cash_bal = next(a for a in cash_before if a["id"] == state["cash"])["current_balance"]
    r = client.post(f"{API}/transfers", json={
        "source_account_id": state["cash"], "dest_account_id": state["sbi"],
        "amount": cash_bal + 5000,
    })
    assert r.status_code == 400
    # balance unchanged
    cash_after = client.get(f"{API}/accounts").json()
    assert next(a for a in cash_after if a["id"] == state["cash"])["current_balance"] == cash_bal


# ---------- Ledger with running balance ----------
def test_ledger_running_balance(client, state):
    r = client.get(f"{API}/accounts/{state['hdfc']}/ledger")
    assert r.status_code == 200
    data = r.json()
    txns = data["transactions"]
    assert len(txns) >= 3  # opening + sale + transfer_out
    # Reverse (they come newest-first) and recompute
    ordered = list(reversed(txns))
    running = 0
    for t in ordered:
        running = round(running + (t["amount"] if t["direction"] == "credit" else -t["amount"]), 2)
        assert t["running_balance"] == running


# ---------- Poonji ----------
def test_poonji_does_not_affect_paisa(client, state):
    before = client.get(f"{API}/dashboard/summary").json()
    r = client.post(f"{API}/poonji", json={"amount": 100000, "description": "TEST_capital"})
    assert r.status_code == 200
    after = client.get(f"{API}/dashboard/summary").json()
    assert after["total_paisa"] == before["total_paisa"]
    assert round(after["fixed_poonji"] - before["fixed_poonji"], 2) == 100000


# ---------- Stock ----------
def test_stock_add_and_sell(client, state):
    r = client.post(f"{API}/stock", json={"mobile_model": "TEST_S24", "imei": "999", "purchase_price": 40000})
    assert r.status_code == 200
    item_id = r.json()["id"]
    # sell it via retail
    r = client.post(f"{API}/retail/sales", json={
        "mobile_model": "TEST_S24", "imei": "999", "sale_price": 50000, "cost_price": 40000,
        "account_id": state["upi"], "stock_item_id": item_id,
    })
    assert r.status_code == 200
    # confirm marked sold
    items = client.get(f"{API}/stock").json()
    sold = next(i for i in items if i["id"] == item_id)
    assert sold["status"] == "sold"


# ---------- Credit Card ----------
def test_credit_card_spend_and_payment(client, state):
    r = client.post(f"{API}/creditcards", json={"name": f"TEST_HDFC_CC_{state['suffix']}", "last4": "9999"})
    assert r.status_code == 200
    card_id = r.json()["id"]

    # spend
    r = client.post(f"{API}/creditcards/{card_id}/transactions", json={
        "kind": "spend", "amount": 5000, "description": "TEST_spend",
    })
    assert r.status_code == 200
    assert r.json()["outstanding"] == 5000

    before = client.get(f"{API}/dashboard/summary").json()
    sbi_b = next(a for a in before["accounts"] if a["id"] == state["sbi"])["current_balance"]

    # payment from SBI
    r = client.post(f"{API}/creditcards/{card_id}/transactions", json={
        "kind": "payment", "amount": 3000, "account_id": state["sbi"], "description": "TEST_pay",
    })
    assert r.status_code == 200
    assert r.json()["outstanding"] == 2000

    after = client.get(f"{API}/dashboard/summary").json()
    sbi_a = next(a for a in after["accounts"] if a["id"] == state["sbi"])["current_balance"]
    assert round(sbi_b - sbi_a, 2) == 3000
    assert round(before["total_paisa"] - after["total_paisa"], 2) == 3000


# ---------- Profit report ----------
def test_profit_report(client):
    r = client.get(f"{API}/profit")
    assert r.status_code == 200
    p = r.json()
    assert p["total_profit"] == round(p["retail_profit"] + p["wholesale_profit"], 2)
    assert isinstance(p["sales"], list)
