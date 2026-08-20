from dotenv import load_dotenv
from pathlib import Path
import os

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Query
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Literal, Annotated, Any
from datetime import datetime, timezone, timedelta
from bson import ObjectId
import logging
import uuid
import bcrypt
import jwt

# ---------------------------------------------------------------------------
# DB
# ---------------------------------------------------------------------------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGORITHM = "HS256"

app = FastAPI(title="Mobile Business Tracker")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id() -> str:
    return str(uuid.uuid4())


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def get_current_user(request: Request) -> dict:
    auth_header = request.headers.get("Authorization", "")
    token = auth_header[7:] if auth_header.startswith("Bearer ") else None
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"id": payload["sub"]})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        user.pop("password_hash", None)
        user.pop("_id", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class LoginInput(BaseModel):
    email: EmailStr
    password: str


class SetupInput(BaseModel):
    email: EmailStr
    password: str
    name: Optional[str] = None


class AccountCreate(BaseModel):
    type: Literal["cash", "bank", "upi"]
    name: str
    bank_name: Optional[str] = None
    last4: Optional[str] = None
    opening_balance: float = 0.0
    notes: Optional[str] = None
    allow_negative: bool = False


class AccountUpdate(BaseModel):
    name: Optional[str] = None
    bank_name: Optional[str] = None
    last4: Optional[str] = None
    notes: Optional[str] = None
    allow_negative: Optional[bool] = None


class AdjustInput(BaseModel):
    new_balance: float
    reason: str


class TransferInput(BaseModel):
    source_account_id: str
    dest_account_id: str
    amount: float
    date: Optional[str] = None
    notes: Optional[str] = None


class RetailSaleInput(BaseModel):
    mobile_model: str
    imei: Optional[str] = None
    sale_price: float
    cost_price: float
    account_id: str
    stock_item_id: Optional[str] = None
    date: Optional[str] = None
    notes: Optional[str] = None


class StockCreate(BaseModel):
    mobile_model: str
    imei: Optional[str] = None
    purchase_price: float
    date: Optional[str] = None
    notes: Optional[str] = None
    payment_method: Optional[Literal["account", "credit_card", "poonji", "none"]] = "none"
    account_id: Optional[str] = None
    card_id: Optional[str] = None


class WholesaleCustomerCreate(BaseModel):
    name: str
    phone: Optional[str] = None
    notes: Optional[str] = None


class WholesaleSupplyCreate(BaseModel):
    customer_id: str
    description: str
    amount: float
    cost: float = 0.0
    date: Optional[str] = None


class WholesalePaymentInput(BaseModel):
    customer_id: str
    amount: float
    account_id: str
    date: Optional[str] = None
    notes: Optional[str] = None


class CreditCardCreate(BaseModel):
    name: str
    bank_name: Optional[str] = None
    last4: Optional[str] = None
    limit: float = 0.0
    opening_outstanding: float = 0.0
    statement_date: Optional[str] = None
    due_date: Optional[str] = None
    min_due: float = 0.0
    allow_over_limit: bool = False
    notes: Optional[str] = None


class CreditCardUpdate(BaseModel):
    name: Optional[str] = None
    bank_name: Optional[str] = None
    last4: Optional[str] = None
    limit: Optional[float] = None
    statement_date: Optional[str] = None
    due_date: Optional[str] = None
    min_due: Optional[float] = None
    allow_over_limit: Optional[bool] = None
    notes: Optional[str] = None


class CreditCardTxnInput(BaseModel):
    kind: Literal["spend", "payment", "refund"]
    amount: float
    account_id: Optional[str] = None  # required for payment
    description: Optional[str] = None
    date: Optional[str] = None


class PoonjiCreate(BaseModel):
    amount: float
    description: str
    date: Optional[str] = None


# ---------------------------------------------------------------------------
# Core money movement
# ---------------------------------------------------------------------------
async def record_transaction(account_id, txn_type, description, amount, direction,
                             source_account_id=None, dest_account_id=None,
                             reference_id=None, date=None, enforce_positive=True):
    """direction: 'credit' increases balance, 'debit' decreases balance."""
    account = await db.accounts.find_one({"id": account_id})
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    delta = amount if direction == "credit" else -amount
    new_balance = round(account["current_balance"] + delta, 2)

    if direction == "debit" and enforce_positive and not account.get("allow_negative", False):
        if new_balance < -0.001:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient balance in {account['name']}. This account does not allow negative balances.",
            )

    txn = {
        "id": new_id(),
        "account_id": account_id,
        "date": date or now_iso(),
        "txn_type": txn_type,
        "description": description,
        "amount": round(amount, 2),
        "direction": direction,
        "source_account_id": source_account_id,
        "dest_account_id": dest_account_id,
        "reference_id": reference_id,
        "balance_after": new_balance,
        "created_at": now_iso(),
    }
    await db.transactions.insert_one(txn)
    await db.accounts.update_one({"id": account_id}, {"$set": {"current_balance": new_balance}})
    txn.pop("_id", None)
    return txn


