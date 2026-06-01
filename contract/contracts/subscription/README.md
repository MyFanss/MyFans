# Subscription Contract

Soroban smart contract for managing creator subscriptions on MyFans.
Located in `contract/contracts/subscription/`.

---

## Data Types

### `Plan`

```rust
pub struct Plan {
    pub creator: Address,
    pub asset: Address,
    pub amount: i128,
    pub interval_days: u32,
}
```

A recurring billing plan created by a content creator.

### `Subscription`

```rust
pub struct Subscription {
    pub fan: Address,
    pub plan_id: u32,  // 0 for direct (plan-less) subscriptions
    pub expiry: u64,   // ledger sequence at which the subscription expires
}
```

---

## Error Codes

| Code | Variant | Description |
|------|---------|-------------|
| 1 | `AlreadyInitialized` | `init` was called more than once |
| 2 | `Paused` | Contract is paused; state-changing calls are rejected |
| 3 | `SubscriptionNotFound` | No subscription record for `(fan, creator)` |
| 4 | `SubscriptionExpired` | Subscription exists but its expiry ledger has passed |
| 5 | `AdminNotInitialized` | Admin key not present; contract was never initialized |
| 6 | `InvalidFeeRecipient` | Fee recipient is the Stellar null/burn address |
| 7 | `InvalidFeeBps` | Fee basis points exceed 10 000 (100%) |
| 8 | `InvalidTokenAddress` | Token address is the Stellar null/burn address |
| 9 | `InvalidPrice` | Subscription price must be strictly positive |

---

## Public Functions

### `init`

```rust
pub fn init(
    env: Env,
    admin: Address,
    fee_bps: u32,
    fee_recipient: Address,
    token: Address,
    price: i128,
)
```

One-time contract initialization. Stores admin, fee configuration, token address, and base subscription price.

**Panics** with `AlreadyInitialized` if called again, `InvalidFeeBps` if `fee_bps > 10_000`,
`InvalidTokenAddress` if `token` is the Stellar null address, or `InvalidPrice` if `price <= 0`.

---

### `create_plan`

```rust
pub fn create_plan(
    env: Env,
    creator: Address,
    asset: Address,
    amount: i128,
    interval_days: u32,
) -> u32
```

Registers a new billing plan for `creator`. Returns the assigned `plan_id` (auto-incremented from 1).
Requires `creator` authorization. Panics with `Paused` if the contract is paused.

**Event** `plan_created` — topics: `(name, creator)`, data: `plan_id`

---

### `subscribe`

```rust
pub fn subscribe(env: Env, fan: Address, plan_id: u32, _token: Address)
```

Subscribes `fan` to an existing plan. Transfers `plan.amount` tokens from `fan` to `plan.creator`
(minus protocol fee) and to the fee recipient. Expiry is set to
`current_sequence + interval_days * 17_280`.

Requires `fan` authorization. Panics with `Paused` if the contract is paused.

**Event** `subscribed` — topics: `(name, fan, creator)`, data: `plan_id`

---

### `create_subscription`

```rust
pub fn create_subscription(
    env: Env,
    fan: Address,
    creator: Address,
    duration_ledgers: u32,
)
```

Direct (plan-less) subscription. Charges the global `price` stored at `init` and sets expiry to
`current_sequence + duration_ledgers`. Increments `CreatorSubscriptionCount` for `creator`.

Requires `fan` authorization. Panics with `Paused` if the contract is paused.

**Event** `subscribed` — topics: `(name, fan, creator)`, data: `0u32` (no plan)

---

### `extend_subscription`

```rust
pub fn extend_subscription(
    env: Env,
    fan: Address,
    creator: Address,
    extra_ledgers: u32,
    token: Address,
)
```

Extends an active subscription by `extra_ledgers`. Charges `plan.amount` again.
Panics with `SubscriptionNotFound`, `SubscriptionExpired`, or `Paused` as applicable.

Requires `fan` authorization.

**Event** `extended` — topics: `(name, fan, creator)`, data: `plan_id`

---

### `cancel`

```rust
pub fn cancel(env: Env, fan: Address, creator: Address, reason: u32)
```

Cancels `fan`'s subscription to `creator` and removes the storage entry.

`reason` codes (convention — not enforced on-chain):

| Code | Meaning |
|------|---------|
| 0 | User-initiated |
| 1 | Too expensive |
| 2 | Content quality |
| 3 | Switching creator |
| 4 | Other |

