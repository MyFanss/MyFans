# Creator Registry Sync

This document describes how the `CreatorsModule` keeps its public creator
profiles in sync with the on-chain creator registry, and the public API
surface that discover/subscribe UIs consume.

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
