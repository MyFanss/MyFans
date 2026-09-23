# Feature Flags Documentation

This document describes all feature flags used across the MyFans backend and frontend, including their configuration environment variables, default states, and blast radius.

## Flag Inventory

| Flag Name | Backend Key | Frontend Key | Environment Variable(s) | Default | Blast Radius | Description |
|-----------|-------------|--------------|-------------------------|---------|--------------|-------------|
| **Soroban Poller** | `sorobanPoller` | `sorobanPoller` | `FEATURE_SOROBAN_POLLER`, `FEATURE_FLAG_SOROBAN_POLLER`, `FEATURE_POLLER` | `false` (test/dev); `true` in prod **only** when both Soroban RPC and Contract are configured, otherwise `false` | Medium (background subscription indexing from Soroban RPC) | Controls on-chain event poller indexing subscription states into database. In production the default is explicit: the poller stays off unless RPC + Contract are set, preventing poller storms. |
| **WalletConnect** | `walletConnect` | `walletConnect` | `FEATURE_WALLET_CONNECT`, `FEATURE_FLAG_WALLET_CONNECT`, `NEXT_PUBLIC_FEATURE_WALLET_CONNECT` | `false` | Low (wallet modal connect options) | Enables WalletConnect as a sign/connect option in frontend wallet selection modal. Defaults **off** so WalletConnect cannot half-break the wallet modal in prod. |
| **Content Uploads** | `contentUploads` | `contentUploads` | `FEATURE_CONTENT_UPLOADS`, `FEATURE_FLAG_CONTENT_UPLOADS`, `NEXT_PUBLIC_FEATURE_CONTENT_UPLOADS` | `false` | Medium (creator content creation & IPFS pinning) | Controls direct creator media/content upload and pinning workflows. Defaults **off**; enable explicitly per environment. |
| **Bookmarks** | `bookmarks` | `bookmarks` | `FEATURE_FLAG_BOOKMARKS`, `NEXT_PUBLIC_FLAG_BOOKMARKS` | `false` | Low (UI bookmark controls) | Shows creator bookmark controls across creator discovery and subscription flows. |
| **Earnings Withdrawals** | `earnings_withdrawals` | `earnings_withdrawals` | `FEATURE_FLAG_EARNINGS_WITHDRAWALS`, `NEXT_PUBLIC_FLAG_EARNINGS_WITHDRAWALS` | `false` | High (funds withdrawal flow) | Enables the earnings withdrawal UI and endpoints on the creator earnings page. |
| **Earnings Fee Transparency** | `earnings_fee_transparency` | `earnings_fee_transparency` | `FEATURE_FLAG_EARNINGS_FEE_TRANSPARENCY`, `NEXT_PUBLIC_FLAG_EARNINGS_FEE_TRANSPARENCY` | `false` | Low (informational UI) | Shows fee transparency breakdown card on the creator earnings page. |
| **New Subscription Flow** | `newSubscriptionFlow` | `newSubscriptionFlow` | `FEATURE_NEW_SUBSCRIPTION_FLOW`, `FEATURE_FLAG_NEW_SUBSCRIPTION_FLOW`, `NEXT_PUBLIC_FEATURE_NEW_SUBSCRIPTION_FLOW` | `false` | High (checkout experience) | Enables the new subscription checkout flow. |
| **Crypto Payments** | `cryptoPayments` | `cryptoPayments` | `FEATURE_CRYPTO_PAYMENTS`, `FEATURE_FLAG_CRYPTO_PAYMENTS`, `NEXT_PUBLIC_FEATURE_CRYPTO_PAYMENTS` | `false` | High (payment methods) | Enables cryptocurrency payment options during checkout. |
| **Referral Codes** | `referralCodes` | `referral_codes` | `FEATURE_REFERRAL_CODES`, `FEATURE_FLAG_REFERRAL_CODES`, `NEXT_PUBLIC_FLAG_REFERRAL_CODES` | `false` | Low (referral inputs) | Enables referral / invite code input during checkout and share panel in settings. |
| **Short-Lived Access Tokens** | `shortLivedAccessTokens` | N/A | `FEATURE_SHORT_LIVED_ACCESS_TOKENS` | `false` | High (auth token expiration) | Gates shortening the access JWT TTL from 24h to 15m. |

---

## Defaults & Safety

All flags default to **off** unless explicitly enabled. This keeps unsafe flags from being default-on and avoids WalletConnect half-breaks or poller storms in production.

- **WalletConnect**: default `false`. Enable only when the WalletConnect project is fully configured.
- **Content Uploads**: default `false`. Enable explicitly per environment once IPFS pinning is ready.
- **Soroban Poller**: default `false` in test/dev. In production the default is explicit — the poller runs only when both Soroban RPC and Contract are configured; otherwise it stays off.

### Environment Variable Overrides

Flags can be overridden via environment variables. Boolean strings are coerced safely:

- `"true"` / `"1"` / `"yes"` / `"on"` → `true`
- `"false"` / `"0"` / `"no"` / `"off"` → `false`
- Any other value → falls back to the flag's default (no crash).

### Unknown Flags

Unknown flag names are handled safely: the API returns the known snapshot and never throws. Consumers should treat a missing flag as `false`.

---

## Blast Radius

| Blast Radius | Meaning | Flags |
|--------------|---------|-------|
| **High** | Affects funds, payments, or auth. Enable with caution and staged rollout. | `earnings_withdrawals`, `newSubscriptionFlow`, `cryptoPayments`, `shortLivedAccessTokens` |
| **Medium** | Affects background indexing or content creation. | `sorobanPoller`, `contentUploads` |
| **Low** | UI-only or informational. | `walletConnect`, `bookmarks`, `earnings_fee_transparency`, `referralCodes` |

---

## API Endpoints

### `GET /v1/features` or `GET /v1/feature-flags`
- **Authentication**: Public (no credentials required)
- **Response**: JSON map of flag names to boolean values (`FeatureFlagsSnapshot`)
- **Security**: Contains only public booleans; no secret keys, tokens, or private configurations are leaked.

### Runtime Flipping

Dangerous flags (High blast radius) require an admin role to flip at runtime where runtime toggling is supported. Non-admin callers cannot change flag state.

---

## Staging vs Production Parity

See `frontend/STAGING_PARITY_CHECKLIST.md` for the checklist that keeps staging and production flag values aligned. Mismatches between staging and prod are a common source of surprises — verify flag values in both environments before rollout.
