# Creator Registry Sync (#1747)

Keeps the off-chain `CreatorProfile` (`creators` table) in sync with the
on-chain [`creator-registry`](../../contract/docs/interfaces/creator-registry.md)
Soroban contract, via a `creator_onchain_mappings` table and an idempotent
event-sync worker.

## Why

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

## Components

- **Entity**: `backend/src/creators/entities/creator-onchain-mapping.entity.ts`
  — one row per creator: `creator_id` (FK → `creators.id`), `stellar_address`,
  `onchain_creator_id`, `metadata_hash_or_uri`, `suspended`, `last_synced_at`,
  `drift_detected_at`.
- **Migration**: `backend/src/creators/1749000000000-CreateCreatorOnchainMappings.ts`.
- **Service**: `backend/src/creators/creator-registry-sync.service.ts`
  (`CreatorRegistrySyncService`):
  - `syncOnOnboard(creatorId, stellarAddress, onchainCreatorId)` — upserts the
    mapping. Call this right after `creator-registry.register` succeeds during
    onboarding.
  - `applyRegistryEvent(event)` — upserts the creator by `pubkey` and records
    the event identity. Idempotent on `ledger_seq:event_index`: a duplicate
    delivery is a no-op and yields a single row.
  - `reconcile(dryRun?)` — re-checks every mapped creator's on-chain state and
    flags rows where it disagrees with what's stored (`drift_detected_at`).
    Runs hourly via `@Cron` (see `CREATOR_REGISTRY_RECONCILER_DRY_RUN` env var
    to run without persisting), mirroring `SubscriptionReconcilerService`.
- **Sync worker/poller**: `backend/src/creators/creator-registry-event.poller.ts`
  — polls the contract's events, decodes `schema_version`, and calls
  `applyRegistryEvent` for each. Unknown `schema_version` values are logged and
  skipped rather than crashing the worker.
- **Endpoint**: `POST /v1/creators/:creatorId/onchain-sync` — thin wrapper
  around `syncOnOnboard` for the onboarding flow.

## Public profile API

The public creator profile response exposes the synced fields
(`stellar_address`, `metadata_hash_or_uri`, `suspended`) so discover and
creator pages serve canonical, chain-derived identity. `suspended` creators are
omitted from public listings.

## Current limitation

`CreatorRegistrySyncService.queryOnchainCreatorId()` is currently a stub
(always returns `null`), matching the same convention as
`SubscriptionReconcilerService.queryChainExpiry()`. Wiring it up to a real
Soroban contract read (via `SorobanRpcService`, following the pattern in
`SubscriptionChainReaderService`) against the deployed `creator-registry`
contract is tracked as follow-up work — until then, `reconcile()` will flag
every mapped creator as drifted, so treat its output as informational rather
than actionable in production.
