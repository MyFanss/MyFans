# MyFans – Decentralized Content Subscription Platform (Stellar)

**MyFans** is a decentralized content subscription platform built on **Stellar** and **Soroban**. It lets creators monetize their work with on-chain subscriptions, direct payments, and transparent revenue—using Stellar’s speed, low cost, and multi-currency support.

---

## Why Stellar (Improved Over L1/Other Chains)

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
│   management    │                         │                             │
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

- `init(admin, protocol_fee_bps, fee_recipient)` – set fee (e.g. basis points) and recipient.
- `create_plan(creator, asset, amount, interval_days)` – define a subscription plan.
- `subscribe(fan, plan_id, duration)` – fan subscribes; payment transferred to creator minus fee.
- `renew(subscription_id)` – renew if within allowed window.
- `cancel(subscription_id)` – cancel; no refund of current period (or implement refund rules in contract).
- `is_subscriber(fan, creator)` → bool (and optionally expiry).
- Events for: subscription_created, payment_received, subscription_cancelled (for indexer/backend).

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
- DB: e.g. **PostgreSQL** (users, plans metadata, content, subscription cache).
- **Stellar SDK** / Soroban RPC client to query contract state.
- Optional: message queue (e.g. Bull/Redis) for event processing.

---

## Data Flow (High Level)

1. **Creator** sets a plan on-chain (contract) and optionally registers plan metadata in backend.
2. **Fan** chooses a plan in frontend; frontend builds Soroban `subscribe` tx; fan signs with Stellar wallet; contract executes payment and updates subscription state.
3. **Backend** indexes contract events (or polls contract), updates DB; when fan requests gated content, backend checks DB or calls contract to confirm `is_subscriber`.
4. **Frontend** shows “Subscribed until …” and unlocks content links or embeds based on backend response.

---

## Tech Stack Summary

| Layer | Technologies |
|-------|----------------|
| Chain & contracts | Stellar, Soroban, Rust, soroban-sdk, stellar-cli |
| Frontend | Next.js, TypeScript, Stellar SDK, wallet integration |
| Backend | Nest.js, TypeScript, PostgreSQL (or similar), Stellar/Soroban RPC, IPFS (metadata/refs) |
| Storage | IPFS (content refs), DB (metadata, indexer cache) |

---

## Development Milestones (Stellar Version)

1. **Contract**
   - Implement subscription lifecycle (create plan, subscribe, renew, cancel).
   - Implement payment split (creator + protocol fee) for one asset, then multi-asset.
   - Emit events; add access control (`is_subscriber`).
   - Unit tests; deploy to testnet.

2. **Backend**
   - Nest.js project; auth (Stellar key ↔ user); CRUD for creators, plans metadata, content.
   - Integrate Soroban RPC; event indexer or polling; “is subscriber?” API.
   - IPFS for content refs; optional notifications.

3. **Frontend**
   - Next.js; wallet connect; creator dashboard (create plan, view earnings); fan flow (discover, subscribe, manage subscriptions).
   - Use backend for metadata and access checks; use contract for tx signing and state.

4. **Integration**
   - End-to-end: create plan → subscribe → access gated content.
   - Optional: fiat on-ramp (anchor) so fans can pay with card.

5. **Launch**
   - Testnet beta; security review; mainnet deployment; docs and community.

---

## Getting Started (After Initialization)

- **Contract**: `cd contract && cargo build && soroban contract test` (and deploy with soroban-cli).
- **Backend**: `cd backend && npm i && npm run start:dev`.
- **Frontend**: `cd frontend && npm i && npm run dev`.

---

## License

MIT.

---

## Contact

- Email: realjaiboi70@gmail.com

This README describes the improved Stellar-based MyFans design. Implement each module (contract, backend, frontend) step by step and remove any other files in the repo as needed.
