# Subscription Contract Interface

Workspace member: `contracts/subscription` (declared in `contract/Cargo.toml`).

This document is the frozen interface contract for the on-chain subscription
lifecycle. The indexer, checkout confirmation, and frontend Soroban invoke
builders MUST interoperate against the entrypoints, storage keys, and event
schema described here. Any change to a topic or body field is a breaking change
and requires a coordinated update of the backend `TARGET_EVENTS` list and the
committed event fixture (`contract/scripts/check-subscription-event-fixture.test.mjs`).

## Entrypoints

### `init(admin: Address, protocol_fee_bps: u32, fee_recipient: Address)`

- Auth: `admin` must authorize the call.
- Sets the contract admin, the protocol fee in basis points, and the treasury
  recipient used for the protocol fee split.
- `fee_recipient` MUST be the treasury contract id.
- Reverts on double-init. A failed (unauthorized) init leaves the contract
  uninitialized.
- `protocol_fee_bps` MUST be `<= MAX_FEE_BPS` (see below).

### `create_plan(creator: Address, asset: Address, amount: i128, interval_ledgers: u32) -> u32`

- Auth: `creator` must authorize the call.
- Creates a subscription plan owned by `creator` and returns its plan id.
- Rejects `amount == 0` and `interval_ledgers == 0`.
- The creator payout address is taken from plan storage; client-supplied payout
  addresses are never trusted.

### `subscribe(fan: Address, creator: Address, plan_id: u32)`

- Auth: `fan` must authorize the call.
- Transfers `amount` of the plan asset from `fan`.
- Splits the payment: `protocol_fee_bps` of the amount is routed to the
  treasury via `deposit`; the remainder is transferred to the creator.
- Reverts while the contract is paused, with no balance movement.
- Reverts on unknown plan or asset mismatch.

### `renew(fan: Address, creator: Address, plan_id: u32)` / `extend_subscription(...)`

- Auth: `fan` must authorize the call.
- Extends the subscription by one interval, performing the same fee split as
  `subscribe`.
- Reverts on wrong asset or wrong plan.
- Near `u64` ledger overflow the call returns a typed error and MUST NOT wrap.

### `cancel(fan: Address, creator: Address, plan_id: u32)`

- Auth: `fan` must authorize the call.
- Cancels the subscription effective at the current ledger. No refund is issued
  for the remainder of the period (documented behavior).
- `is_subscriber` returns `false` after the cancel effective ledger.

### `is_subscriber(fan: Address, creator: Address) -> bool`

- Read-only. Returns `true` while the subscription is active at the current
  ledger, `false` otherwise (including after cancel).

### `pause()` / `unpause()`

- Auth: `admin` must authorize the call.
- While paused, all mutating entrypoints (`subscribe`, `renew`,
  `extend_subscription`, `cancel`) revert and leave storage unchanged.

### `set_protocol_fee_bps(bps: u32)`

- Auth: `admin` must authorize the call.
- Reverts when `bps > MAX_FEE_BPS`. `10000` is never accepted.
- Unauthorized calls leave storage unchanged.

## Fee invariant

`MAX_FEE_BPS = 1000`. The protocol fee can never exceed the cap; the fee split
is enforced on every payment path.

## Storage keys

All Instance and Persistent keys are documented in `contract/STORAGE_KEYS.md`
before merge. Keys cover: admin, protocol fee bps, fee recipient (treasury),
plan records, subscription records, and pause state.

## Event schema (frozen)

Topics and body fields are frozen and consumed by the backend `TARGET_EVENTS`
list. The committed fixture in
`contract/scripts/check-subscription-event-fixture.test.mjs` is CI-enforced.

| Event | Topics | Body |
| --- | --- | --- |
| plan created | `("plan", "created")` | `(creator, plan_id, asset, amount, interval_ledgers)` |
| subscribed | `("sub", "created")` | `(fan, creator, plan_id, amount, fee, start_ledger, end_ledger)` |
| renewed | `("sub", "renewed")` | `(fan, creator, plan_id, amount, fee, end_ledger)` |
| cancelled | `("sub", "cancelled")` | `(fan, creator, plan_id, effective_ledger)` |
| paused | `("admin", "paused")` | `()` |
| unpaused | `("admin", "unpaused")` | `()` |
| fee set | `("admin", "fee")` | `(protocol_fee_bps)` |

## Auth summary

See `contract/AUTH_MATRIX.md` for the authoritative valid/invalid examples.

- `create_plan`: creator signs.
- `subscribe` / `renew` / `extend_subscription` / `cancel`: fan signs.
- `init` / `pause` / `unpause` / `set_protocol_fee_bps`: admin signs.
- Negative auth tests MUST NOT use `mock_all_auths`.

## Out of scope

NFT tiers, gift subscriptions, and off-chain card billing are not part of this
interface.
