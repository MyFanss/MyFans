# Ledger Time vs Server Clock Skew Handling

## Problem

The Soroban subscription contract stores expiry as a **ledger sequence number**, not a Unix timestamp. Stellar produces roughly one ledger every 5 seconds, but the exact cadence drifts. This means:

- `expiry = current_ledger_seq + interval_days * 17280` is an approximation.
- The backend and frontend were comparing this ledger-sequence-derived expiry against `Date.now()` / server wall clock, producing incorrect "expires in X days" UI and wrong `is_subscriber` results near the boundary.

## Solution

### Contract (`contract/contracts/subscription/src/lib.rs`)

Added `get_expiry_unix(fan, creator) -> (u64, u64)`:
- Returns `(expiry_ledger_seq, expiry_unix_timestamp)`.
- `expiry_unix_timestamp` is derived from `env.ledger().timestamp()` (the actual on-chain close time) anchored to the current ledger sequence.
- Formula: `expiry_unix = current_ts + (expiry_seq - current_seq) * 5`

### Backend (`backend/src/subscriptions/`)

**`LedgerClockService`** (`ledger-clock.service.ts`):
- Fetches the latest ledger from Horizon (`/ledgers?order=desc&limit=1`).
- Computes `skewMs = ledgerCloseTimeMs - Date.now()`.
- Exposes `ledgerSeqToUnix(seq, snapshot)` and `ledgerNowUnix(snapshot)`.

**`SubscriptionChainReaderService`** (`subscription-chain-reader.service.ts`):
- Added `readExpiryUnix(contractId, fan, creator)` which calls `get_expiry_unix` on-chain and cross-checks with the `LedgerClockService` snapshot.
- Returns `{ expiryUnix, expiryLedgerSeq, skewMs }`.

### Frontend (`frontend/src/`)

**`useClockSkew`** (`hooks/useClockSkew.ts`):
- Fetches Horizon ledger close time on mount, refreshes every 60 s.
- Exposes `skewMs`, `ledgerSeqToUnix`, `ledgerNowUnix`.

**`ExpiryDisplay`** (`components/subscription/ExpiryDisplay.tsx`):
- Renders subscription expiry relative to **ledger now** (skew-corrected), not browser wall clock.
- Shows a loading skeleton while skew is fetching.
- Falls back to wall-clock display with a `⚠` indicator if Horizon is unreachable.
- Tooltip shows ISO expiry, ledger sequence, and skew in ms.

## Manual Checklist

1. Subscribe to a plan on testnet.
2. Open the subscription card — `ExpiryDisplay` should show "Expires in Xd" matching the on-chain ledger time, not the browser clock.
3. Hover the expiry label — tooltip should show ledger sequence and skew (e.g. `Ledger skew: -200ms`).
4. Disconnect from the internet / block Horizon — expiry should fall back to wall-clock with `⚠`.
5. Call `GET /subscriptions/state?fan=...&creator=...` — response should include `chain.expiryUnix` and `chain.skewMs`.

## Tests

| Layer    | File                                              | Coverage                                      |
|----------|---------------------------------------------------|-----------------------------------------------|
| Contract | `subscription/src/test.rs`                        | `get_expiry_unix` active, expired, no-sub     |
| Backend  | `ledger-clock.service.spec.ts`                    | skew calc, seq→unix, ledgerNow, fetch errors  |
| Frontend | `hooks/__tests__/useClockSkew.test.ts`            | hook states, utility functions                |
| Frontend | `components/subscription/ExpiryDisplay.test.tsx`  | active, expired, skew applied, loading, error |