def clean(doc: dict) -> dict:
    if doc:
        doc.pop("_id", None)
    return doc


# ---------------------------------------------------------------------------
# Auth routes
# ---------------------------------------------------------------------------
@api_router.get("/auth/setup-status")
async def setup_status():
    count = await db.users.count_documents({})
    return {"needs_setup": count == 0}


@api_router.post("/auth/setup")
async def setup_owner(data: SetupInput):
    count = await db.users.count_documents({})
    if count > 0:
        raise HTTPException(status_code=409, detail="Owner account already exists. Please sign in.")
    if len(data.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters long")
    email = data.email.lower()
    user = {
        "id": new_id(),
        "email": email,
        "password_hash": hash_password(data.password),
        "name": (data.name or "").strip() or "Owner",
        "role": "owner",
        "created_at": now_iso(),
    }
    await db.users.insert_one(user)
    token = create_access_token(user["id"], user["email"])
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {"id": user["id"], "email": user["email"], "name": user["name"]},
    }


@api_router.post("/auth/login")
async def login(data: LoginInput):
    email = data.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token(user["id"], user["email"])
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {"id": user["id"], "email": user["email"], "name": user.get("name", "Owner")},
    }


@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return {"id": user["id"], "email": user["email"], "name": user.get("name", "Owner")}


@api_router.post("/auth/logout")
async def logout(user: dict = Depends(get_current_user)):
    return {"success": True}


# ---------------------------------------------------------------------------
# Accounts
# ---------------------------------------------------------------------------
@api_router.get("/accounts")
async def list_accounts(active: Optional[bool] = None, user: dict = Depends(get_current_user)):
    query = {}
    if active is not None:
        query["active"] = active
    accounts = await db.accounts.find(query).sort("created_at", 1).to_list(1000)
    return [clean(a) for a in accounts]


@api_router.post("/accounts")
async def create_account(data: AccountCreate, user: dict = Depends(get_current_user)):
    acc = {
        "id": new_id(),
        "type": data.type,
        "name": data.name,
        "bank_name": data.bank_name,
        "last4": data.last4,
        "opening_balance": round(data.opening_balance, 2),
        "current_balance": 0.0,
        "notes": data.notes,
        "allow_negative": data.allow_negative,
        "active": True,
        "created_at": now_iso(),
    }
    await db.accounts.insert_one(acc)
    if data.opening_balance and data.opening_balance != 0:
        await record_transaction(
            acc["id"], "opening", "Opening balance", abs(data.opening_balance),
            "credit" if data.opening_balance > 0 else "debit",
            enforce_positive=False,
        )
    result = await db.accounts.find_one({"id": acc["id"]})
    return clean(result)


@api_router.put("/accounts/{account_id}")
async def update_account(account_id: str, data: AccountUpdate, user: dict = Depends(get_current_user)):
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    res = await db.accounts.update_one({"id": account_id}, {"$set": updates})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Account not found")
    return clean(await db.accounts.find_one({"id": account_id}))


@api_router.patch("/accounts/{account_id}/status")
async def toggle_account_status(account_id: str, user: dict = Depends(get_current_user)):
    acc = await db.accounts.find_one({"id": account_id})
    if not acc:
        raise HTTPException(status_code=404, detail="Account not found")
    new_status = not acc.get("active", True)
    await db.accounts.update_one({"id": account_id}, {"$set": {"active": new_status}})
    return clean(await db.accounts.find_one({"id": account_id}))


@api_router.post("/accounts/{account_id}/adjust")
async def adjust_account(account_id: str, data: AdjustInput, user: dict = Depends(get_current_user)):
    acc = await db.accounts.find_one({"id": account_id})
    if not acc:
        raise HTTPException(status_code=404, detail="Account not found")
    delta = round(data.new_balance - acc["current_balance"], 2)
    if delta == 0:
        return clean(acc)
    await record_transaction(
        account_id, "adjustment", f"Manual adjustment: {data.reason}",
        abs(delta), "credit" if delta > 0 else "debit", enforce_positive=False,
    )
    return clean(await db.accounts.find_one({"id": account_id}))


@api_router.get("/accounts/{account_id}/ledger")
async def account_ledger(account_id: str, from_date: Optional[str] = None,
                         to_date: Optional[str] = None, txn_type: Optional[str] = None,
                         user: dict = Depends(get_current_user)):
    acc = await db.accounts.find_one({"id": account_id})
    if not acc:
        raise HTTPException(status_code=404, detail="Account not found")
    # fetch all txns ascending to compute running balance, then filter
    all_txns = await db.transactions.find({"account_id": account_id}).sort("created_at", 1).to_list(10000)
    running = 0.0
    for t in all_txns:
        running = round(running + (t["amount"] if t["direction"] == "credit" else -t["amount"]), 2)
        t["running_balance"] = running
        t.pop("_id", None)
    # apply filters
    filtered = []
    for t in all_txns:
        if txn_type and t["txn_type"] != txn_type:
            continue
        if from_date and t["date"][:10] < from_date:
            continue
        if to_date and t["date"][:10] > to_date:
            continue
        filtered.append(t)
    filtered.reverse()
    return {"account": clean(acc), "transactions": filtered}


