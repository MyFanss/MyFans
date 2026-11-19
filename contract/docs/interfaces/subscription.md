# Subscription Interface

## Overview

The subscription contract lets a creator publish a recurring payment plan and lets
fans subscribe, renew, and cancel against it. Charges are settled in a SEP-41
token; the contract never holds funds.

## Events

| Topic 1 | Topic 2     | Data                                        | Emitted by       |
|---------|-------------|---------------------------------------------|------------------|
| `plan`  | `created`   | `(plan_id, creator, asset, amount, interval)` | `create_plan`  |
| `sub`   | `created`   | `(fan, creator, plan_id, expires_at)`       | `subscribe`      |
| `sub`   | `renewed`   | `(fan, creator, plan_id, expires_at)`       | `renew`          |
| `sub`   | `cancelled` | `(fan, creator)`                            | `cancel`         |

> **Topic symbol limit.** Event topic symbols are created with
> `symbol_short!` and are limited to **at most nine characters**. The contract
> currently emits exactly these symbols: `plan` / `created`, `sub` / `created`,
> `sub` / `renewed`, and `sub` / `cancelled`. Do not lengthen a symbol past nine
> characters (it will fail to compile) and do not introduce a second, longer
> symbol for the same event — indexers only recognize the symbols listed above.

### `get_config() -> Result<Config, Error>`

- Read-only. Returns the stored `Config` (admin, protocol fee bps, fee
  recipient, and pause flag) after a successful `init`.
- Returns `Error::NotInitialized` when the contract has not been initialized
  (before `init` or after a failed init) instead of panicking, so frontends can
  poll config safely.

### `create_plan(creator: Address, asset: Address, amount: i128, interval_ledgers: u32) -> u64`

- Auth: `creator` must authorize the call.
- Creates a subscription plan owned by `creator` and returns its plan id.
- Plan ids are `u64` and are allocated from `DataKey::NextPlanId`. The counter
  is incremented with `checked_add`; on overflow the call returns
  `Error::Overflow`, does not write the plan, and leaves `NextPlanId` unchanged.
- Rejects `amount == 0` and `interval_ledgers == 0`.
- The creator payout address is taken from plan storage; client-supplied payout
  addresses are never trusted.

### `subscribe(fan: Address, creator: Address, plan_id: u64)`

- Auth: `fan` must authorize the call.
- Blocked while the contract is paused.
- The `asset` argument must match the plan's asset or the call reverts with `AssetMismatch` before any charge or subscription write.
- Transfers `amount` of the plan asset from `fan`.
- Splits the payment: `protocol_fee_bps` of the amount is routed to the treasury via `deposit`; the remainder is transferred to the creator.
- Sets `expires_at` to the current ledger plus exactly one plan `interval`. No extra padding ledgers are added on top of the interval.
- Reverts while the contract is paused, with no balance movement.
- Reverts on unknown plan or asset mismatch.

### `renew(fan, plan_id)` / `extend_subscription(fan, plan_id

### `create_plan(creator, asset, amount, interval) -> u64`

### `renew(fan: Address, creator: Address, plan_id: u64)` / `extend_subscription(...)`

- Auth: `fan` must authorize the call.
- Extends the subscription by one interval, performing the same fee split as
  `subscribe`.
- The new `expires_at` is `max(current ledger, stored expires_at) + interval`.
  Renewing before expiry preserves the unused time already paid for; renewing
  after expiry starts a fresh period from the current ledger. Only the plan
  `interval` is added — no extra padding ledgers.
- Reverts on wrong asset or wrong plan.
- A `plan_id` that does not match the fan's stored subscription returns
  `Error::WrongPlan` and does not move tokens. `Error::PlanNotFound` is
  reserved for a missing `DataKey::Plan` record.
- Near `u64` ledger overflow the call returns a typed error (`Error::Overflow`)
  and MUST NOT wrap. The expiry math is computed before any token transfer, so
  an overflowing renew moves no tokens.

### `cancel(fan: Address, creator: Address, plan_id: u64)`

- Auth: `fan` must authorize the call.
- Records the cancellation ledger (`cancelled_at`) on the subscription record
  and keeps the row until `expires_at`. The row is NOT deleted on cancel.
- No refund is issued for the remainder of the period and no tokens move
  (documented behavior).
- Access continues until the stored `expires_at`; `is_subscriber` stays `true`
  until expiry and becomes `false` after the expiry ledger.
- Reverts with `NotSubscriber` when no subscription row exists for
  `(fan, creator)`.
- Reverts while the contract is paused, leaving storage unchanged.

Requires `fan` auth. Reverts with `NotSubscriber` when no subscription exists,
`PlanNotFound` on a plan mismatch, and `AssetMismatch` when the stored asset no
longer matches the plan.

### `cancel(fan, creator)`

Requires `fan` auth. Removes the subscription. No refund is issued.

### `is_subscriber(fan, creator) -> bool`

- Read-only. Returns `true` while the subscription is active at the current
  ledger (`expires_at > sequence`), `false` otherwise (including after the
  stored expiry). A recorded cancellation does not end access early; access
  ends at `expires_at`.

### `pause()` / `unpause()`

- Auth: `admin` must authorize the call.
- While paused, all mutating entrypoints (`subscribe`, `renew`,
  `extend_subscription`, `cancel`) revert and leave storage unchanged.
- On a successful state change, `pause` emits exactly one `("admin", "paused")`
  event and `unpause` emits exactly one `("admin", "unpaused")` event, after the
  pause flag is written.
- Calling `pause` while already paused (or `unpause` while already unpaused) is
  a no-op: the flag is unchanged and no event is emitted.
- An unauthorized call reverts, emits nothing, and leaves the pause flag
  unchanged.

### `set_protocol_fee_bps(bps: u32) -> Result<(), Error>`

- Auth: `admin` must authorize the call.
- Returns `Error::FeeTooHigh` when `bps > MAX_FEE_BPS`. `10000` is never
  accepted. A rejected rate leaves the previous rate in place and emits no
  event.
- On success, writes the new rate and emits exactly one `fee set` event (see
  the event schema below) carrying the new basis points and the current fee
  recipient.
- Unauthorized calls leave storage unchanged and emit no event.

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

This table is the single authoritative schema. `contracts/subscription/src/types.rs`
mirrors these topics and field order (see `SubscriptionEvent`); `lib.rs` emits
exactly these topics and bodies. A mismatch in either file is a bug.

| Event | Topics | Body |
| --- | --- | --- |
| plan created | `("plan", "created")` | `(creator, plan_id, asset, amount, interval_ledgers)` |
| subscribed | `("sub", "created")` | `(fan, creator, plan_id, amount, fee, start_ledger, end_ledger)` |
| renewed | `("sub", "renewed")` | `(fan, creator, plan_id, amount, fee, end_ledger)` |
| cancelled | `("sub", "cancelled")` | `(fan, creator, plan_id, effective_ledger)` |
| paused | `("admin", "paused")` | `()` |
| unpaused | `("admin", "unpaused")` | `()` |
| fee set | `("admin", "fee")` | `(protocol_fee_bps, fee_recipient)` |

## Auth summary

See `contract/AUTH_MATRIX.md` for the authoritative valid/invalid examples.

- `create_plan`: creator signs.
- `subscribe` / `renew` / `extend_subscription` / `cancel`: fan signs.
- `init` / `pause` / `unpause` / `set_protocol_fee_bps`: admin signs.
- Negative auth tests MUST NOT use `mock_all_auths`.

## Out of scope

NFT tiers, gift subscriptions, and off-chain card billing are not part of this
interface.
