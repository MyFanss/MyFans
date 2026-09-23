# Creator Registry Sync (#1747)

Keeps the off-chain `CreatorProfile` (`creators` table) in sync with the
on-chain [`creator-registry`](../../contract/docs/interfaces/creator-registry.md)
Soroban contract, via a `creator_onchain_mappings` table and an idempotent
event-sync worker.

This document describes how the `CreatorsModule` keeps its public creator
profiles in sync with the on-chain creator registry, and the public API
surface that discover/subscribe UIs consume.

## Public API surface

Discover and creator pages need a canonical creator identity. The on-chain
registry and the backend's `CreatorProfile` are independent sources of truth
keyed differently (Stellar address vs. internal UUID). Without registry events
that the backend can idempotently sync, profiles drift from chain and fake
creators appear.

## On-chain contract

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

## Public API surface

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

## Registry sync worker

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

## Seed script compatibility

The seed script writes rows using the same public field shape the API exposes,
so seeded data flows through the same serializer and allowlist as synced data.

## Tests

- `backend/test/creators.e2e-spec.ts` covers list, get-by-id, get-by-handle,
  live search, empty search, and injection-safety cases.
- Sync idempotency is verified by replaying events and asserting stable row
  state.

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

## Registry sync worker

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

## Seed script compatibility

The seed script writes rows using the same public field shape the API exposes,
so seeded data flows through the same serializer and allowlist as synced data.

## Tests

- `backend/test/creators.e2e-spec.ts` covers list, get-by-id, get-by-handle,
  live search, empty search, and injection-safety cases.
- Sync idempotency is verified by replaying events and asserting stable row
  state.
