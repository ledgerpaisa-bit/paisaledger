# Mobile Business Balance & Profit Tracker — PRD

## Original Problem Statement
Business finance app for a mobile phone retailer: multiple money accounts (Cash/Bank/UPI),
account master + ledgers, retail sales, wholesale, stock/purchases, credit cards, fixed poonji,
profit, and a dashboard with Total Paisa + account-wise balances. Built fresh (no prior code).

## Architecture
- Backend: FastAPI (`/app/backend/server.py`), MongoDB (motor). All routes under `/api`.
- Auth: JWT (bcrypt). First-time SETUP flow (no seeded owner); token in body via Authorization: Bearer.
- Frontend: React (CRA/craco), Tailwind, shadcn-style shared components, lucide-react, sonner.
- Core money engine `record_transaction()` writes an account ledger row, updates balance,
  enforces non-negative unless account allows it.

## Accounting model (Assets = Sources)
- Assets = stock_value + total_paisa. Sources = credit_card_outstanding + fixed_poonji + total_profit.
- total_profit = retail_profit + wholesale_profit - total_expenses.
- total_expenses = generic card spends (kind=spend, category=expense) + card opening_outstanding
  MINUS refunds. Stock-purchase card charges (category=purchase) are NOT expenses (backed by stock).
- Card bill payment: debits account + reduces card outstanding, NOT an expense/profit change.
- Fixed Poonji kept separate from Paisa; wholesale receivable excluded from Paisa until paid.

## Implemented (through 2026-06)
- Owner setup/login/logout, protected routes, Settings page.
- Accounts (Cash/Bank/UPI): CRUD, activate/deactivate, adjust, transfers, per-account ledger w/ filters.
- Dashboard: Core Business Position equation, 5 summary cards, Business Volume, Liquidity & Limits,
  Credit Cards strip (outstanding/available/limit/utilization%/upcoming due), account-wise balances, Quick Actions.
- Retail sales (receiving account + IMEI + profit + stock link). Wholesale (customers/supplies/payments).
- Purchases/Stock with payment method (Cash/Bank/UPI/Credit Card/Fixed Poonji) + over-limit guard.
- Credit Card Management: multiple cards; fields (limit, opening outstanding, statement date, due date,
  min due, over-limit, notes); add/edit; utilization bar; status Paid/Partially/Due/Overdue; per-card ledger
  w/ running outstanding; statement (opening/purchases/charges/payments/refunds/closing/available) + CSV/PDF;
  spend/payment/refund with validations; Pay Bill (Quick Action + per card).
- Fixed Poonji, Profit & Loss report.

## Verified
- Testing agent iterations 1–4 all pass (100%). Accounting equation holds through purchase→sale→
  pay-bill, opening outstanding, and refund flows (self-verified delta A-S = 0).
- Iteration 6: soft close/reopen card, statement branding, custom DatePicker (backend 9/9, frontend ~85% w/ 4 UI defects).
- Iteration 7 (2026-06): DatePicker popover-close-on-select + Escape-only-closes-popover both VERIFIED PASS (5/5). Card submit testid = 'card-form-submit'.

## Backlog (P1/P2)
- P1 (flagged in iter 6, pending decision): Backend reject new txns/stock purchases against a CLOSED card (400); Frontend hide/disable "Pay Bill" + "Add Txn" on closed cards.
- P1: Route-level ErrorBoundary; login rate-limiting; restrict CORS.
- P2: Split server.py into routers; Mongo aggregation/caching for dashboard & list_cards.
- P2: Fix `<span>` inside `<option>` hydration console warning; dashboard utilization/available consistency for closed cards; ledger search.
- Deferred (per user): Payment Reminder Emails; Expenses line on dashboard; Spend-vs-Bill warning.

## Notes
- Single-owner app; DB is global (not user-scoped). Testing uses a temp QA user + delta checks.
