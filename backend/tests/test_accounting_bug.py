"""
Regression test for the accounting-equation bug:
- Purchase on credit card (Stock -> Add Purchase with payment_method=credit_card)
- Retail sale receives FULL sale_price into selected account
- Pay Credit Card Bill flow
- Generic credit-card 'spend' (category=expense) reduces total_profit so Assets==Sources
Assets  = stock_value + total_paisa
Sources = credit_card_outstanding + fixed_poonji + total_profit
"""
import os
import uuid
import pytest
import requests
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[2] / "frontend" / ".env")
BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

EMAIL = "qatester@example.com"
PASSWORD = os.getenv("TEST_QA_PASSWORD", "Test@12345")


@pytest.fixture(scope="session")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{API}/auth/login", json={"email": EMAIL, "password": PASSWORD})
    assert r.status_code == 200, r.text
    tok = r.json()["access_token"]
    s.headers.update({"Authorization": f"Bearer {tok}"})
    return s


@pytest.fixture(scope="session")
def suffix():
    return "QATEST_" + uuid.uuid4().hex[:6]


@pytest.fixture(scope="session")
def state():
    return {}


def summary(client):
    r = client.get(f"{API}/dashboard/summary")
    assert r.status_code == 200, r.text
    return r.json()


def assets_sources(d):
    assets = round(d["stock_value"] + d["total_paisa"], 2)
    sources = round(d["credit_card_outstanding"] + d["fixed_poonji"] + d["total_profit"], 2)
    return assets, sources


def card_outstanding(client, card_id):
    cards = client.get(f"{API}/creditcards").json()
    return next(c for c in cards if c["id"] == card_id)["outstanding"]


def bank_balance(client, acc_id):
    accs = client.get(f"{API}/accounts").json()
    return next(a for a in accs if a["id"] == acc_id)["current_balance"]


def test_00_baseline_balanced(client, state):
    d = summary(client)
    a, s = assets_sources(d)
    print(f"Baseline: Assets={a} Sources={s}")
    assert a == s, f"Baseline already unbalanced: A={a} S={s}"
    state["baseline"] = d


def test_01_setup_accounts(client, state, suffix):
    r = client.post(f"{API}/accounts", json={
        "type": "bank", "name": f"{suffix}_Bank", "bank_name": "QATest",
        "opening_balance": 0,
    })
    assert r.status_code == 200, r.text
    state["bank_id"] = r.json()["id"]
    assert r.json()["current_balance"] == 0

    r = client.post(f"{API}/creditcards", json={
        "name": f"{suffix}_Card", "last4": "0001", "limit": 100000,
    })
    assert r.status_code == 200, r.text
    state["card_id"] = r.json()["id"]
    assert r.json()["outstanding"] == 0

    # Assets/Sources still balanced (opening_balance=0 accounts)
    a, s = assets_sources(summary(client))
    assert a == s, f"Unbalanced after setup: A={a} S={s}"


def test_02_purchase_on_credit_card(client, state):
    before = summary(client)
    r = client.post(f"{API}/stock", json={
        "mobile_model": "QATEST_M1", "imei": "QATEST0001",
        "purchase_price": 10000,
        "payment_method": "credit_card",
        "card_id": state["card_id"],
    })
    assert r.status_code == 200, r.text
    state["stock_id"] = r.json()["id"]

    after = summary(client)
    assert round(after["stock_value"] - before["stock_value"], 2) == 10000, "stock_value should +10000"
    assert round(after["total_paisa"] - before["total_paisa"], 2) == 0, "paisa unchanged"
    assert after["total_profit"] == before["total_profit"], "profit unchanged"

    # Card outstanding +10000
    assert card_outstanding(client, state["card_id"]) == 10000
    # Bank unchanged
    assert bank_balance(client, state["bank_id"]) == 0

    a, s = assets_sources(after)
    assert a == s, f"Unbalanced after CC purchase: A={a} S={s}"


