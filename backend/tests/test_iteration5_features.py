"""
Iteration-5 tests: Reverse Card Transaction, Full Payoff, Due Reminders, PDF/CSV export.
Uses DELTAS + gap invariance (Assets - Sources) because data is global.
"""
import os
import uuid
import requests
import pytest
from datetime import datetime, timezone, timedelta

from dotenv import load_dotenv
load_dotenv('/app/frontend/.env')
BASE_URL = os.environ['REACT_APP_BACKEND_URL'].rstrip('/')
TAG = f"QATEST_{uuid.uuid4().hex[:6]}"


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": "qatester@example.com", "password": "Test@12345"})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def h(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def snap(h):
    s = requests.get(f"{BASE_URL}/api/dashboard/summary", headers=h).json()
    gap = round((s["stock_value"] + s["total_paisa"]) -
                (s["credit_card_outstanding"] + s["fixed_poonji"] + s["total_profit"]), 2)
    return s, gap


def test_login_and_baseline(h):
    s, gap = snap(h)
    print(f"baseline gap = {gap}")
    assert "due_reminders" in s
    assert isinstance(s["due_reminders"], list)


def test_reverse_generic_spend(h):
    # Create bank + card
    ra = requests.post(f"{BASE_URL}/api/accounts", headers=h,
                       json={"type": "bank", "name": f"{TAG}_RBank", "opening_balance": 0}).json()
    rc = requests.post(f"{BASE_URL}/api/creditcards", headers=h,
                       json={"name": f"{TAG}_Rev", "limit": 100000}).json()
    card_id, acc_id = rc["id"], ra["id"]

    _, gap0 = snap(h)

    # spend 8000
    r = requests.post(f"{BASE_URL}/api/creditcards/{card_id}/transactions", headers=h,
                      json={"kind": "spend", "amount": 8000, "description": "genspend"})
    assert r.status_code == 200
    txns = requests.get(f"{BASE_URL}/api/creditcards/{card_id}/transactions", headers=h).json()
    spend_id = [t for t in txns if t["kind"] == "spend"][0]["id"]

    s1, gap1 = snap(h)
    assert gap1 == gap0, f"gap changed after spend: {gap0}->{gap1}"

    # reverse
    r = requests.delete(f"{BASE_URL}/api/creditcards/{card_id}/transactions/{spend_id}", headers=h)
    assert r.status_code == 200, r.text
    card = [c for c in requests.get(f"{BASE_URL}/api/creditcards", headers=h).json() if c["id"] == card_id][0]
    assert card["outstanding"] == 0
    s2, gap2 = snap(h)
    assert gap2 == gap0
    return card_id, acc_id


def test_reverse_payment_credits_account_back(h):
    ra = requests.post(f"{BASE_URL}/api/accounts", headers=h,
                       json={"type": "bank", "name": f"{TAG}_PB", "opening_balance": 0}).json()
    rc = requests.post(f"{BASE_URL}/api/creditcards", headers=h,
                       json={"name": f"{TAG}_PayRev", "limit": 100000}).json()
    card_id, acc_id = rc["id"], ra["id"]
    # give acc some money via adjust
    requests.post(f"{BASE_URL}/api/accounts/{acc_id}/adjust", headers=h,
                  json={"new_balance": 10000, "reason": "seed"})
    _, gap0 = snap(h)
    # spend 8000
    requests.post(f"{BASE_URL}/api/creditcards/{card_id}/transactions", headers=h,
                  json={"kind": "spend", "amount": 8000})
    # pay 5000 from acc
    requests.post(f"{BASE_URL}/api/creditcards/{card_id}/transactions", headers=h,
                  json={"kind": "payment", "amount": 5000, "account_id": acc_id})
    card = [c for c in requests.get(f"{BASE_URL}/api/creditcards", headers=h).json() if c["id"] == card_id][0]
    assert card["outstanding"] == 3000
    acc = [a for a in requests.get(f"{BASE_URL}/api/accounts", headers=h).json() if a["id"] == acc_id][0]
    assert acc["current_balance"] == 5000

    # find payment txn
    txns = requests.get(f"{BASE_URL}/api/creditcards/{card_id}/transactions", headers=h).json()
    pay_id = [t for t in txns if t["kind"] == "payment"][0]["id"]
    r = requests.delete(f"{BASE_URL}/api/creditcards/{card_id}/transactions/{pay_id}", headers=h)
    assert r.status_code == 200, r.text
    card = [c for c in requests.get(f"{BASE_URL}/api/creditcards", headers=h).json() if c["id"] == card_id][0]
    assert card["outstanding"] == 8000, "outstanding should restore to 8000"
    acc = [a for a in requests.get(f"{BASE_URL}/api/accounts", headers=h).json() if a["id"] == acc_id][0]
    assert acc["current_balance"] == 10000, f"account should be credited back to 10000, got {acc['current_balance']}"

    # gap invariance
    _, gap_after = snap(h)
    assert gap_after == gap0, f"gap changed: {gap0}->{gap_after}"


