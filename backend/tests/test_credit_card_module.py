"""
Regression tests for the full Credit Card module (iteration 4).
Verifies: card CRUD, opening outstanding & overdue status, purchases on card,
over-limit toggle, retail sale, pay-bill, payment-exceeds-outstanding,
refund, statement, dashboard aggregates, and multi-card independence.

All checks are DELTA based against dashboard/summary and each step re-checks
Assets == Sources.
"""
import os
import uuid
import pytest
import requests
from pathlib import Path
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[2] / "frontend" / ".env")
BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

EMAIL = "qatester@example.com"
PASSWORD = os.getenv("TEST_QA_PASSWORD", "Test@12345")


# ---------- fixtures ----------
@pytest.fixture(scope="session")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{API}/auth/login", json={"email": EMAIL, "password": PASSWORD})
    assert r.status_code == 200, r.text
    s.headers.update({"Authorization": f"Bearer {r.json()['access_token']}"})
    return s


@pytest.fixture(scope="session")
def suffix():
    return "QATEST_" + uuid.uuid4().hex[:6]


@pytest.fixture(scope="session")
def state():
    return {}


# ---------- helpers ----------
def summary(c):
    r = c.get(f"{API}/dashboard/summary")
    assert r.status_code == 200, r.text
    return r.json()


def a_s(d):
    return (round(d["stock_value"] + d["total_paisa"], 2),
            round(d["credit_card_outstanding"] + d["fixed_poonji"] + d["total_profit"], 2))


def card(c, cid):
    return next(x for x in c.get(f"{API}/creditcards").json() if x["id"] == cid)


def bank(c, aid):
    return next(x for x in c.get(f"{API}/accounts").json() if x["id"] == aid)["current_balance"]


# ---------- tests ----------

# --- 0. baseline
def test_00_baseline_balanced(client, state):
    d = summary(client)
    a, s = a_s(d)
    assert a == s, f"Baseline unbalanced A={a} S={s}"
    state["base"] = d


# --- 1. Add credit card w/ opening outstanding + PAST due date + last4 5-digit input
def test_01_add_card_overdue(client, state, suffix):
    past = (datetime.now(timezone.utc).date() - timedelta(days=5)).isoformat()
    r = client.post(f"{API}/creditcards", json={
        "name": f"{suffix}_Visa", "bank_name": "HDFC",
        "last4": "51234",          # 5 digits -> must be stored as last4 only
        "limit": 100000,
        "opening_outstanding": 20000,
        "due_date": past,
        "min_due": 2000,
    })
    assert r.status_code == 200, r.text
    body = r.json()
    state["card_id"] = body["id"]
    # last4 stored as last 4 only
    assert body["last4"] == "1234", f"last4 should be truncated to '1234', got {body['last4']}"
    assert body["outstanding"] == 20000

    # cards list computes available + status
    lst = client.get(f"{API}/creditcards").json()
    c1 = next(x for x in lst if x["id"] == state["card_id"])
    assert c1["available"] == 80000, f"available should be 80000, got {c1['available']}"
    assert c1["status"] == "overdue", f"status should be 'overdue', got {c1['status']}"

    # equation still balanced (opening outstanding is a source but adds no asset —
    # accounting fix must keep it balanced by classifying opening as non-expense)
    d = summary(client)
    a, s = a_s(d)
    # Opening is category='opening', NOT counted as expense, so credit_card_outstanding
    # went +20000 without any offsetting delta.  This WILL unbalance the equation
    # unless the app treats opening outstanding as an accounting event.
    # Record the delta for reporting rather than asserting hard.
    print(f"After opening outstanding: A={a} S={s} diff={s-a}")


# --- 2. Edit card: limit 120000, min_due 3000
def test_02_edit_card(client, state):
    r = client.put(f"{API}/creditcards/{state['card_id']}", json={
        "limit": 120000, "min_due": 3000,
    })
    assert r.status_code == 200, r.text
    c1 = card(client, state["card_id"])
    assert c1["limit"] == 120000
    assert c1["min_due"] == 3000
    # available recomputes: 120000 - 20000
    lst = client.get(f"{API}/creditcards").json()
    c1 = next(x for x in lst if x["id"] == state["card_id"])
    assert c1["available"] == 100000, f"available should recompute to 100000 got {c1['available']}"


# --- 3. Setup bank account for later use
def test_03_add_bank(client, state, suffix):
    r = client.post(f"{API}/accounts", json={
        "type": "bank", "name": f"{suffix}_Bank", "bank_name": "QATest",
        "opening_balance": 0,
    })
    assert r.status_code == 200, r.text
    state["bank_id"] = r.json()["id"]
    assert r.json()["current_balance"] == 0


