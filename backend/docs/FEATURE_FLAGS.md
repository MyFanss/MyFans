# Feature Flags Documentation

This document describes all feature flags used across the MyFans backend and frontend, including their configuration environment variables, default states, and blast radius.

## Flag Inventory

| Flag Name | Backend Key | Frontend Key | Environment Variable(s) | Default | Blast Radius | Description |
|-----------|-------------|--------------|-------------------------|---------|--------------|-------------|
| **Soroban Poller** | `sorobanPoller` | `sorobanPoller` | `FEATURE_SOROBAN_POLLER`, `FEATURE_FLAG_SOROBAN_POLLER`, `FEATURE_POLLER` | `false` (in test/dev; `true` in prod when RPC and Contract are configured) | Medium (background subscription indexing from Soroban RPC) | Controls on-chain event poller indexing subscription states into database. |
| **WalletConnect** | `walletConnect` | `walletConnect` | `FEATURE_WALLET_CONNECT`, `FEATURE_FLAG_WALLET_CONNECT`, `NEXT_PUBLIC_FEATURE_WALLET_CONNECT` | `false` | Low (wallet modal connect options) | Enables WalletConnect as a sign/connect option in frontend wallet selection modal. |
| **Content Uploads** | `contentUploads` | `contentUploads` | `FEATURE_CONTENT_UPLOADS`, `FEATURE_FLAG_CONTENT_UPLOADS`, `NEXT_PUBLIC_FEATURE_CONTENT_UPLOADS` | `false` | Medium (creator content creation & IPFS pinning) | Controls direct creator media/content upload and pinning workflows. |
| **Bookmarks** | `bookmarks` | `bookmarks` | `FEATURE_FLAG_BOOKMARKS`, `NEXT_PUBLIC_FLAG_BOOKMARKS` | `false` | Low (UI bookmark controls) | Shows creator bookmark controls across creator discovery and subscription flows. |
| **Earnings Withdrawals** | `earnings_withdrawals` | `earnings_withdrawals` | `FEATURE_FLAG_EARNINGS_WITHDRAWALS`, `NEXT_PUBLIC_FLAG_EARNINGS_WITHDRAWALS` | `false` | High (funds withdrawal flow) | Enables the earnings withdrawal UI and endpoints on the creator earnings page. |
| **Earnings Fee Transparency** | `earnings_fee_transparency` | `earnings_fee_transparency` | `FEATURE_FLAG_EARNINGS_FEE_TRANSPARENCY`, `NEXT_PUBLIC_FLAG_EARNINGS_FEE_TRANSPARENCY` | `false` | Low (informational UI) | Shows fee transparency breakdown card on the creator earnings page. |
| **New Subscription Flow** | `newSubscriptionFlow` | `newSubscriptionFlow` | `FEATURE_NEW_SUBSCRIPTION_FLOW`, `FEATURE_FLAG_NEW_SUBSCRIPTION_FLOW`, `NEXT_PUBLIC_FEATURE_NEW_SUBSCRIPTION_FLOW` | `false` | High (checkout experience) | Enables the new subscription checkout flow. |
| **Crypto Payments** | `cryptoPayments` | `cryptoPayments` | `FEATURE_CRYPTO_PAYMENTS`, `FEATURE_FLAG_CRYPTO_PAYMENTS`, `NEXT_PUBLIC_FEATURE_CRYPTO_PAYMENTS` | `false` | High (payment methods) | Enables cryptocurrency payment options during checkout. |
| **Referral Codes** | `referralCodes` | `referral_codes` | `FEATURE_REFERRAL_CODES`, `FEATURE_FLAG_REFERRAL_CODES`, `NEXT_PUBLIC_FLAG_REFERRAL_CODES` | `false` | Low (referral inputs) | Enables referral / invite code input during checkout and share panel in settings. |
| **Short-Lived Access Tokens** | `shortLivedAccessTokens` | N/A | `FEATURE_SHORT_LIVED_ACCESS_TOKENS` | `false` | High (auth token expiration) | Gates shortening the access JWT TTL from 24h to 15m. |

---

## API Endpoints

### `GET /v1/features` or `GET /v1/feature-flags`
- **Authentication**: Public (no credentials required)
- **Response**: JSON map of flag names to boolean values (`FeatureFlagsSnapshot`)
- **Security**: Contains only public booleans; no secret keys, tokens, or private configurations are leaked.
