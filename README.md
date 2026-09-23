# MyFans – Decentralized Content Subscription Platform (Stellar)

**MyFans** is a decentralized content subscription platform built on **Stellar** and **Soroban**. It lets creators monetize their work with on-chain subscriptions, direct payments, and transparent revenue—using Stellar’s speed, low cost, and multi-currency support.

---

## Why Stellar

- **Speed & cost**: 3–5 second finality and very low fees, suitable for subscriptions and micro-payments.
- **Multi-currency**: Native support for XLM and Stellar assets (e.g. USDC, EURT) so fans can pay in stablecoins or XLM.
- **Soroban**: Rust/Wasm smart contracts with deterministic execution and a strong SDK.
- **Ecosystem**: Anchors and on/off-ramps can connect subscriptions to fiat (card, bank).
- **Scale**: Stellar handles high throughput; no gas auctions or volatile fees.

---

## Problems MyFans Solves

| Problem | MyFans approach |
|--------|------------------|
| High platform fees | Direct creator payouts; small, transparent protocol fee. |
| Delayed or opaque payments | On-chain subscriptions and instant settlement. |
| Single-currency lock-in | Pay in XLM or any Stellar asset (e.g. USDC). |
| Centralized access control | Subscription and access enforced in Soroban contracts. |
| No fiat-friendly path | Backend + frontend can integrate anchors/ramps for card/bank. |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           MyFans Platform                                 │
├─────────────────┬─────────────────────────┬─────────────────────────────┤
│   frontend/     │      backend/           │      contract/              │
│   (Next.js)     │      (Nest.js)          │      (Soroban/Rust)         │
├─────────────────┼─────────────────────────┼─────────────────────────────┤
│ • Wallet connect│ • Auth & sessions       │ • Subscription lifecycle    │
│   (Freighter,   │ • Creator/fan APIs      │ • Payment routing & fees    │
│    Lobstr, etc.)│ • Content metadata      │ • Access control (is        │
│ • Creator       │ • IPFS / storage refs   │   subscriber?)              │
│   dashboard     │ • Webhooks / events     │ • Multi-asset payments      │
│ • Fan discovery │ • Indexer / analytics   │ • Pause, cancel, renew      │
│ • Subscription  │ • Notifications         │                             │
│   management    │ • Contract event poller │                             │
│                 │ • JWT auth (Stellar key) │                             │
└────────┬────────┴────────────┬────────────┴──────────────┬──────────────┘
         │                     │                            │
         └─────────────────────┼────────────────────────────┘
                               ▼
                    ┌──────────────────────┐
                    │  Stellar / Soroban    │
                    │  (XLM, USDC, etc.)    │
                    └──────────────────────┘
