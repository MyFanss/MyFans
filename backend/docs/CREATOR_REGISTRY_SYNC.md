# Creator Registry Sync (#1454)

Keeps the off-chain `CreatorProfile` (`creators` table) in sync with the
numeric `creator_id` registered on-chain in the
[`creator-registry`](../../contract/docs/interfaces/creator-registry.md)
Soroban contract, via a new `creator_onchain_mappings` table.

## Why

The on-chain registry (`register_creator(caller, creator_address, creator_id)`)
and the backend's `CreatorProfile` are independent sources of truth keyed
differently (Stellar address vs. internal UUID). Without an explicit mapping
+ drift check, the two can silently diverge (e.g. a creator re-registers with
a new `creator_id`, or a registration transaction fails after the backend
already recorded it as successful).

## Components

- **Entity**: `backend/src/creators/entities/creator-onchain-mapping.entity.ts`
  — one row per creator: `creator_id` (FK → `creators.id`), `stellar_address`,
  `onchain_creator_id`, `last_synced_at`, `drift_detected_at`.
- **Migration**: `backend/src/creators/1749000000000-CreateCreatorOnchainMappings.ts`.
- **Service**: `backend/src/creators/creator-registry-sync.service.ts`
  (`CreatorRegistrySyncService`):
  - `syncOnOnboard(creatorId, stellarAddress, onchainCreatorId)` — upserts the
    mapping. Call this right after `creator-registry.register_creator`
    succeeds during onboarding.
  - `reconcile(dryRun?)` — re-checks every mapped creator's on-chain
    `creator_id` and flags rows where it disagrees with what's stored
    (`drift_detected_at`). Runs hourly via `@Cron` (see
    `CREATOR_REGISTRY_RECONCILER_DRY_RUN` env var to run without persisting),
    mirroring `SubscriptionReconcilerService`.
  - **Drift metric**: every `reconcile()` run records the latest drift count
    via `BusinessMetricsService.recordCreatorRegistryDrift()`, exposed as the
    `myfans_creator_registry_drift_count` Prometheus gauge so divergence is
    observable in dashboards.
- **Endpoint**: `POST /v1/creators/:creatorId/onchain-sync` — thin wrapper
  around `syncOnOnboard` for the onboarding flow.

## Current limitation

`CreatorRegistrySyncService.queryOnchainCreatorId()` is currently a stub
(always returns `null`), matching the same convention as
`SubscriptionReconcilerService.queryChainExpiry()`. Wiring it up to a real
Soroban contract read (via `SorobanRpcService`, following the pattern in
`SubscriptionChainReaderService`) against the deployed `creator-registry`
contract's `get_creator_id` is tracked as follow-up work — until then,
`reconcile()` will flag every mapped creator as drifted, so treat its output
as informational rather than actionable in production.
