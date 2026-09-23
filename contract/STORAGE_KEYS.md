# Contract Storage Key Naming

This document is the source of truth for storage key naming across the deployed MyFans Soroban contracts.

## Compatibility Rule

For deployed Soroban contracts, `DataKey` variant names are part of the serialized storage key shape. Renaming an existing variant can break reads for already-written on-chain state.

Because of that:

- Existing deployed `DataKey` variants are treated as storage-compatible identifiers and must not be renamed in place.
- Naming cleanup should happen through documentation, comments, and helper constructors when a legacy variant name is shorter or less consistent than the canonical name we want going forward.
- New storage keys should use descriptive names and avoid abbreviations unless the abbreviation is already established in the same contract.

## Naming Conventions For New Keys

- Prefer full nouns over abbreviations: `Subscription`, not `Sub`.
- Use `...Address` when the stored value is specifically another contract or token address.
- Use `...Count` for counters and `...Balance` for balances.
- Use singular names for a single record and tuple payloads for composite identifiers.

## Deployed Contract Mapping

The contracts below are deployed by `contract/scripts/deploy.sh`, so their legacy names are compatibility-sensitive.

### `subscription`

| Canonical meaning | Current `DataKey` variant | Notes |
| --- | --- | --- |
| admin | `Admin` | Already canonical. |
| protocol fee bps | `FeeBps` | Already canonical. |
| fee recipient | `FeeRecipient` | Already canonical. |
| plan count | `PlanCount` | Already canonical. |
| plan record | `Plan(u32)` | Already canonical. |
| subscription record | `Sub(Address, Address)` | Legacy variant retained; canonical name is `subscription`. |
| creator subscription count | `CreatorSubscriptionCount(Address)` | Already canonical. |
| accepted token | `AcceptedToken(Address)` | Already canonical. |
| default token address | `Token` | Legacy generic name retained. Prefer `...TokenAddress` for new contracts when the value is specifically an address. |
| default price | `Price` | Already canonical in contract context. |
| paused flag | `Paused` | Already canonical. |

### `creator-registry`

| Canonical meaning | Current `DataKey` variant | Notes |
| --- | --- | --- |
| admin | `Admin` | Already canonical. |
| creator id by address | `Creator(Address)` | Already canonical. |
| caller registration ledger | `LastRegLedger(Address)` | Legacy variant retained; canonical name is `registration_ledger`. |
| address by creator id | `CreatorIdOwner(u64)` | Already canonical; reverse mapping used to enforce a globally unique `creator_id`. |

### `myfans-token`

All current variants are already descriptive and consistent:

- `Admin`
- `Name`
- `Symbol`
- `Decimals`
- `TotalSupply`
- `Balance(Address)`
- `Allowance(AllowanceValueKey)`

### `content-access`

All current variants are already descriptive and consistent:

- `Admin`
- `TokenAddress`
- `Access(Address, Address, u64)`
- `ContentPrice(Address, u64)`

### `earnings`

Current deployed variants are already short and clear in context:

- `Admin`
- `Earnings(Address)`

## Review Notes For Non-Deployed Contracts

Non-deployed or local-only contracts can be renamed more freely, but they should still follow the same conventions so future deployments do not introduce avoidable aliases.

## Upgrade Notes For Renames

When a `DataKey` variant must change, treat it as a storage migration, not a cosmetic edit:

- Never rename a deployed variant in place. Add the new variant and keep the legacy variant readable until a migration has copied and verified all existing entries.
- Record every rename here with the contract, the old variant, the new variant, and the release that introduced it, so upgrades and rollbacks can be audited.
- Keep `Instance` and `Persistent` storage usage explicit: document which variants live in instance storage versus persistent storage, and flag any variant that moves between the two as a breaking change.
- Avoid reusing a retired variant name for a different meaning; reuse silently corrupts reads for state written under the old contract.

### Rename Log

| Contract | Old variant | New variant | Release | Notes |
| --- | --- | --- | --- | --- |
| _none yet_ | | | | Add a row for every future rename. |

## Enforcement

`contract/scripts/release-check.sh` parses this document and the `DataKey` enums in each contract crate, then fails the release check when the documented keys and the `Instance`/`Persistent` usage drift apart. Update this document in the same change whenever a storage key is added, removed, or renamed.