def test_reverse_refund(h):
    rc = requests.post(f"{BASE_URL}/api/creditcards", headers=h,
                       json={"name": f"{TAG}_RefRev", "limit": 50000}).json()
    card_id = rc["id"]
    requests.post(f"{BASE_URL}/api/creditcards/{card_id}/transactions", headers=h,
                  json={"kind": "spend", "amount": 10000})
    _, gap0 = snap(h)
    requests.post(f"{BASE_URL}/api/creditcards/{card_id}/transactions", headers=h,
                  json={"kind": "refund", "amount": 2000})
    card = [c for c in requests.get(f"{BASE_URL}/api/creditcards", headers=h).json() if c["id"] == card_id][0]
    assert card["outstanding"] == 8000
    txns = requests.get(f"{BASE_URL}/api/creditcards/{card_id}/transactions", headers=h).json()
    ref_id = [t for t in txns if t["kind"] == "refund"][0]["id"]
    r = requests.delete(f"{BASE_URL}/api/creditcards/{card_id}/transactions/{ref_id}", headers=h)
    assert r.status_code == 200
    card = [c for c in requests.get(f"{BASE_URL}/api/creditcards", headers=h).json() if c["id"] == card_id][0]
    assert card["outstanding"] == 10000
    _, gap1 = snap(h)
    assert gap1 == gap0


def test_reverse_stock_purchase_charge_blocked(h):
    rc = requests.post(f"{BASE_URL}/api/creditcards", headers=h,
                       json={"name": f"{TAG}_StockCard", "limit": 100000}).json()
    card_id = rc["id"]
    # buy stock on card
    r = requests.post(f"{BASE_URL}/api/stock", headers=h,
                      json={"mobile_model": f"{TAG}_M1", "purchase_price": 15000,
                            "payment_method": "credit_card", "card_id": card_id})
    assert r.status_code == 200
    txns = requests.get(f"{BASE_URL}/api/creditcards/{card_id}/transactions", headers=h).json()
    purchase_txn = [t for t in txns if t.get("category") == "purchase"][0]
    r = requests.delete(f"{BASE_URL}/api/creditcards/{card_id}/transactions/{purchase_txn['id']}", headers=h)
    assert r.status_code == 400, f"expected 400 blocking stock charge reverse, got {r.status_code}: {r.text}"


def test_full_payoff_semantics(h):
    """Verify pay-bill of full outstanding zeroes card, debits account fully, gap invariant."""
    ra = requests.post(f"{BASE_URL}/api/accounts", headers=h,
                       json={"type": "bank", "name": f"{TAG}_PayoffBank", "opening_balance": 0}).json()
    acc_id = ra["id"]
    requests.post(f"{BASE_URL}/api/accounts/{acc_id}/adjust", headers=h,
                  json={"new_balance": 50000, "reason": "seed"})
    rc = requests.post(f"{BASE_URL}/api/creditcards", headers=h,
                      json={"name": f"{TAG}_Payoff", "limit": 100000}).json()
    card_id = rc["id"]
    requests.post(f"{BASE_URL}/api/creditcards/{card_id}/transactions", headers=h,
                  json={"kind": "spend", "amount": 7777})
    _, gap0 = snap(h)
    card = [c for c in requests.get(f"{BASE_URL}/api/creditcards", headers=h).json() if c["id"] == card_id][0]
    full = card["outstanding"]
    assert full == 7777
    r = requests.post(f"{BASE_URL}/api/creditcards/{card_id}/transactions", headers=h,
                      json={"kind": "payment", "amount": full, "account_id": acc_id})
    assert r.status_code == 200
    card = [c for c in requests.get(f"{BASE_URL}/api/creditcards", headers=h).json() if c["id"] == card_id][0]
    assert card["outstanding"] == 0
    acc = [a for a in requests.get(f"{BASE_URL}/api/accounts", headers=h).json() if a["id"] == acc_id][0]
    assert acc["current_balance"] == 50000 - full
    _, gap1 = snap(h)
    assert gap1 == gap0


