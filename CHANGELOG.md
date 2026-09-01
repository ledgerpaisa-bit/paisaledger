# Changelog

All notable changes to Paisa Ledger are logged here — one entry per branch/merge, newest first.

## 2026-08-31 — branch `staff-billing-counter`

- New feature: a **Billing Counter** so the app can be handed to shop staff (or used by other shopkeepers who license this app) for day-to-day retail billing, without giving out the owner's full login.
- **Multi-item bills**: one bill can now contain multiple mobiles (e.g. 2 phones in one sale). Completing a bill deducts each item from stock in one go, records one profit-tracked `sales` entry per item (reusing the existing Retail Sale profit logic), and credits ONE combined payment to the chosen Cash/Bank/UPI account — matching how a real shop counter sale works.
  - Backend: new `bills` collection (`bill_number`, `items`, `total_amount`, `account_id`, linked `sale_ids`, `staff_id`/`staff_name` attribution) and `POST /api/bills` (all-or-nothing validation before any stock is touched), plus `GET /api/bills` and `GET /api/bills/{id}` for reprinting a receipt later.
- **Separate staff login**: shop owner creates staff accounts from Settings with a simple username + 4-6 digit PIN (no email/OTP). Staff sign in at `/staff-login` and land only on the Billing Counter — they cannot reach the Dashboard, Reports, Settings or any other owner-only route.
  - Backend: new `staff` collection (globally-unique username, bcrypt-hashed PIN, active flag, scoped to the owner's `user_id`) with owner-only CRUD (`POST/GET/PUT/DELETE /api/staff`) and a dedicated `POST /api/auth/staff/login` that issues a role-restricted JWT (`type: staff`). A new `get_billing_actor` dependency accepts either the owner's normal token or a staff token on billing routes only; the existing `get_current_user` dependency guarding every other route rejects staff tokens outright (staff `sub` doesn't resolve to a `users` document), so a stolen staff token cannot reach owner data. New `GET /api/billing/stock` and `GET /api/billing/accounts` give staff just enough read access (in-stock items to search, account names to pick from) without exposing account balances or anything else.
  - Owner can deactivate/re-activate a staff login and reset a forgotten PIN from Settings; a deactivated account is blocked at login (403) immediately.
- **Printable/shareable receipt**: completing a bill opens a clean printable receipt (`/bills/:id/receipt`) with a Print button (browser print-to-PDF, so it can be shared on WhatsApp). Both the owner (via a new "Billing Counter" sidebar link) and staff can create bills and reprint receipts; staff only ever see their own bills.
- Verified end-to-end in the sandbox against an in-memory mock DB: owner signup → create staff → staff PIN login → staff creates a 2-item bill → both stock items marked sold → account balance credited with the combined total → owner-only route correctly rejects the staff token → deactivate/reactivate/PIN-reset/duplicate-username edge cases all behave as expected.
- Why: user wants to eventually give this app to other mobile shopkeepers, with their shop staff able to bill customers at the counter without owner-level access.

## 2026-08-31 — branch `dashboard-brand-stock-summary`

- Added a brand-wise "Stock Value Summary" table to the Dashboard, matching the reference mockup: groups in-stock items by brand (detected from the free-text mobile model name — iPhone, Samsung, OnePlus, Xiaomi/Redmi/Poco, Vivo, Oppo, Realme, Motorola, Nothing, Google/Pixel, and others fall under "Others") and shows distinct models, unit count and total purchase value per brand, sorted by value.
- Backend: `/api/dashboard/summary` now returns `stock_by_brand`. No new DB fields — brand is derived on the fly from `mobile_model`, so existing stock data works with no migration.
- Why: user shared a reference dashboard screenshot and asked for this table to match it before merging.
- Added a "Credit Card Summary" card to the Dashboard: one row per open card (name, bank, last4) with an outstanding-vs-limit progress bar, colored by utilization (matches the existing green/amber/red thresholds already used elsewhere on the dashboard).
- Backend: `/api/dashboard/summary` now also returns `card_summary` (per-card outstanding, limit, utilization %), built from the same open-cards list `_credit_metrics` already computes — no new DB fields.
- Added a "Paisa Summary" card to the Dashboard: Cash in Hand / Bank Accounts / UPI-Other, matching the reference mockup's breakdown by account type (separate from the existing account-wise list below it, which shows individual accounts by name).
- No backend change needed for this one — `cash_balance`, `total_bank`, `total_upi` and `total_paisa` were already in the `/api/dashboard/summary` response.
- Added a "Wholesale Outstanding (Receivable)" per-shop card to the Dashboard, showing which shops currently owe money (A Shop / B Shop style tiles, sorted highest-outstanding first) instead of only the combined total.
- Backend: `/api/dashboard/summary` now also returns `wholesale_by_shop` (per-customer outstanding, positive balances only), computed from the same supplies/payments already fetched for the `wholesale_receivable` total — no new DB fields.
- Added a "Balanced" / "Out of balance" status badge to the Core Business Position bar, comparing Assets side (Stock + Paisa) vs Sources side (Card Outstanding + Fixed Poonji + Profit) — frontend-only, both totals were already computed on the Dashboard.
- Full visual restyle of the Dashboard to match the reference mockup:
  - The dark "Core Business Position" bar is replaced with the mockup's colorful 5-card equation row (Stock Value + Paisa = Card Outstanding + Fixed Poonji + Profit, each its own colored icon card) followed by a "Total (Left Side) / Total (Right Side) / Business Status: Balanced" strip. The old duplicate 5-card summary row below it is removed (it showed the same 5 numbers twice).
  - Business Volume, Liquidity & Limits and Credit Cards mini-stat cards now carry small colored icons (previously plain text tiles), matching the mockup's icon-tile style.
  - Stock Value Summary, Paisa Summary and Credit Card Summary are now a 3-column row instead of stacked full-width cards, matching the mockup's layout.
  - Wholesale Outstanding (Receivable) now pairs with Quick Actions in a 2:1 row (previously paired with Account-wise Balance), matching the mockup's bottom row.
  - Account-wise Balance (individual account ledger links) isn't in the reference mockup, so it's kept as its own section below everything else rather than removed — it's real, already-working navigation to each account's ledger.
  - All existing `data-testid`s were preserved as-is during the rewrite (no test IDs renamed or removed), only their position on the page changed.
  - Follow-up pass for an exact match: the three secondary-stat rows (Business Volume / Liquidity & Limits / Credit Cards — 15 cards total) are collapsed into the single 5-card row the mockup actually has (Total Stock (Units), Total Purchases, Total Sales (Retail), Total Sales (Wholesale), Total Receivable). The dropped cards (Cash/Bank/UPI balances, card limit/utilization/upcoming-due) aren't lost — they're already covered by the Paisa Summary and Credit Card Summary cards added earlier.
  - Quick Actions switched from a bordered vertical list to an icon-grid (icon-on-top, label-below, 2-3 per row) matching the mockup's button style. All 8 actions were kept (the mockup only showed 5) — only the visual style changed, not what you can do from there.
- Credit Card Summary now also shows each card's due date + minimum due (when set), right under its utilization bar — in addition to the existing "Credit Card Dues" alert banner at the top of the Dashboard (which only appears for cards overdue or due within 7 days). User flagged this as important to have visible.
- Backend: `/api/dashboard/summary`'s `card_summary` rows now include `due_date` and `min_due` (already stored per card, just weren't surfaced there before).

## 2026-08-30 — branch `remove-facebook-apple`

- Removed the "Continue with Facebook" and "Continue with Apple" buttons and their backend OAuth routes (`/api/auth/facebook/*`, `/api/auth/apple/*`). Google sign-in stays.
- Why: the user decided not to set up Facebook/Apple developer accounts for now — Apple in particular needs a paid ($99/year) Developer Program membership. Can be re-added later if wanted.

## 2026-08-30 — merged `feature/social-login`

- Added "Continue with Google", "Continue with Facebook", and "Continue with Apple" to the login and signup pages. Backend implements the OAuth2 authorization-code flow for each provider (`/api/auth/{provider}/login` and `/api/auth/{provider}/callback`); signing in with any provider finds-or-creates a user by email and issues the same JWT used by password login.
- Signup now requires email verification: submitting the signup form sends a 6-digit code to the entered email (`/api/auth/register/request-otp`); the account is only created after the code is confirmed (`/api/auth/register/verify-otp`). Old direct `/api/auth/register` endpoint is kept for backward compatibility but the UI no longer uses it directly.
- Why: the user asked for social sign-in options and for email addresses to be verified at signup, so accounts can't be created with an email the person doesn't actually control.
- Needs before this can go live: Google OAuth Client ID/Secret, Facebook App ID/Secret, and Apple Services ID + Team ID + Key ID + private key, each set as environment variables on Render (see setup steps shared with the user). Mobile number + OTP login was requested too but deferred — needs an SMS provider decision first.