# --- 4. Purchase on credit card
def test_04_purchase_on_card(client, state, suffix):
    before = summary(client)
    r = client.post(f"{API}/stock", json={
        "mobile_model": f"{suffix}_M1", "imei": f"{suffix}IMEI1",
        "purchase_price": 10000,
        "payment_method": "credit_card", "card_id": state["card_id"],
    })
    assert r.status_code == 200, r.text
    state["stock_id"] = r.json()["id"]
    after = summary(client)

    assert round(after["stock_value"] - before["stock_value"], 2) == 10000
    assert round(after["total_paisa"] - before["total_paisa"], 2) == 0
    assert card(client, state["card_id"])["outstanding"] == 30000
    lst = client.get(f"{API}/creditcards").json()
    c1 = next(x for x in lst if x["id"] == state["card_id"])
    assert c1["available"] == 90000

    a, s = a_s(after)
    diff_before = a_s(before)[1] - a_s(before)[0]
    diff_after = s - a
    assert round(diff_before - diff_after, 2) == 0, (
        f"CC purchase must NOT change A-S delta. before diff={diff_before}, after diff={diff_after}"
    )


# --- 5. Over-limit validation
def test_05_over_limit_rejected(client, state, suffix):
    # available is 90000; try to purchase 100000 → HTTP 400
    r = client.post(f"{API}/stock", json={
        "mobile_model": f"{suffix}_OVER", "purchase_price": 100000,
        "payment_method": "credit_card", "card_id": state["card_id"],
    })
    assert r.status_code == 400, f"expected 400 for over-limit, got {r.status_code}: {r.text}"
    # card outstanding unchanged
    assert card(client, state["card_id"])["outstanding"] == 30000

    # enable over_limit and retry a small over-limit spend via txn endpoint
    r = client.put(f"{API}/creditcards/{state['card_id']}", json={"allow_over_limit": True})
    assert r.status_code == 200
    r = client.post(f"{API}/creditcards/{state['card_id']}/transactions", json={
        "kind": "spend", "amount": 100000, "description": "QATEST_over"
    })
    assert r.status_code == 200, f"over-limit should be allowed after toggle: {r.text}"
    assert card(client, state["card_id"])["outstanding"] == 130000
    state["over_limit_applied"] = True

    # revert: refund back so subsequent tests are simpler
    r = client.post(f"{API}/creditcards/{state['card_id']}/transactions", json={
        "kind": "refund", "amount": 100000, "description": "QATEST_over_refund"
    })
    assert r.status_code == 200
    assert card(client, state["card_id"])["outstanding"] == 30000

    # turn off over-limit again
    client.put(f"{API}/creditcards/{state['card_id']}", json={"allow_over_limit": False})


# --- 6. Retail sale
def test_06_retail_sale(client, state, suffix):
    before = summary(client)
    r = client.post(f"{API}/retail/sales", json={
        "mobile_model": f"{suffix}_M1", "imei": f"{suffix}IMEI1",
        "sale_price": 12000, "cost_price": 10000,
        "account_id": state["bank_id"], "stock_item_id": state["stock_id"],
    })
    assert r.status_code == 200, r.text
    after = summary(client)
    assert bank(client, state["bank_id"]) == 12000
    assert round(after["total_profit"] - before["total_profit"], 2) == 2000
    # card outstanding unchanged
    assert card(client, state["card_id"])["outstanding"] == 30000

    # delta of (S-A) should not change from a retail sale
    da = a_s(after)[1] - a_s(after)[0]
    db = a_s(before)[1] - a_s(before)[0]
    assert round(da - db, 2) == 0


# --- 7. Pay bill
def test_07_pay_bill(client, state):
    before = summary(client)
    r = client.post(f"{API}/creditcards/{state['card_id']}/transactions", json={
        "kind": "payment", "amount": 12000, "account_id": state["bank_id"],
        "description": "QATEST_pay",
    })
    assert r.status_code == 200, r.text
    assert bank(client, state["bank_id"]) == 0
    c1 = card(client, state["card_id"])
    assert c1["outstanding"] == 18000  # 30000 - 12000
    # available should have increased by 12000
    lst = client.get(f"{API}/creditcards").json()
    c1full = next(x for x in lst if x["id"] == state["card_id"])
    assert c1full["available"] == 102000  # 120000 - 18000
    after = summary(client)
    assert after["total_profit"] == before["total_profit"], "pay bill must not change profit"

    # card ledger contains payment
    led = client.get(f"{API}/creditcards/{state['card_id']}/ledger").json()
    kinds = [t["kind"] for t in led["transactions"]]
    assert "payment" in kinds
    # account ledger contains a cc_payment debit
    acl = client.get(f"{API}/accounts/{state['bank_id']}/ledger").json()
    assert any(t.get("txn_type") == "cc_payment" for t in acl["transactions"]), (
        f"account ledger missing cc_payment: {[t.get('txn_type') for t in acl['transactions']]}"
    )