def test_due_reminders(h):
    today = datetime.now(timezone.utc).date()
    past = (today - timedelta(days=3)).isoformat()
    soon = (today + timedelta(days=3)).isoformat()
    far = (today + timedelta(days=30)).isoformat()

    # overdue
    c1 = requests.post(f"{BASE_URL}/api/creditcards", headers=h,
                       json={"name": f"{TAG}_Overdue", "limit": 50000,
                             "opening_outstanding": 5000, "due_date": past, "min_due": 500}).json()
    # soon
    c2 = requests.post(f"{BASE_URL}/api/creditcards", headers=h,
                       json={"name": f"{TAG}_Soon", "limit": 50000,
                             "opening_outstanding": 3000, "due_date": soon, "min_due": 300}).json()
    # far
    c3 = requests.post(f"{BASE_URL}/api/creditcards", headers=h,
                       json={"name": f"{TAG}_Far", "limit": 50000,
                             "opening_outstanding": 2000, "due_date": far, "min_due": 200}).json()
    # zero outstanding but due soon
    c4 = requests.post(f"{BASE_URL}/api/creditcards", headers=h,
                       json={"name": f"{TAG}_Zero", "limit": 50000, "due_date": soon,
                             "min_due": 0}).json()

    s = requests.get(f"{BASE_URL}/api/dashboard/summary", headers=h).json()
    ids = {r["card_id"] for r in s["due_reminders"]}
    assert c1["id"] in ids
    assert c2["id"] in ids
    assert c3["id"] not in ids, "far-future card must not appear"
    assert c4["id"] not in ids, "zero-outstanding card must not appear"
    # verify structure
    over = [r for r in s["due_reminders"] if r["card_id"] == c1["id"]][0]
    assert over["overdue"] is True
    assert over["min_due"] == 500
    assert over["outstanding"] == 5000


def test_regression_purchase_and_retail_sale(h):
    ra = requests.post(f"{BASE_URL}/api/accounts", headers=h,
                       json={"type": "bank", "name": f"{TAG}_RegBank", "opening_balance": 0}).json()
    rc = requests.post(f"{BASE_URL}/api/creditcards", headers=h,
                       json={"name": f"{TAG}_Reg", "limit": 100000}).json()
    _, gap0 = snap(h)
    # purchase on card
    st = requests.post(f"{BASE_URL}/api/stock", headers=h,
                       json={"mobile_model": f"{TAG}_R1", "purchase_price": 10000,
                             "payment_method": "credit_card", "card_id": rc["id"]}).json()
    _, gap1 = snap(h)
    assert gap1 == gap0
    card = [c for c in requests.get(f"{BASE_URL}/api/creditcards", headers=h).json() if c["id"] == rc["id"]][0]
    assert card["outstanding"] == 10000
    assert card["available"] == 90000
    # retail sale
    r = requests.post(f"{BASE_URL}/api/retail/sales", headers=h,
                      json={"mobile_model": f"{TAG}_R1", "sale_price": 12000, "cost_price": 10000,
                            "account_id": ra["id"], "stock_item_id": st["id"]})
    assert r.status_code == 200
    acc = [a for a in requests.get(f"{BASE_URL}/api/accounts", headers=h).json() if a["id"] == ra["id"]][0]
    assert acc["current_balance"] == 12000
    _, gap2 = snap(h)
    assert gap2 == gap0
