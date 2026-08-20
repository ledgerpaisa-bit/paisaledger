"""
Iteration-6 tests:
  (1) Soft-close / reopen credit card (keeps txns, excluded from active list & dashboard limits)
  (2) Business settings (business_name / logo_url) for statement branding
  (3) Date handling (YYYY-MM-DD stored exactly, no timezone shift) for date-picker forms
  (4) Regression: purchase on card, retail sale, pay bill, gap invariance
Data is GLOBAL -> use DELTAS + gap invariance.
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
def h():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": "qatester@example.com", "password": "Test@12345"})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}",
            "Content-Type": "application/json"}


def snap(h):
    s = requests.get(f"{BASE_URL}/api/dashboard/summary", headers=h).json()
    gap = round((s["stock_value"] + s["total_paisa"]) -
                (s["credit_card_outstanding"] + s["fixed_poonji"] + s["total_profit"]), 2)
    return s, gap


def get_card(h, card_id, active=None):
    url = f"{BASE_URL}/api/creditcards" + ("?active=true" if active else "")
    cards = requests.get(url, headers=h).json()
    m = [c for c in cards if c["id"] == card_id]
    return m[0] if m else None


# --------------------------------------------------------------- baseline
def test_baseline_and_auth(h):
    s, gap = snap(h)
    print(f"baseline gap={gap} paisa={s['total_paisa']} profit={s['total_profit']}")
    assert "credit_card_outstanding" in s


# --------------------------------------------------------------- (1) soft close
def test_soft_close_and_reopen_card(h):
    acc = requests.post(f"{BASE_URL}/api/accounts", headers=h,
                        json={"type": "bank", "name": f"{TAG}_CloseBank",
                              "opening_balance": 0}).json()
    card = requests.post(f"{BASE_URL}/api/creditcards", headers=h,
                         json={"name": f"{TAG} CloseCard", "limit": 50000,
                               "due_date": (datetime.now(timezone.utc).date() + timedelta(days=3)).isoformat(),
                               "min_due": 500}).json()
    cid = card["id"]

    # a purchase + a generic spend so we can prove txns survive closing
    st = requests.post(f"{BASE_URL}/api/stock", headers=h,
                       json={"mobile_model": f"{TAG}_Phone", "purchase_price": 10000,
                             "payment_method": "credit_card", "card_id": cid,
                             "date": "2026-07-10"})
    assert st.status_code == 200, st.text
    requests.post(f"{BASE_URL}/api/creditcards/{cid}/transactions", headers=h,
                  json={"kind": "spend", "amount": 2000, "category": "expense",
                        "description": "qa expense", "date": "2026-07-11"})

    txns_before = requests.get(f"{BASE_URL}/api/creditcards/{cid}/transactions", headers=h).json()
    assert len(txns_before) == 2
    s0, gap0 = snap(h)

    # appears in active list before closing
    assert get_card(h, cid, active=True) is not None, "new card missing from active list"

    # ---- CLOSE
    r = requests.patch(f"{BASE_URL}/api/creditcards/{cid}/close", headers=h)
    assert r.status_code == 200, r.text
    assert r.json().get("closed") is True

    c_all = get_card(h, cid)
    assert c_all is not None, "closed card disappeared from GET /creditcards"
    assert c_all["closed"] is True
    assert c_all["status"] == "closed"
    assert c_all["outstanding"] == 12000, c_all["outstanding"]

    # excluded from active (dropdown source)
    assert get_card(h, cid, active=True) is None, "closed card still in ?active=true"

    # txns / ledger / statement still accessible
    txns_after = requests.get(f"{BASE_URL}/api/creditcards/{cid}/transactions", headers=h).json()
    assert len(txns_after) == len(txns_before), "closing deleted transactions"
    led = requests.get(f"{BASE_URL}/api/creditcards/{cid}/ledger", headers=h)
    assert led.status_code == 200, led.text
    stm = requests.get(f"{BASE_URL}/api/creditcards/{cid}/statement", headers=h)
    assert stm.status_code == 200, stm.text
    assert "closing_balance" in stm.json() or "closing" in str(stm.json())

    # accounting unchanged: residual outstanding still counted, gap constant
    s1, gap1 = snap(h)
    assert gap1 == gap0, f"gap changed on close {gap0}->{gap1}"
    assert s1["total_paisa"] == s0["total_paisa"]
    assert s1["total_profit"] == s0["total_profit"]
    assert s1["credit_card_outstanding"] == s0["credit_card_outstanding"], \
        "closed card residual outstanding dropped out of total outstanding"
    # limit/available/reminders exclude the closed card
    assert round(s0["credit_limit_total"] - s1["credit_limit_total"], 2) == 50000, \
        f"limit delta {s0['credit_limit_total']}->{s1['credit_limit_total']}"
    assert round(s0["available_credit_limit"] - s1["available_credit_limit"], 2) == 38000
    assert cid not in [d["card_id"] for d in s1["due_reminders"]], \
        "closed card still in due_reminders"

    # ---- REOPEN
    r = requests.patch(f"{BASE_URL}/api/creditcards/{cid}/close", headers=h)
    assert r.status_code == 200
    assert r.json().get("closed") is False
    assert get_card(h, cid, active=True) is not None, "reopened card not back in active list"
    c2 = get_card(h, cid)
    assert c2["status"] != "closed"
    s2, gap2 = snap(h)
    assert gap2 == gap0
    assert s2["credit_limit_total"] == s0["credit_limit_total"]
    assert cid in [d["card_id"] for d in s2["due_reminders"]], \
        "reopened card missing from due_reminders"

    # leave it closed for cleanliness
    requests.patch(f"{BASE_URL}/api/creditcards/{cid}/close", headers=h)


def test_close_unknown_card_404(h):
    r = requests.patch(f"{BASE_URL}/api/creditcards/does-not-exist/close", headers=h)
    assert r.status_code == 404, r.status_code


def test_creditcards_active_flag_semantics(h):
    all_cards = requests.get(f"{BASE_URL}/api/creditcards", headers=h).json()
    active = requests.get(f"{BASE_URL}/api/creditcards?active=true", headers=h).json()
    assert all(c["closed"] is False for c in active)
    assert len(active) <= len(all_cards)
    for c in all_cards:
        assert "_id" not in c
        assert "closed" in c and "status" in c and "available" in c


# --------------------------------------------------------------- (2) settings / branding
def test_settings_get_put_roundtrip(h):
    original = requests.get(f"{BASE_URL}/api/settings", headers=h)
    assert original.status_code == 200, original.text
    orig = original.json()
    assert "business_name" in orig and "logo_url" in orig
    assert "_id" not in orig

    r = requests.put(f"{BASE_URL}/api/settings", headers=h,
                     json={"business_name": "QATEST Mobiles", "logo_url": ""})
    assert r.status_code == 200, r.text
    assert r.json()["business_name"] == "QATEST Mobiles"

    g = requests.get(f"{BASE_URL}/api/settings", headers=h).json()
    assert g["business_name"] == "QATEST Mobiles"
    assert g["logo_url"] == ""
    assert "_id" not in g

    # bad/blank logo url must not break the endpoint
    r = requests.put(f"{BASE_URL}/api/settings", headers=h,
                     json={"business_name": "QATEST Mobiles", "logo_url": "not-a-url"})
    assert r.status_code == 200
    assert requests.get(f"{BASE_URL}/api/settings", headers=h).json()["logo_url"] == "not-a-url"

    # restore
    requests.put(f"{BASE_URL}/api/settings", headers=h,
                 json={"business_name": orig.get("business_name", ""),
                       "logo_url": orig.get("logo_url", "")})


def test_settings_requires_auth():
    r = requests.get(f"{BASE_URL}/api/settings")
    assert r.status_code in (401, 403), r.status_code
    r = requests.put(f"{BASE_URL}/api/settings", json={"business_name": "hack"})
    assert r.status_code in (401, 403), r.status_code


# --------------------------------------------------------------- (3) date persistence
def test_dates_stored_without_shift(h):
    d = "2026-03-01"
    acc = requests.post(f"{BASE_URL}/api/accounts", headers=h,
                        json={"type": "bank", "name": f"{TAG}_DateBank",
                              "opening_balance": 0}).json()
    requests.post(f"{BASE_URL}/api/accounts/{acc['id']}/adjust", headers=h,
                  json={"new_balance": 60000, "reason": "seed"})
    card = requests.post(f"{BASE_URL}/api/creditcards", headers=h,
                         json={"name": f"{TAG}_DateCard", "limit": 60000,
                               "statement_date": d, "due_date": "2026-03-15"}).json()
    assert card["statement_date"] == d
    assert card["due_date"] == "2026-03-15"

    # stock purchase date
    item = requests.post(f"{BASE_URL}/api/stock", headers=h,
                         json={"mobile_model": f"{TAG}_DatePhone", "purchase_price": 5000,
                               "payment_method": "credit_card", "card_id": card["id"],
                               "date": d}).json()
    assert item["date"][:10] == d, item["date"]

    # retail sale date
    sale = requests.post(f"{BASE_URL}/api/retail/sales", headers=h,
                         json={"mobile_model": f"{TAG}_DatePhone", "cost_price": 5000,
                               "stock_item_id": item["id"], "sale_price": 7000,
                               "account_id": acc["id"], "date": d})
    assert sale.status_code == 200, sale.text
    assert sale.json()["date"][:10] == d

    # card txn date
    t = requests.post(f"{BASE_URL}/api/creditcards/{card['id']}/transactions", headers=h,
                      json={"kind": "payment", "amount": 1000,
                            "account_id": acc["id"], "date": d})
    assert t.status_code == 200, t.text
    txns = requests.get(f"{BASE_URL}/api/creditcards/{card['id']}/transactions",
                        headers=h).json()
    assert all(x["date"][:10] == d for x in txns), [x["date"] for x in txns]

    # poonji date
    p = requests.post(f"{BASE_URL}/api/poonji", headers=h,
                      json={"amount": 100, "description": f"{TAG} poonji", "date": d})
    assert p.status_code == 200, p.text
    assert p.json()["date"][:10] == d
    requests.delete(f"{BASE_URL}/api/poonji/{p.json()['id']}", headers=h)


# --------------------------------------------------------------- (4) regression
def test_regression_purchase_sale_paybill_gap_invariant(h):
    acc = requests.post(f"{BASE_URL}/api/accounts", headers=h,
                        json={"type": "bank", "name": f"{TAG}_RegBank",
                              "opening_balance": 0}).json()
    requests.post(f"{BASE_URL}/api/accounts/{acc['id']}/adjust", headers=h,
                  json={"new_balance": 50000, "reason": "seed"})
    card = requests.post(f"{BASE_URL}/api/creditcards", headers=h,
                         json={"name": f"{TAG}_Reg", "limit": 40000}).json()
    cid, aid = card["id"], acc["id"]
    s0, gap0 = snap(h)

    # purchase on card: outstanding up, available down, paisa unchanged
    item = requests.post(f"{BASE_URL}/api/stock", headers=h,
                         json={"mobile_model": f"{TAG}_RegPhone", "purchase_price": 12000,
                               "payment_method": "credit_card", "card_id": cid,
                               "date": "2026-07-01"}).json()
    c = get_card(h, cid)
    assert c["outstanding"] == 12000 and c["available"] == 28000
    s1, gap1 = snap(h)
    assert s1["total_paisa"] == s0["total_paisa"]
    assert gap1 == gap0, f"{gap0}->{gap1}"

    # retail sale: account credited FULL sale amount, profit up, stock down
    sale = requests.post(f"{BASE_URL}/api/retail/sales", headers=h,
                         json={"mobile_model": f"{TAG}_RegPhone", "cost_price": 12000,
                               "stock_item_id": item["id"], "sale_price": 15000,
                               "account_id": aid, "date": "2026-07-02"})
    assert sale.status_code == 200, sale.text
    accs = requests.get(f"{BASE_URL}/api/accounts", headers=h).json()
    bal = [a for a in accs if a["id"] == aid][0]["current_balance"]
    assert bal == 65000, bal
    s2, gap2 = snap(h)
    assert round(s2["total_profit"] - s1["total_profit"], 2) == 3000
    assert round(s1["stock_value"] - s2["stock_value"], 2) == 12000
    assert gap2 == gap0, f"{gap0}->{gap2}"

    # partial pay bill
    r = requests.post(f"{BASE_URL}/api/creditcards/{cid}/transactions", headers=h,
                      json={"kind": "payment", "amount": 5000, "account_id": aid,
                            "date": "2026-07-03"})
    assert r.status_code == 200, r.text
    c = get_card(h, cid)
    assert c["outstanding"] == 7000
    s3, gap3 = snap(h)
    assert round(s2["total_paisa"] - s3["total_paisa"], 2) == 5000
    assert s3["total_profit"] == s2["total_profit"], "profit changed on bill payment"
    assert gap3 == gap0, f"{gap0}->{gap3}"

    # full payoff
    r = requests.post(f"{BASE_URL}/api/creditcards/{cid}/transactions", headers=h,
                      json={"kind": "payment", "amount": 7000, "account_id": aid,
                            "date": "2026-07-04"})
    assert r.status_code == 200, r.text
    c = get_card(h, cid)
    assert c["outstanding"] == 0 and c["status"] == "paid"
    s4, gap4 = snap(h)
    assert gap4 == gap0, f"{gap0}->{gap4}"

    # close the paid card and confirm nothing moves
    requests.patch(f"{BASE_URL}/api/creditcards/{cid}/close", headers=h)
    s5, gap5 = snap(h)
    assert gap5 == gap0
    assert s5["total_paisa"] == s4["total_paisa"]


def test_statement_shape_for_closed_card(h):
    card = requests.post(f"{BASE_URL}/api/creditcards", headers=h,
                         json={"name": f"{TAG}_StmClosed", "limit": 20000,
                               "statement_date": "2026-07-05",
                               "due_date": "2026-07-20"}).json()
    cid = card["id"]
    requests.post(f"{BASE_URL}/api/creditcards/{cid}/transactions", headers=h,
                  json={"kind": "spend", "amount": 3000, "category": "expense",
                        "date": "2026-07-06"})
    requests.patch(f"{BASE_URL}/api/creditcards/{cid}/close", headers=h)
    stm = requests.get(f"{BASE_URL}/api/creditcards/{cid}/statement", headers=h)
    assert stm.status_code == 200, stm.text
    js = stm.json()
    print("statement keys:", list(js.keys()))
    assert "rows" in js or "transactions" in js or "items" in js, js
