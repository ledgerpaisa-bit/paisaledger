# Changelog

All notable changes to Paisa Ledger are logged here — one entry per branch/merge, newest first.

## Unreleased — branch `feature/social-login`

- Added "Continue with Google", "Continue with Facebook", and "Continue with Apple" to the login and signup pages. Backend implements the OAuth2 authorization-code flow for each provider (`/api/auth/{provider}/login` and `/api/auth/{provider}/callback`); signing in with any provider finds-or-creates a user by email and issues the same JWT used by password login.
- Signup now requires email verification: submitting the signup form sends a 6-digit code to the entered email (`/api/auth/register/request-otp`); the account is only created after the code is confirmed (`/api/auth/register/verify-otp`). Old direct `/api/auth/register` endpoint is kept for backward compatibility but the UI no longer uses it directly.
- Why: the user asked for social sign-in options and for email addresses to be verified at signup, so accounts can't be created with an email the person doesn't actually control.
- Needs before this can go live: Google OAuth Client ID/Secret, Facebook App ID/Secret, and Apple Services ID + Team ID + Key ID + private key, each set as environment variables on Render (see setup steps shared with the user). Mobile number + OTP login was requested too but deferred — needs an SMS provider decision first.

