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

## Functions

### `init(admin, protocol_fee_bps, fee_recipient)`

One-time initialization. Requires `admin` auth. Reverts with
`AlreadyInitialized` on a second call and `FeeTooHigh` when
`protocol_fee_bps > 1000`.

### `create_plan(creator, asset, amount, interval) -> u64`

Requires `creator` auth. Rejects a zero `amount` (`InvalidAmount`) or zero
`interval` (`InvalidInterval`). Returns the new `plan_id`.

### `subscribe(fan, plan_id, asset)`

Requires `fan` auth. Blocked while the contract is paused. The `asset` argument
must match the plan's asset or the call reverts with `AssetMismatch` before any
charge or subscription write.

### `renew(fan, plan_id)` / `extend_subscription(fan, plan_id)`

Requires `fan` auth. Reverts with `NotSubscriber` when no subscription exists,
`PlanNotFound` on a plan mismatch, and `AssetMismatch` when the stored asset no
longer matches the plan.

### `cancel(fan, creator)`

Requires `fan` auth. Removes the subscription. No refund is issued.

### `is_subscriber(fan, creator) -> bool`

Returns `true` when the subscription exists and has not expired.

### `pause()` / `unpause()`

Admin-only. Require `admin` auth. `pause` blocks `subscribe` and `renew`.

### `set_protocol_fee(protocol_fee_bps)`

Admin-only. Requires `admin` auth. Enforces the `MAX_FEE_BPS` (1000 bps) cap.