# ---------------------------------------------------------------------------
# Transfers
# ---------------------------------------------------------------------------
@api_router.post("/transfers")
async def create_transfer(data: TransferInput, user: dict = Depends(get_current_user)):
    if data.source_account_id == data.dest_account_id:
        raise HTTPException(status_code=400, detail="Source and destination must be different")
    if data.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")
    src = await db.accounts.find_one({"id": data.source_account_id})
    dst = await db.accounts.find_one({"id": data.dest_account_id})
    if not src or not dst:
        raise HTTPException(status_code=404, detail="Account not found")
    ref = new_id()
    date = data.date or now_iso()
    desc = f"Transfer {src['name']} → {dst['name']}"
    # debit source first (enforces balance)
    await record_transaction(
        data.source_account_id, "transfer_out", desc + (f" — {data.notes}" if data.notes else ""),
        data.amount, "debit", source_account_id=data.source_account_id,
        dest_account_id=data.dest_account_id, reference_id=ref, date=date,
    )
    await record_transaction(
        data.dest_account_id, "transfer_in", desc + (f" — {data.notes}" if data.notes else ""),
        data.amount, "credit", source_account_id=data.source_account_id,
        dest_account_id=data.dest_account_id, reference_id=ref, date=date,
    )
    return {"success": True, "reference_id": ref}


@api_router.get("/transfers")
async def list_transfers(user: dict = Depends(get_current_user)):
    txns = await db.transactions.find({"txn_type": "transfer_out"}).sort("created_at", -1).to_list(1000)
    return [clean(t) for t in txns]


# ---------------------------------------------------------------------------
# Retail Sales
# ---------------------------------------------------------------------------
@api_router.get("/retail/sales")
async def list_sales(user: dict = Depends(get_current_user)):
    sales = await db.sales.find({}).sort("created_at", -1).to_list(2000)
    accounts = {a["id"]: a["name"] for a in await db.accounts.find({}).to_list(1000)}
    for s in sales:
        s.pop("_id", None)
        s["account_name"] = accounts.get(s.get("account_id"), "—")
    return sales


@api_router.post("/retail/sales")
async def create_sale(data: RetailSaleInput, user: dict = Depends(get_current_user)):
    acc = await db.accounts.find_one({"id": data.account_id})
    if not acc:
        raise HTTPException(status_code=404, detail="Payment account not found")
    profit = round(data.sale_price - data.cost_price, 2)
    sale = {
        "id": new_id(),
        "mobile_model": data.mobile_model,
        "imei": data.imei,
        "sale_price": round(data.sale_price, 2),
        "cost_price": round(data.cost_price, 2),
        "profit": profit,
        "account_id": data.account_id,
        "stock_item_id": data.stock_item_id,
        "date": data.date or now_iso(),
        "notes": data.notes,
        "created_at": now_iso(),
    }
    await db.sales.insert_one(sale)
    if data.stock_item_id:
        await db.stock.update_one(
            {"id": data.stock_item_id},
            {"$set": {"status": "sold", "sale_id": sale["id"]}},
        )
    imei_str = f" (IMEI {data.imei})" if data.imei else ""
    await record_transaction(
        data.account_id, "retail_sale", f"Retail sale: {data.mobile_model}{imei_str}",
        data.sale_price, "credit", reference_id=sale["id"], date=sale["date"],
    )
    return clean(await db.sales.find_one({"id": sale["id"]}))


# ---------------------------------------------------------------------------
# Stock
# ---------------------------------------------------------------------------
@api_router.get("/stock")
async def list_stock(status: Optional[str] = None, user: dict = Depends(get_current_user)):
    query = {}
    if status:
        query["status"] = status
    items = await db.stock.find(query).sort("created_at", -1).to_list(5000)
    return [clean(i) for i in items]