def test_03_retail_sale_credits_full_amount(client, state):
    before = summary(client)
    bank_before = bank_balance(client, state["bank_id"])

    r = client.post(f"{API}/retail/sales", json={
        "mobile_model": "QATEST_M1", "imei": "QATEST0001",
        "sale_price": 12000, "cost_price": 10000,
        "account_id": state["bank_id"], "stock_item_id": state["stock_id"],
    })
    assert r.status_code == 200, r.text
    assert r.json()["profit"] == 2000

    after = summary(client)
    bank_after = bank_balance(client, state["bank_id"])

    # CORE BUG CHECK: Bank must receive FULL 12000, not just profit 2000
    assert bank_after - bank_before == 12000, f"Bank should receive full 12000, got {bank_after - bank_before}"
    assert bank_after == 12000, f"Bank balance should be 12000, got {bank_after}"

    assert round(after["total_paisa"] - before["total_paisa"], 2) == 12000
    assert round(after["total_profit"] - before["total_profit"], 2) == 2000
    # stock returned to baseline
    assert round(after["stock_value"] - state["baseline"]["stock_value"], 2) == 0
    # card outstanding unchanged
    assert card_outstanding(client, state["card_id"]) == 10000

    a, s = assets_sources(after)
    assert a == s, f"Unbalanced after retail sale: A={a} S={s}"


def test_04_pay_credit_card_bill(client, state):
    before = summary(client)
    bank_before = bank_balance(client, state["bank_id"])

    r = client.post(f"{API}/creditcards/{state['card_id']}/transactions", json={
        "kind": "payment", "amount": 10000, "account_id": state["bank_id"],
        "description": "QATEST_Pay",
    })
    assert r.status_code == 200, r.text
    assert r.json()["outstanding"] == 0

    after = summary(client)
    assert bank_balance(client, state["bank_id"]) == 2000, "Bank 12000 -> 2000"
    assert card_outstanding(client, state["card_id"]) == 0
    assert after["total_profit"] == before["total_profit"], "profit unchanged by CC payment"
    assert round(before["total_paisa"] - after["total_paisa"], 2) == 10000

    # available limit back to 100000
    card = next(c for c in client.get(f"{API}/creditcards").json() if c["id"] == state["card_id"])
    assert (card["limit"] - card["outstanding"]) == 100000

    a, s = assets_sources(after)
    assert a == s, f"Unbalanced after CC payment: A={a} S={s}"


def test_05_generic_card_spend_is_expense(client, state):
    """Core equation-integrity fix: generic (non-purchase) CC spend must reduce profit."""
    before = summary(client)
    assert "total_expenses" in before, "dashboard must expose total_expenses field"

    r = client.post(f"{API}/creditcards/{state['card_id']}/transactions", json={
        "kind": "spend", "amount": 5000, "description": "QATEST_fuel",
    })
    assert r.status_code == 200, r.text
    assert r.json()["outstanding"] == 5000

    after = summary(client)
    assert round(before["total_profit"] - after["total_profit"], 2) == 5000, (
        f"Profit should decrease by 5000. before={before['total_profit']} after={after['total_profit']}"
    )
    assert round(after["total_expenses"] - before["total_expenses"], 2) == 5000
    assert card_outstanding(client, state["card_id"]) == 5000

    a, s = assets_sources(after)
    assert a == s, f"Unbalanced after generic CC spend: A={a} S={s}"


def test_06_card_ledger_shows_payment(client, state):
    r = client.get(f"{API}/creditcards/{state['card_id']}/ledger")
    assert r.status_code == 200, r.text
    data = r.json()
    txns = data.get("transactions", data if isinstance(data, list) else [])
    kinds = [t.get("kind") for t in txns]
    assert "payment" in kinds, f"card ledger missing payment. kinds={kinds}"
    assert "spend" in kinds


def test_07_account_ledger_shows_card_payment(client, state):
    r = client.get(f"{API}/accounts/{state['bank_id']}/ledger")
    assert r.status_code == 200, r.text
    txns = r.json()["transactions"]
    # Should contain the CC payment as a debit
    cc_pays = [t for t in txns if t.get("txn_type") in ("cc_payment", "card_payment") or "card" in (t.get("description", "") or "").lower()]
    assert cc_pays, f"account ledger missing CC payment debit. txn_types={[t.get('txn_type') for t in txns]}"


def test_99_cleanup(client, state):
    # Best-effort cleanup: delete card txns, card, stock, account
    try:
        client.delete(f"{API}/creditcards/{state['card_id']}")
    except Exception:
        pass
    try:
        client.delete(f"{API}/accounts/{state['bank_id']}")
    except Exception:
        pass