Requires `fan` authorization. Panics with `Paused` if the contract is paused.

**Event** `cancelled` — topics: `(name, fan, creator)`, data: `(true, reason)`

---

### `pause`

```rust
pub fn pause(env: Env)
```

Pauses the contract. All state-changing operations (`create_plan`, `subscribe`,
`create_subscription`, `extend_subscription`, `cancel`) will fail while paused.
View functions remain available.

Requires admin authorization.

**Event** `paused` — topics: `(name,)`, data: `admin`

---

### `unpause`

```rust
pub fn unpause(env: Env)
```

Resumes normal contract operation after a pause.

Requires admin authorization.

**Event** `unpaused` — topics: `(name,)`, data: `admin`

---

### `set_fee_recipient`

```rust
pub fn set_fee_recipient(env: Env, new_fee_recipient: Address)
```

Rotates the protocol fee recipient. Rejects the Stellar null/burn address.

Requires admin authorization.

**Event** `fee_recipient_updated` — topics: `(name, old_recipient, new_recipient)`, data: `()`

---

### `set_fee_bps`

```rust
pub fn set_fee_bps(env: Env, new_fee_bps: u32)
```

Updates the protocol fee in basis points. `new_fee_bps` must be ≤ 10 000.

Requires admin authorization.

**Event** `fee_updated` — topics: `(name,)`, data: `(old_bps, new_bps)`

---

### `admin`

```rust
pub fn admin(env: Env) -> Address
```

Returns the admin address. No authorization required.
Panics with `AdminNotInitialized` if the contract was never initialized.

---

### `is_subscriber`

```rust
pub fn is_subscriber(env: Env, fan: Address, creator: Address) -> bool
```

Returns `true` if `fan` has an active (non-expired) subscription to `creator`.
No authorization required.

---

### `is_paused`

```rust
pub fn is_paused(env: Env) -> bool
```

Returns `true` if the contract is currently paused. No authorization required.

---

### `get_expiry_unix`

```rust
pub fn get_expiry_unix(env: Env, fan: Address, creator: Address) -> (u64, u64)
```

Returns `(expiry_ledger_sequence, expiry_unix_timestamp)` for the subscription.
The unix timestamp is derived from the on-chain ledger timestamp at call time,
avoiding server-clock skew (5 seconds per ledger is used for conversion).

Returns `(0, 0)` if no subscription exists. No authorization required.

---

### `ping`

```rust
pub fn ping(env: Env) -> u32
```

Health-check / connectivity probe. Returns the current ledger sequence number.
A stale or non-advancing sequence indicates an RPC node problem.
No authorization required; safe to call before `init`.

Suggested HTTP mapping:
- Successful invocation → `200 OK`
- Invocation error / RPC unreachable → `503 Service Unavailable`

---

## Events Reference

| Event | Topics | Data |
|-------|--------|------|
| `plan_created` | `(name, creator)` | `plan_id: u32` |
| `subscribed` | `(name, fan, creator)` | `plan_id: u32` (0 for direct sub) |
| `extended` | `(name, fan, creator)` | `plan_id: u32` |
| `cancelled` | `(name, fan, creator)` | `(true, reason: u32)` |
| `paused` | `(name,)` | `admin: Address` |
| `unpaused` | `(name,)` | `admin: Address` |
| `fee_recipient_updated` | `(name, old, new)` | `()` |
| `fee_updated` | `(name,)` | `(old_bps: u32, new_bps: u32)` |

---

## Running Tests

```bash
cd contract
cargo test -p subscription --features testutils
```

### Test Coverage

Unit tests (`src/test.rs`):
- Full subscribe flow with fee calculation
- Direct subscription payment flow (`create_subscription`)
- Extend subscription: expiry update and payment
- Cancel subscription and storage removal
- Snapshot/restore state consistency (subscription, protocol config, pause state)
- Pause enforcement across all mutating functions
- View availability while paused
- Event field validation for all events
- Cancel reason code propagation
- `get_expiry_unix` for active, expired, and missing subscriptions
- `admin()` view correctness and auth-free access
- `ping()` health check with and without init
- `set_fee_recipient` / `set_fee_bps` authorization and validation

Integration tests (`tests/`):
- `contract_integration.rs` — cross-contract flows
- `auth_matrix.rs` — authorization matrix across all entry points