@api_router.post("/stock")
async def create_stock(data: StockCreate, user: dict = Depends(get_current_user)):
    amount = round(data.purchase_price, 2)
    pm = data.payment_method or "none"
    item = {
        "id": new_id(),
        "mobile_model": data.mobile_model,
        "imei": data.imei,
        "purchase_price": amount,
        "status": "in_stock",
        "sale_id": None,
        "payment_method": pm,
        "account_id": data.account_id if pm == "account" else None,
        "card_id": data.card_id if pm == "credit_card" else None,
        "poonji_id": None,
        "date": data.date or now_iso(),
        "notes": data.notes,
        "created_at": now_iso(),
    }
    label = f"Stock purchase: {data.mobile_model}" + (f" (IMEI {data.imei})" if data.imei else "")

    if pm == "account":
        if not data.account_id:
            raise HTTPException(status_code=400, detail="Select an account for this purchase")
        # Debits Cash/Bank/UPI (Paisa decreases). Raises if insufficient balance.
        await record_transaction(
            data.account_id, "purchase", label, amount, "debit",
            reference_id=item["id"], date=item["date"],
        )
    elif pm == "credit_card":
        if not data.card_id:
            raise HTTPException(status_code=400, detail="Select a credit card for this purchase")
        card = await db.credit_cards.find_one({"id": data.card_id})
        if not card:
            raise HTTPException(status_code=404, detail="Credit card not found")
        if card.get("closed"):
            raise HTTPException(status_code=400, detail="This card is closed. Reopen it before using it for a purchase.")
        available = round(card.get("limit", 0) - card["outstanding"], 2)
        if not card.get("allow_over_limit", False) and amount > available:
            raise HTTPException(status_code=400, detail=f"Purchase exceeds available credit limit (₹{available:.0f}). Enable over-limit for this card to allow it.")
        new_out = round(card["outstanding"] + amount, 2)
        await db.credit_card_txns.insert_one({
            "id": new_id(), "card_id": data.card_id, "kind": "spend",
            "amount": amount, "account_id": None, "description": label,
            "category": "purchase",
            "date": item["date"], "outstanding_after": new_out, "created_at": now_iso(),
        })
        # Increases this card's outstanding; Cash/Bank/UPI/Paisa unchanged.
        await db.credit_cards.update_one({"id": data.card_id}, {"$set": {"outstanding": new_out}})
    elif pm == "poonji":
        pid = new_id()
        await db.poonji.insert_one({
            "id": pid, "amount": amount, "description": label,
            "date": item["date"], "created_at": now_iso(),
        })
        item["poonji_id"] = pid

    await db.stock.insert_one(item)
    return clean(await db.stock.find_one({"id": item["id"]}))


@api_router.delete("/stock/{item_id}")
async def delete_stock(item_id: str, user: dict = Depends(get_current_user)):
    item = await db.stock.find_one({"id": item_id})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    if item.get("status") == "sold":
        raise HTTPException(status_code=400, detail="Cannot delete a sold item")
    if item.get("payment_method") not in (None, "none"):
        raise HTTPException(
            status_code=400,
            detail="Cannot delete a purchase that has a recorded payment — it would break the audit ledger.",
        )
    await db.stock.delete_one({"id": item_id})
    return {"success": True}


# ---------------------------------------------------------------------------
# Wholesale
# ---------------------------------------------------------------------------
async def customer_outstanding(customer_id: str) -> float:
    supplies = await db.wholesale_supplies.find({"customer_id": customer_id}).to_list(5000)
    payments = await db.wholesale_payments.find({"customer_id": customer_id}).to_list(5000)
    total_supply = sum(s["amount"] for s in supplies)
    total_paid = sum(p["amount"] for p in payments)
    return round(total_supply - total_paid, 2)


@api_router.get("/wholesale/customers")
async def list_customers(user: dict = Depends(get_current_user)):
    customers = await db.wholesale_customers.find({}).sort("created_at", -1).to_list(2000)
    result = []
    for c in customers:
        c.pop("_id", None)
        c["outstanding"] = await customer_outstanding(c["id"])
        result.append(c)
    return result


@api_router.post("/wholesale/customers")
async def create_customer(data: WholesaleCustomerCreate, user: dict = Depends(get_current_user)):
    c = {"id": new_id(), "name": data.name, "phone": data.phone,
         "notes": data.notes, "created_at": now_iso()}
    await db.wholesale_customers.insert_one(c)
    c["outstanding"] = 0.0
    return clean(c)


