# Creator Registry Sync (#1747, #1864)

Keeps the off-chain `CreatorProfile` (`creators` table) in sync with the
on-chain [`creator-registry`](../../contract/docs/interfaces/creator-registry.md)
Soroban contract, via a `creator_onchain_mappings` table and an idempotent
event-sync worker.

This document describes how the `CreatorsModule` keeps its public creator
profiles in sync with the on-chain creator registry, the public API
surface that discover/subscribe UIs consume, and the **single-source payout wallet invariant**.

---

## 1. Creator Payout Wallet Single-Source Invariant (#1864)

### Problem Statement & Invariant
Dual payout fields (e.g., `payoutAddress` vs `payoutWallet`, or off-chain vs dashboard split destinations) introduce a critical funds bug class where payments can be routed to the wrong address. To prevent this, MyFans enforces a **strict single-source invariant**:

- **One Canonical Field**: `payoutWallet` is the **exclusive** canonical field for creator payout destinations across the entire system (API, database, settings, dashboard, and registry sync).
- **Prohibition of Dual Fields**: Any secondary or legacy payout fields (`payoutAddress`, `payout_address`, `recipient_wallet`) are strictly prohibited, stripped by NestJS validation pipes (`whitelist: true`), and must never be introduced.

### Cross-Layer Alignment
1. **Settings (`/settings`)**: Users read and write only `payoutWallet` via `PATCH /api/v1/settings`.
2. **Dashboard (`/dashboard`)**: Earnings withdrawals (`POST /api/v1/earnings/withdraw/prepare`) route funds exclusively to the verified `payoutWallet`.
3. **Registry Sync**: The idempotent event-sync worker ingests on-chain creator registry events and maps them directly to `payoutWallet`.

### Edge Cases & Failure Modes
- **Concurrent Edits**: When a creator updates their payout wallet in settings simultaneously with an on-chain registry event, the backend applies optimistic locking / last-write-wins with server timestamp verification. Out-of-order writes trigger a `409 Conflict` error requiring a refresh.
- **On-Chain vs Off-Chain Mismatch Policy**: The on-chain Soroban contract serves as the ultimate source of truth. If off-chain settings diverge from the on-chain registry state (due to pending transactions or propagation lag), background reconciliation flags the mismatch and the UI renders a warning banner until re-synced.

### Security Considerations
- **Challenge Reauth**: Sensitive payout wallet mutations optionally support cryptographic challenge-response re-authentication (signing a fresh server-issued nonce with the creator's Freighter/Stellar wallet).
- **Truncated Address & Copy Safeguards**: Addresses are displayed in truncated form (`GABC…XYZ1`) combined with a secure copy-to-clipboard action that prevents clipboard tampering and provides explicit visual confirmation ("Copied to clipboard").

---

## 2. On-Chain Contract

The `creator-registry` contract exposes:

- `register(creator, metadata_hash_or_uri)` — requires creator auth. Stores
  only a hash or CID; raw PII is never written on-chain. A second `register`
  from the same creator is treated as an update (see below) rather than a
  revert, so re-registration is safe.
- `update(creator, metadata_hash_or_uri)` — requires creator auth. Reverts if
  the caller is not the registered owner. Emits `CreatorUpdated`.
- `force_suspend(creator, suspended)` — optional admin flag for the moderation
  bridge. Gated by off-chain RBAC; the on-chain flag is advisory only.

### Events

Both `register` and `update` emit a versioned event so the backend can sync
forward-compatibly:

- `CreatorRegistered` / `CreatorUpdated`
- Fields: `schema_version` (u32, currently `1`), `creator`, `metadata_hash_or_uri`,
  `suspended` (bool), and the ledger identity `ledger_seq` + `event_index`.

The pair `ledger_seq:event_index` is the event's canonical identity and is used
for idempotent backend ingestion.

### Edge cases

- **Double register** → treated as an update (documented above); no revert.
- **Update by non-owner** → revert.
- **Malformed metadata URI** → rejected; callers may pass a hash-only value.
- **Duplicate event delivery** → single row (see idempotency below).

### Mapping and drift

The on-chain registry (`register_creator(caller, creator_address, creator_id)`)
and the backend's `CreatorProfile` are independent sources of truth keyed
differently (Stellar address vs. internal UUID). Without an explicit mapping
and drift check, the two can silently diverge (e.g. a creator re-registers with
a new `creator_id`, or a registration transaction fails after the backend
already recorded it as successful).

---

## 3. Public API Surface

All endpoints below return **public profile fields only**. Private fields
(e.g. `email`, payout secrets) are never serialized by default.

| Method | Path | Description |
| ------ | ---- | ----------- |
| `GET`  | `/creators` | List public creator profiles (paginated). |
| `GET`  | `/creators/:id` | Fetch a single public profile by id. |
| `GET`  | `/creators/handle/:handle` | Fetch a single public profile by handle. |
| `GET`  | `/creators/search?q=` | Live search over public profiles. |

### Public field allowlist

The serializer emits only the following fields:

- `id`
- `handle`
- `displayName`
- `bio`
- `avatarUrl`
- `payoutWallet` (single source of truth for payouts)
- `createdAt`
- `updatedAt`

`email` and any other private column are **excluded by default**. If a future
feature needs an authenticated view, it must opt in explicitly rather than
widening this allowlist.

### Search

`GET /creators/search?q=<term>` performs a case-insensitive match against
`handle` and `displayName`.

- **Empty search**: a missing or blank `q` returns an empty result set with a
  `200` status — never an error.
- **Injection safety**: the term is always passed as a bound parameter to the
  query builder; it is never interpolated into SQL. Wildcard characters are
  escaped before being wrapped in `%...%`.
- **Rate limiting**: the search route is rate limited to protect the registry
  from scraping and abuse.

---

## 4. Registry Sync Worker

The sync worker consumes creator registry events and upserts the corresponding
public profile rows.

### Upsert semantics

- Events are keyed by creator id (and handle).
- Upserts are **idempotent**: replaying the same event produces the same row
  state and does not create duplicates.
- `payoutWallet` is written from the registry event and is the single source of
  truth for payout routing.

### Sync lag

Because the worker is event-driven, there is an inherent propagation delay
between an on-chain registry change and its visibility through the public API.
Consumers should treat the API as eventually consistent. The worker records the
last processed event so it can resume after restarts without skipping or
double-applying events.

---

## 5. Seed Script Compatibility

The seed script writes rows using the same public field shape the API exposes,
so seeded data flows through the same serializer and allowlist as synced data.

---

## 6. Tests

- `backend/test/creators.e2e-spec.ts` covers list, get-by-id, get-by-handle,
  live search, empty search, injection-safety cases, and single-source payout wallet invariant enforcement.
- Sync idempotency is verified by replaying events and asserting stable row state.
