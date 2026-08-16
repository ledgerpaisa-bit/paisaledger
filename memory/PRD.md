# Mobile Business Balance & Profit Tracker — PRD

## Original Problem Statement
Build the Money/Account Management functionality for a Mobile Business Balance & Profit Tracker
(mobile phone retailer). Multiple money accounts (Cash, Bank, UPI), Account Master, account-wise
balance + Total Paisa, retail sales linked to a payment account, wholesale receivables & payments,
account transfers, per-account ledger with running balance, Fixed Poonji kept separate from Paisa,
credit cards, stock, profit. Block negative balances. Full audit trail. INR formatting.
(No pre-existing code existed — the entire app was built fresh.)

## Architecture
- Backend: FastAPI (`/app/backend/server.py`), MongoDB (motor). All routes under `/api`.
- Auth: JWT (bcrypt), token in login response body, sent via `Authorization: Bearer`. Owner seeded on startup.
- Frontend: React (CRA + craco), Tailwind, shadcn-style components, lucide-react icons, sonner toasts.
  Swiss high-contrast design. INR via `Intl.NumberFormat('en-IN')`.
- Core money engine: `record_transaction()` — every movement writes a `transactions` ledger row,
  updates account `current_balance`, enforces non-negative unless `allow_negative`.

## User Personas
- Business owner (single user) tracking daily mobile sales, balances, receivables and profit.

## Core Requirements (static)
- Total Paisa = sum of active account balances. Fixed Poonji NOT counted. Wholesale receivable NOT counted until paid.
- Transfers move money between own accounts without changing Total Paisa.
- Every money movement = one transaction; adjustments create adjustment transactions (audit trail).

## Implemented (2026-08-16)
- JWT login (owner rahuldrrr@gmail.com).
- Account Master: create/edit/activate-deactivate, opening balance, last4, notes, allow-negative.
- Dashboard: Total Paisa hero, Cash/Bank/UPI totals, account-wise breakdown (click → ledger),
  receivable, credit card outstanding, stock value, fixed poonji, total profit.
- Retail sales (mobile+IMEI+payment account, optional stock pick), credits account.
- Wholesale: customers, supplies (receivable), payments into account.
- Account Transfers (two-legged ledger entries).
- Per-account Ledger with running balance + date/type filters.
- Stock, Credit Cards (spend/payment), Fixed Poonji, Profit report.
- Negative-balance protection. Backend tested 100% (13/13), frontend 95%.

## Backlog / Remaining
- P1: Edit/delete retail sales & wholesale supplies with reversing transactions.
- P1: Brute-force lockout / rate limiting on login; restrict CORS origins.
- P2: Split server.py into routers; CSV/PDF export of ledgers & profit; date-range dashboard.
- P2: Charts on dashboard (recharts) for daily sales/profit trend.

## Next tasks
- Await user feedback on the first build; then prioritize edit/reversal flows and exports.