```

---

## Repository Structure

| Folder | Role |
|--------|------|
| **`contract/`** | Soroban smart contract (Rust). Subscription state, payments, access control. |
| **`frontend/`** | Next.js app. Creator and fan UI, wallet connection, subscription flows. |
| **`backend/`** | Nest.js API. Auth, content metadata, IPFS refs, indexing, notifications. |

You will keep only these three folders and this README; other files can be removed.

---

## 1. Smart Contract (Soroban) – `contract/`

### Responsibilities

- **Subscription lifecycle**: Create subscription (plan, asset, amount, interval), renew, cancel, pause.
- **Payment logic**: Accept payments in configured Stellar asset; split creator vs protocol fee; optional escrow for chargebacks/disputes.
- **Access control**: Expose “is subscriber” (and optionally tier/expiry) for backend/frontend to gate content.
- **Multi-asset**: Support XLM and Stellar tokens (e.g. USDC) so creators can choose accepted assets.

### Suggested contract interface (conceptual)

- `init(admin, protocol_fee_bps, fee_recipient)` – set fee (in basis points) and recipient. **Admin-only**; the fee is capped at `MAX_FEE_BPS = 1_000` (10%) and can never be set to 100%. `fee_recipient` must be the deployed **treasury** contract.
- `set_protocol_fee_bps(admin, bps)` – **admin-only** (`require_auth` on the stored admin; non-admin callers revert). Enforces `bps <= MAX_FEE_BPS` (`1_000` = 10%); `bps > 1_000` (e.g. `10_000` or `10_001`) reverts. `bps = 0` is explicitly allowed and disables the protocol fee. Emits a `FeeUpdated` event for indexers/analytics.
- `set_fee_recipient(admin, recipient)` – **admin-only**. The recipient is restricted to the deployed **treasury** contract (allowlisted); setting it to any other address (e.g. a fan address) reverts. This keeps the treasury recipient invariant intact.
- `create_plan(creator, asset, amount, interval_days)` – define a subscription plan.
- `subscribe(fan, plan_id, duration)` – fan subscribes; payment is split: creator receives the amount minus the protocol fee, and the fee is routed into the treasury via its `deposit(from, amount)` entry point (pause honored, `deposit` event emitted).
- `renew(subscription_id)` – renew if within allowed window.
- `cancel(subscription_id)` – cancel; no refund of current period (or implement refund rules in contract).
- `is_subscriber(fan, creator)` → bool (and optionally expiry).
- Events for: subscription_created, payment_received, subscription_cancelled, fee_updated (for indexer/backend).

### Tech

- **Rust**, **soroban-sdk**.
- Build & test: **stellar-cli** / **soroban-cli**; deploy to Stellar testnet/mainnet via CLI or CI.

---

## 2. Frontend – `frontend/`

### Responsibilities

- **Wallets**: Connect Freighter, Lobstr, or other Stellar wallets (via standard Stellar/Soroban wallet interfaces).
- **Creators**: Dashboard to create plans, set pricing (XLM or asset), view subscribers and earnings.
- **Fans**: Discover creators, view plans, subscribe (sign Soroban tx), manage active subscriptions.
- **UX**: Show subscription status, next billing, and “access granted” for gated content.

### Wallet support today

The current frontend wallet implementation does not treat all wallets equally:

| Wallet | Current repo status | Practical difference in MyFans |
|--------|----------------------|--------------------------------|
| **Freighter** | Fully wired for connection and transaction signing | The reference wallet. **Guaranteed** for every flow; local onboarding (see [frontend/docs/LOCAL_QUICKSTART.md](frontend/docs/LOCAL_QUICKSTART.md)) is Freighter-only |
| **Lobstr** | Connection and signing dispatch wired (`signTransaction` routes to Lobstr when it is the connected wallet) | Usable for connect + subscribe/cancel signing; still less battle-tested than Freighter |
| **WalletConnect** | Sign Client wired behind the `walletConnect` feature flag (off by default); requires `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID` | Enable the flag + set a project ID for QR-based mobile wallet connect/sign. With the flag off the UI shows "Coming soon" |

Assume **Freighter is the reference implementation** and the only wallet with a guaranteed full-flow path. Lobstr and WalletConnect share the same `signTransaction` dispatch path but have had less real-world exercise. See **[frontend/docs/WALLET_SETUP.md](frontend/docs/WALLET_SETUP.md)** for the full support matrix, feature-flag config, and signing dispatch order.

### Tech

- **Next.js** (App Router or Pages as you prefer).
- **TypeScript**.
- Stellar/Soroban: **@stellar/stellar-sdk** and Soroban client usage (invoke contract, send transactions).
- State: React state or a light client store; backend can supply contract addresses and plan metadata.

---

## 3. Backend – `backend/`

### Responsibilities

- **Auth**: Sessions or JWTs; link Stellar public key to “user” (creator/fan).
- **Creator/fan APIs**: Profiles, plans metadata (mirroring or complementing on-chain plan_id), content catalog.
- **Content & IPFS**: Store content metadata and IPFS links; serve “content access” API that checks subscription via contract (e.g. call `is_subscriber` or use indexer data).
- **Indexer**: Subscribe to Soroban events or use Stellar Horizon + Soroban events to keep “subscriptions” and “payments” in DB for analytics and fast “is subscriber?” checks.
- **Notifications**: Email/in-app for new subscribers, renewals, cancellations (using indexer/events).
- **Optional**: Integrate Stellar anchors/ramps for fiat on/off-ramp.

### Tech

- **Nest.js**, **TypeScript**.
- DB: e.g. **PostgreSQL** (users, plans metadata, content, subscription cache

/* … truncated 5220 chars — edit only what you need near the top … */
