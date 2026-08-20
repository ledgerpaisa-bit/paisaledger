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
- 2026-06 (this session): closed-card write guards (card txn + stock POST both 400) verified via curl; dashboard utilization now uses open-card outstanding (never >100%); Card Expenses line added to dashboard; Payment Reminder Emails (Resend) + daily 9am IST cron verified (cron auth 401/401/200/idempotent, real test email delivered to owner).

## Payment Reminder Emails (Resend + cron)
- Emergent-managed Resend. Env: EMERGENT_EMAIL_KEY, EMAIL_FROM_NAME="Rahul Mobile", WEBHOOK_CRON_SECRET.
- Recipient = owner (earliest user) email, server-side only (rahuldrrr@gmail.com). Guardrail gate `_assert_safe_email` on every send.
- Cron: `.emergent/crons.yml` → POST /api/cron/due-reminders daily 09:00 Asia/Kolkata; endpoint auths Bearer WEBHOOK_CRON_SECRET, backgrounds work, idempotent via X-Webhook-Id (db.cron_runs).
- Emails cards with outstanding>0 and due within 3 days (incl overdue). Owner test-send: POST /api/reminders/test + Settings "Send test reminder" button.

## Backlog (P1/P2)
- P2: Split server.py into routers; Mongo aggregation/caching for dashboard & list_cards.
- P2: `<span>` inside `<option>` console warning is injected by the dev/visual-editor instrumentation (not in source, not in prod) — no action needed.
- P2: ledger search.
- Deferred (per user): Expenses line = DONE; Spend-vs-Bill warning still open.

## Notes
- Single-owner app; DB is global (not user-scoped). Testing uses a temp QA user + delta checks.
- Code-quality pass (2026-06): applied safe, behavior-preserving fixes only — `useMemo` for derived lists (Accounts/Stock), `useCallback`-stabilized data loaders + eslint-disable on intentional mount effects (Dashboard/CreditCards/Accounts/Stock/Wholesale/AuthContext), extracted nested ternaries into named helpers (Dashboard `utilTone`/`AccountIcon`, CreditCards `utilColorClass`, Stock `paidTone`/toast msg), removed a `console.warn`, and env-ized test passwords. Verified via smoke test (all pages load, auth ok).
- Declined scanner items (false positives / regression risk): `data-testid` strings mis-flagged as "secrets"; `active is True` is correct for `Optional[bool]`; list-comprehension var `a` is scoped; localStorage→httpOnly cookie rearchitecture; large complexity refactors of tested accounting core (`dashboard_summary`, `record_transaction`, big component splits) — available as a dedicated re-tested pass on request.