@api_router.get("/wholesale/supplies")
async def list_supplies(customer_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    query = {"customer_id": customer_id} if customer_id else {}
    supplies = await db.wholesale_supplies.find(query).sort("created_at", -1).to_list(5000)
    names = {c["id"]: c["name"] for c in await db.wholesale_customers.find({}).to_list(2000)}
    for s in supplies:
        s.pop("_id", None)
        s["customer_name"] = names.get(s["customer_id"], "—")
    return supplies


@api_router.post("/wholesale/supplies")
async def create_supply(data: WholesaleSupplyCreate, user: dict = Depends(get_current_user)):
    cust = await db.wholesale_customers.find_one({"id": data.customer_id})
    if not cust:
        raise HTTPException(status_code=404, detail="Customer not found")
    s = {
        "id": new_id(),
        "customer_id": data.customer_id,
        "description": data.description,
        "amount": round(data.amount, 2),
        "cost": round(data.cost, 2),
        "profit": round(data.amount - data.cost, 2),
        "date": data.date or now_iso(),
        "created_at": now_iso(),
    }
    await db.wholesale_supplies.insert_one(s)
    return clean(await db.wholesale_supplies.find_one({"id": s["id"]}))


@api_router.get("/wholesale/payments")
async def list_wholesale_payments(user: dict = Depends(get_current_user)):
    payments = await db.wholesale_payments.find({}).sort("created_at", -1).to_list(5000)
    names = {c["id"]: c["name"] for c in await db.wholesale_customers.find({}).to_list(2000)}
    accs = {a["id"]: a["name"] for a in await db.accounts.find({}).to_list(1000)}
    for p in payments:
        p.pop("_id", None)
        p["customer_name"] = names.get(p["customer_id"], "—")
        p["account_name"] = accs.get(p["account_id"], "—")
    return payments


@api_router.post("/wholesale/payments")
async def create_wholesale_payment(data: WholesalePaymentInput, user: dict = Depends(get_current_user)):
    cust = await db.wholesale_customers.find_one({"id": data.customer_id})
    if not cust:
        raise HTTPException(status_code=404, detail="Customer not found")
    acc = await db.accounts.find_one({"id": data.account_id})
    if not acc:
        raise HTTPException(status_code=404, detail="Account not found")
    if data.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")
    p = {
        "id": new_id(),
        "customer_id": data.customer_id,
        "amount": round(data.amount, 2),
        "account_id": data.account_id,
        "date": data.date or now_iso(),
        "notes": data.notes,
        "created_at": now_iso(),
    }
    await db.wholesale_payments.insert_one(p)
    await record_transaction(
        data.account_id, "wholesale_payment",
        f"Wholesale payment from {cust['name']}", data.amount, "credit",
        reference_id=p["id"], date=p["date"],
    )
    return clean(await db.wholesale_payments.find_one({"id": p["id"]}))


# ---------------------------------------------------------------------------
# Credit Cards
# ---------------------------------------------------------------------------
@api_router.get("/creditcards")
async def list_cards(active: Optional[bool] = None, user: dict = Depends(get_current_user)):
    query = {}
    if active is True:
        query = {"closed": {"$ne": True}}
    cards = await db.credit_cards.find(query).sort("created_at", -1).to_list(1000)
    txns = await db.credit_card_txns.find({}).to_list(50000)
    paid_by = {}
    for t in txns:
        if t["kind"] in ("payment", "refund"):
            paid_by[t["card_id"]] = paid_by.get(t["card_id"], 0) + t["amount"]
    today = datetime.now(timezone.utc).date().isoformat()
    out = []
    for c in cards:
        c.pop("_id", None)
        c["closed"] = bool(c.get("closed", False))
        o = c.get("outstanding", 0)
        c["available"] = round(c.get("limit", 0) - o, 2)
        paid = paid_by.get(c["id"], 0)
        due = c.get("due_date")
        if c["closed"]:
            status = "closed"
        elif o <= 0.001:
            status = "paid"
        elif due and due < today:
            status = "overdue"
        elif paid > 0:
            status = "partially_paid"
        else:
            status = "due"
        c["status"] = status
        c["total_paid"] = round(paid, 2)
        out.append(c)
    return out


@api_router.patch("/creditcards/{card_id}/close")
async def toggle_card_close(card_id: str, user: dict = Depends(get_current_user)):
    card = await db.credit_cards.find_one({"id": card_id})
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    new_closed = not bool(card.get("closed", False))
    await db.credit_cards.update_one({"id": card_id}, {"$set": {"closed": new_closed}})
    return clean(await db.credit_cards.find_one({"id": card_id}))


@api_router.post("/creditcards")
async def create_card(data: CreditCardCreate, user: dict = Depends(get_current_user)):
    card = {
        "id": new_id(),
        "name": data.name,
        "bank_name": data.bank_name,
        "last4": (data.last4 or "")[-4:] or None,
        "limit": round(data.limit, 2),
        "outstanding": 0.0,
        "statement_date": data.statement_date,
        "due_date": data.due_date,
        "min_due": round(data.min_due, 2),
        "allow_over_limit": data.allow_over_limit,
        "notes": data.notes,
        "created_at": now_iso(),
    }
    await db.credit_cards.insert_one(card)
    if data.opening_outstanding and data.opening_outstanding > 0:
        amt = round(data.opening_outstanding, 2)
        await db.credit_card_txns.insert_one({
            "id": new_id(), "card_id": card["id"], "kind": "spend",
            "amount": amt, "account_id": None, "description": "Opening outstanding",
            "category": "expense", "date": now_iso(), "outstanding_after": amt,
            "created_at": now_iso(),
        })
        await db.credit_cards.update_one({"id": card["id"]}, {"$set": {"outstanding": amt}})
    return clean(await db.credit_cards.find_one({"id": card["id"]}))


@api_router.put("/creditcards/{card_id}")
async def update_card(card_id: str, data: CreditCardUpdate, user: dict = Depends(get_current_user)):
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    if "last4" in updates:
        updates["last4"] = (updates["last4"] or "")[-4:] or None
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    res = await db.credit_cards.update_one({"id": card_id}, {"$set": updates})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Card not found")
    return clean(await db.credit_cards.find_one({"id": card_id}))


@api_router.get("/creditcards/{card_id}/transactions")
async def card_transactions(card_id: str, user: dict = Depends(get_current_user)):
    txns = await db.credit_card_txns.find({"card_id": card_id}).sort("created_at", -1).to_list(5000)
    accs = {a["id"]: a["name"] for a in await db.accounts.find({}).to_list(1000)}
    for t in txns:
        t.pop("_id", None)
        t["account_name"] = accs.get(t.get("account_id"), None)
    return txns


@api_router.get("/creditcards/{card_id}/ledger")
async def card_ledger(card_id: str, from_date: Optional[str] = None,
                      to_date: Optional[str] = None, kind: Optional[str] = None,
                      user: dict = Depends(get_current_user)):
    card = await db.credit_cards.find_one({"id": card_id})
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    all_txns = await db.credit_card_txns.find({"card_id": card_id}).sort("created_at", 1).to_list(10000)
    accs = {a["id"]: a["name"] for a in await db.accounts.find({}).to_list(1000)}
    running = 0.0
    for t in all_txns:
        running = round(running + (t["amount"] if t["kind"] == "spend" else -t["amount"]), 2)
        t["running_outstanding"] = running
        t["account_name"] = accs.get(t.get("account_id"))
        t.pop("_id", None)
    filtered = []
    for t in all_txns:
        if kind and t["kind"] != kind:
            continue
        if from_date and t["date"][:10] < from_date:
            continue
        if to_date and t["date"][:10] > to_date:
            continue
        filtered.append(t)
    filtered.reverse()
    return {"card": clean(card), "transactions": filtered}


@api_router.post("/creditcards/{card_id}/transactions")
async def add_card_txn(card_id: str, data: CreditCardTxnInput, user: dict = Depends(get_current_user)):
    card = await db.credit_cards.find_one({"id": card_id})
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    if card.get("closed"):
        raise HTTPException(status_code=400, detail="This card is closed. Reopen it before adding transactions.")
    if data.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")
    if data.kind == "payment" and not data.account_id:
        raise HTTPException(status_code=400, detail="Payment requires a paying account")

    outstanding = card["outstanding"]
    if data.kind == "spend":
        available = round(card.get("limit", 0) - outstanding, 2)
        if not card.get("allow_over_limit", False) and data.amount > available:
            raise HTTPException(status_code=400, detail=f"Spend exceeds available credit limit (₹{available:.0f}). Enable over-limit to allow it.")
        new_out = round(outstanding + data.amount, 2)
    else:  # payment or refund both reduce outstanding
        if data.kind == "payment" and data.amount > outstanding + 0.001:
            raise HTTPException(status_code=400, detail=f"Payment (₹{data.amount:.0f}) cannot exceed the outstanding balance (₹{outstanding:.0f}). Use a credit/refund to record an over-payment.")
        new_out = round(outstanding - data.amount, 2)

    category = {"spend": "expense", "payment": "payment", "refund": "refund"}[data.kind]
    txn = {
        "id": new_id(),
        "card_id": card_id,
        "kind": data.kind,
        "amount": round(data.amount, 2),
        "account_id": data.account_id if data.kind == "payment" else None,
        "description": data.description,
        "category": category,
        "date": data.date or now_iso(),
        "outstanding_after": new_out,
        "created_at": now_iso(),
    }
    if data.kind == "payment":
        await record_transaction(
            data.account_id, "cc_payment",
            f"Credit card payment: {card['name']}", data.amount, "debit",
            reference_id=txn["id"], date=txn["date"],
        )
    await db.credit_card_txns.insert_one(txn)
    await db.credit_cards.update_one({"id": card_id}, {"$set": {"outstanding": new_out}})
    return clean(await db.credit_cards.find_one({"id": card_id}))


@api_router.delete("/creditcards/{card_id}/transactions/{txn_id}")
async def reverse_card_txn(card_id: str, txn_id: str, user: dict = Depends(get_current_user)):
    card = await db.credit_cards.find_one({"id": card_id})
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    txn = await db.credit_card_txns.find_one({"id": txn_id, "card_id": card_id})
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if txn.get("category") == "purchase":
        raise HTTPException(status_code=400, detail="This charge is linked to a stock purchase. Reverse it from the Purchases/Stock page.")
    amt = txn["amount"]
    if txn["kind"] == "spend":
        new_out = round(card["outstanding"] - amt, 2)
    else:  # payment or refund reduced outstanding, so reversing adds it back
        new_out = round(card["outstanding"] + amt, 2)
    # reverse any linked account movement (credit-card bill payment)
    if txn["kind"] == "payment":
        acc_txns = await db.transactions.find({"reference_id": txn_id}).to_list(100)
        for at in acc_txns:
            acc = await db.accounts.find_one({"id": at["account_id"]})
            if acc:
                delta = at["amount"] if at["direction"] == "debit" else -at["amount"]
                await db.accounts.update_one({"id": acc["id"]}, {"$set": {"current_balance": round(acc["current_balance"] + delta, 2)}})
            await db.transactions.delete_one({"id": at["id"]})
    await db.credit_card_txns.delete_one({"id": txn_id})
    await db.credit_cards.update_one({"id": card_id}, {"$set": {"outstanding": new_out}})
    return {"success": True, "outstanding": new_out}


@api_router.get("/creditcards/{card_id}/statement")
async def card_statement(card_id: str, from_date: Optional[str] = None,
                         to_date: Optional[str] = None, user: dict = Depends(get_current_user)):
    card = await db.credit_cards.find_one({"id": card_id})
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    txns = await db.credit_card_txns.find({"card_id": card_id}).sort("created_at", 1).to_list(50000)
    accs = {a["id"]: a["name"] for a in await db.accounts.find({}).to_list(1000)}
    running = 0.0
    opening = None
    closing = None
    purchases = charges = payments = refunds = 0.0
    rows = []
    for t in txns:
        prev = running
        running = round(running + (t["amount"] if t["kind"] == "spend" else -t["amount"]), 2)
        day = t["date"][:10]
        if from_date and day < from_date:
            continue
        if to_date and day > to_date:
            continue
        if opening is None:
            opening = round(prev, 2)
        closing = running
        if t["kind"] == "spend":
            charges += t["amount"]
            if t.get("category") == "purchase":
                purchases += t["amount"]
        elif t["kind"] == "payment":
            payments += t["amount"]
        elif t["kind"] == "refund":
            refunds += t["amount"]
        t["running_outstanding"] = running
        t["account_name"] = accs.get(t.get("account_id"))
        t.pop("_id", None)
        rows.append(t)
    if opening is None:
        opening = round(running, 2)
    if closing is None:
        closing = opening
    rows.reverse()
    return {
        "card": clean(card),
        "opening_balance": opening,
        "purchases": round(purchases, 2),
        "charges": round(charges, 2),
        "payments": round(payments, 2),
        "refunds": round(refunds, 2),
        "closing_outstanding": closing,
        "available": round(card.get("limit", 0) - closing, 2),
        "transactions": rows,
    }


# ---------------------------------------------------------------------------
# Fixed Poonji (capital)  -- kept SEPARATE from Paisa
# ---------------------------------------------------------------------------
@api_router.get("/poonji")
async def list_poonji(user: dict = Depends(get_current_user)):
    entries = await db.poonji.find({}).sort("created_at", -1).to_list(2000)
    return [clean(e) for e in entries]


@api_router.post("/poonji")
async def create_poonji(data: PoonjiCreate, user: dict = Depends(get_current_user)):
    e = {"id": new_id(), "amount": round(data.amount, 2), "description": data.description,
         "date": data.date or now_iso(), "created_at": now_iso()}
    await db.poonji.insert_one(e)
    return clean(await db.poonji.find_one({"id": e["id"]}))


@api_router.delete("/poonji/{entry_id}")
async def delete_poonji(entry_id: str, user: dict = Depends(get_current_user)):
    res = await db.poonji.delete_one({"id": entry_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Entry not found")
    return {"success": True}


# ---------------------------------------------------------------------------
# Dashboard & Profit
# ---------------------------------------------------------------------------
@api_router.get("/dashboard/summary")
async def dashboard_summary(user: dict = Depends(get_current_user)):
    accounts = await db.accounts.find({"active": True}).to_list(1000)
    for a in accounts:
        a.pop("_id", None)
    total_paisa = round(sum(a["current_balance"] for a in accounts), 2)
    cash_balance = round(sum(a["current_balance"] for a in accounts if a["type"] == "cash"), 2)
    total_bank = round(sum(a["current_balance"] for a in accounts if a["type"] == "bank"), 2)
    total_upi = round(sum(a["current_balance"] for a in accounts if a["type"] == "upi"), 2)

    # receivables
    supplies = await db.wholesale_supplies.find({}).to_list(10000)
    payments = await db.wholesale_payments.find({}).to_list(10000)
    receivable = round(sum(s["amount"] for s in supplies) - sum(p["amount"] for p in payments), 2)

    # credit card
    cards = await db.credit_cards.find({}).to_list(1000)
    cc_outstanding = round(sum(c["outstanding"] for c in cards), 2)
    open_cards = [c for c in cards if not c.get("closed")]

    # poonji
    poonji_entries = await db.poonji.find({}).to_list(5000)
    fixed_poonji = round(sum(e["amount"] for e in poonji_entries), 2)

    # stock
    all_stock = await db.stock.find({}).to_list(20000)
    in_stock = [i for i in all_stock if i.get("status") == "in_stock"]
    stock_value = round(sum(i["purchase_price"] for i in in_stock), 2)
    total_purchase = round(sum(i["purchase_price"] for i in all_stock), 2)

    # credit limits
    credit_limit_total = round(sum(c.get("limit", 0) for c in open_cards), 2)
    available_credit_limit = round(sum((c.get("limit", 0) - c.get("outstanding", 0)) for c in open_cards), 2)
    credit_utilization = round((cc_outstanding / credit_limit_total * 100), 1) if credit_limit_total > 0 else 0.0
    upcoming_due_amount = round(sum((c.get("min_due", 0) or 0) for c in open_cards if c.get("outstanding", 0) > 0), 2)
    today_date = datetime.now(timezone.utc).date()
    due_reminders = []
    for c in open_cards:
        dd = c.get("due_date")
        if c.get("outstanding", 0) > 0 and dd:
            try:
                d = datetime.strptime(dd[:10], "%Y-%m-%d").date()
            except Exception:
                continue
            days_left = (d - today_date).days
            if days_left <= 7:
                due_reminders.append({
                    "card_id": c["id"], "name": c["name"], "due_date": dd,
                    "min_due": c.get("min_due", 0), "outstanding": c.get("outstanding", 0),
                    "overdue": days_left < 0, "days_left": days_left,
                })

    # sales / profit / expenses
    sales = await db.sales.find({}).to_list(20000)
    retail_profit = round(sum(s["profit"] for s in sales), 2)
    retail_sales_total = round(sum(s["sale_price"] for s in sales), 2)
    wholesale_profit = round(sum(s.get("profit", 0) for s in supplies), 2)
    wholesale_sales_total = round(sum(s["amount"] for s in supplies), 2)
    # A generic (non-inventory) credit-card spend raises Card Outstanding (a Source)
    # with no matching asset, so it is a business expense that reduces Profit — keeping
    # Assets = Sources. A refund reverses such an expense, so it restores Profit.
    expense_txns = await db.credit_card_txns.find({"kind": "spend", "category": "expense"}).to_list(20000)
    refund_txns = await db.credit_card_txns.find({"kind": "refund"}).to_list(20000)
    total_expenses = round(sum(t["amount"] for t in expense_txns) - sum(t["amount"] for t in refund_txns), 2)
    total_profit = round(retail_profit + wholesale_profit - total_expenses, 2)

    return {
        "total_paisa": total_paisa,
        "cash_balance": cash_balance,
        "total_bank": total_bank,
        "total_upi": total_upi,
        "accounts": accounts,
        "bank_accounts": [a for a in accounts if a["type"] == "bank"],
        "upi_accounts": [a for a in accounts if a["type"] == "upi"],
        "cash_accounts": [a for a in accounts if a["type"] == "cash"],
        "wholesale_receivable": receivable,
        "credit_card_outstanding": cc_outstanding,
        "credit_limit_total": credit_limit_total,
        "available_credit_limit": available_credit_limit,
        "credit_utilization": credit_utilization,
        "upcoming_due_amount": upcoming_due_amount,
        "due_reminders": due_reminders,
        "fixed_poonji": fixed_poonji,
        "stock_value": stock_value,
        "stock_count": len(in_stock),
        "total_stock_units": len(in_stock),
        "total_purchase": total_purchase,
        "retail_profit": retail_profit,
        "retail_sales_total": retail_sales_total,
        "wholesale_profit": wholesale_profit,
        "wholesale_sales_total": wholesale_sales_total,
        "total_expenses": total_expenses,
        "total_profit": total_profit,
        "total_sales": len(sales),
    }


@api_router.get("/profit")
async def profit_report(from_date: Optional[str] = None, to_date: Optional[str] = None,
                        user: dict = Depends(get_current_user)):
    def in_range(d):
        day = d[:10]
        if from_date and day < from_date:
            return False
        if to_date and day > to_date:
            return False
        return True

    sales = [s for s in await db.sales.find({}).to_list(20000) if in_range(s["date"])]
    supplies = [s for s in await db.wholesale_supplies.find({}).to_list(20000) if in_range(s["date"])]
    for s in sales:
        s.pop("_id", None)
    retail_profit = round(sum(s["profit"] for s in sales), 2)
    retail_revenue = round(sum(s["sale_price"] for s in sales), 2)
    wholesale_profit = round(sum(s.get("profit", 0) for s in supplies), 2)
    wholesale_revenue = round(sum(s["amount"] for s in supplies), 2)
    return {
        "retail_profit": retail_profit,
        "retail_revenue": retail_revenue,
        "retail_count": len(sales),
        "wholesale_profit": wholesale_profit,
        "wholesale_revenue": wholesale_revenue,
        "wholesale_count": len(supplies),
        "total_profit": round(retail_profit + wholesale_profit, 2),
        "total_revenue": round(retail_revenue + wholesale_revenue, 2),
        "sales": sorted(sales, key=lambda x: x["date"], reverse=True)[:100],
    }


# ---------------------------------------------------------------------------
# Startup
# ---------------------------------------------------------------------------
@api_router.get("/settings")
async def get_settings(user: dict = Depends(get_current_user)):
    doc = await db.settings.find_one({"id": "business"})
    if not doc:
        return {"id": "business", "business_name": "", "logo_url": ""}
    return clean(doc)


@api_router.put("/settings")
async def update_settings(payload: dict, user: dict = Depends(get_current_user)):
    updates = {"business_name": payload.get("business_name", ""), "logo_url": payload.get("logo_url", "")}
    await db.settings.update_one({"id": "business"}, {"$set": {"id": "business", **updates}}, upsert=True)
    return clean(await db.settings.find_one({"id": "business"}))


@app.on_event("startup")
async def startup():
    await db.accounts.create_index("id", unique=True)
    await db.transactions.create_index("account_id")
    await db.users.create_index("email", unique=True)
    # No owner is seeded. The first owner is created via the /api/auth/setup
    # first-time setup flow, so no password is ever hardcoded or exposed.


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()


app.include_router(api_router)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)