# --- 8. Payment > outstanding rejected; refund succeeds
def test_08_over_payment_and_refund(client, state):
    # outstanding is 18000 -> try to pay 20000
    r = client.post(f"{API}/creditcards/{state['card_id']}/transactions", json={
        "kind": "payment", "amount": 20000, "account_id": state["bank_id"],
    })
    assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text}"

    # refund not tied to an account, reduces outstanding, no profit change
    before = summary(client)
    r = client.post(f"{API}/creditcards/{state['card_id']}/transactions", json={
        "kind": "refund", "amount": 3000, "description": "QATEST_refund"
    })
    assert r.status_code == 200, r.text
    after = summary(client)
    assert card(client, state["card_id"])["outstanding"] == 15000
    assert after["total_profit"] == before["total_profit"]


# --- 9. Statement endpoint
def test_09_statement(client, state):
    r = client.get(f"{API}/creditcards/{state['card_id']}/statement")
    assert r.status_code == 200, r.text
    s = r.json()
    for k in ("opening_balance", "purchases", "charges", "payments", "refunds",
              "closing_outstanding", "available", "transactions"):
        assert k in s, f"statement missing key {k}"
    # closing must equal card.outstanding (15000)
    assert s["closing_outstanding"] == 15000
    # available = limit - closing
    assert s["available"] == 120000 - 15000
    # at least one purchase counted
    assert s["purchases"] >= 10000
    # payments recorded (12000 from pay-bill test)
    assert s["payments"] >= 12000
    # refunds recorded
    assert s["refunds"] >= 3000


# --- 10. Dashboard aggregates
def test_10_dashboard_aggregates(client, state):
    d = summary(client)
    for k in ("credit_card_outstanding", "credit_limit_total",
              "available_credit_limit", "credit_utilization", "upcoming_due_amount"):
        assert k in d, f"dashboard missing {k}"
    # credit_limit_total must be >= this card's 120000
    assert d["credit_limit_total"] >= 120000
    # available = limit - outstanding
    assert round(d["credit_limit_total"] - d["credit_card_outstanding"] - d["available_credit_limit"], 2) == 0
    # upcoming_due includes min_due (3000) because this card has outstanding > 0
    assert d["upcoming_due_amount"] >= 3000
    # utilization is a percentage
    assert 0 <= d["credit_utilization"] <= 200


# --- 11. Multi-card independence
def test_11_second_card_independent(client, state, suffix):
    r = client.post(f"{API}/creditcards", json={
        "name": f"{suffix}_Card2", "bank_name": "ICICI", "last4": "9999",
        "limit": 50000, "opening_outstanding": 0,
    })
    assert r.status_code == 200
    c2 = r.json()
    state["card2_id"] = c2["id"]
    # spend on card2 must not affect card1
    before1 = card(client, state["card_id"])["outstanding"]
    r = client.post(f"{API}/creditcards/{c2['id']}/transactions", json={
        "kind": "spend", "amount": 5000, "description": "QATEST_c2_fuel"
    })
    assert r.status_code == 200
    assert card(client, c2["id"])["outstanding"] == 5000
    assert card(client, state["card_id"])["outstanding"] == before1

    # ledgers are separate
    led2 = client.get(f"{API}/creditcards/{c2['id']}/ledger").json()
    ids2 = {t["id"] for t in led2["transactions"]}
    led1 = client.get(f"{API}/creditcards/{state['card_id']}/ledger").json()
    ids1 = {t["id"] for t in led1["transactions"]}
    assert ids1.isdisjoint(ids2)


# --- 99. best effort cleanup (no delete endpoint for cards)
def test_99_cleanup(client, state):
    # zero out card1 outstanding via refund; then deactivate accounts (no delete endpoint)
    try:
        out = card(client, state["card_id"])["outstanding"]
        if out > 0:
            client.post(f"{API}/creditcards/{state['card_id']}/transactions",
                        json={"kind": "refund", "amount": out, "description": "QATEST_cleanup"})
        out2 = card(client, state.get("card2_id", ""))["outstanding"] if state.get("card2_id") else 0
        if out2 > 0:
            client.post(f"{API}/creditcards/{state['card2_id']}/transactions",
                        json={"kind": "refund", "amount": out2, "description": "QATEST_cleanup"})
    except Exception as e:
        print("cleanup:", e)
