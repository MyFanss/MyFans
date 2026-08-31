# Treasury Contract

A Soroban contract that holds platform funds, enforces an admin-controlled minimum balance, and supports pause/unpause for emergency stops.

## Fee configuration is immutable here

The treasury contract has **no fee parameter** — the protocol fee is configured entirely in the
[subscription contract](../subscription/README.md):

- `init(admin, fee_bps, fee_recipient, ...)` and `set_fee_bps` are **admin-only** and the fee is
  **capped at `MAX_FEE_BPS = 1_000` (10%)**.
- `fee_recipient` must be this treasury contract. When a fan subscribes, the subscription
  contract calls `deposit(from, amount)` here, so the fee flows through the treasury's own
  deposit path (pause honored, `deposit` event emitted).
- Funds accumulated here can only leave via `withdraw`, which requires the **admin** and
  respects `min_balance`.

## Public Functions

### `initialize(env, admin, token_address)`

One-time setup. Stores the admin address and the token address, and sets defaults (`paused = false`, `min_balance = 0`).

- Requires authorization from `admin`.
- Panics with `NotInitialized` (code 5) if called a second time.

### `set_paused(env, paused)`

Pause (`true`) or unpause (`false`) the contract. While paused, `deposit` and `withdraw` are both rejected.

- Requires authorization from the admin.

### `set_min_balance(env, amount)`

Set the minimum token balance the contract must retain after any withdrawal.

- `amount` must be ≥ 0; negative values panic with `NegativeMinBalance` (code 1).
- Requires authorization from the admin.

### `deposit(env, from, amount)`

Transfer `amount` tokens from `from` into the treasury.

- `amount` must be > 0 (`InvalidAmount`, code 6).
- Contract must not be paused (`Paused`, code 2).
- Requires authorization from `from`.
- Emits a `deposit` event: `(from, amount, token_address)`.

### `withdraw(env, to, amount)`

Transfer `amount` tokens from the treasury to `to`.

- `amount` must be > 0 (`InvalidAmount`, code 6).
- Contract must not be paused (`Paused`, code 2).
- Treasury balance must be ≥ `amount` (`InsufficientBalance`, code 3).
- Remaining balance after withdrawal must be ≥ `min_balance` (`MinBalanceViolation`, code 4).
- Requires authorization from the admin.
- Emits a `withdraw` event: `(to, amount, token_address)`.

### `admin(env) -> Address`

Returns the configured admin address.

- Panics with `NotInitialized` (code 5) if the contract was never initialized.

### `token(env) -> Address`

Returns the token address accepted by the treasury.

- Panics with `NotInitialized` (code 5) if the contract was never initialized.

### `set_admin(env, new_admin)`

Rotate the admin to a new address.

- Only the current admin may authorize this call.
- Panics with `NotInitialized` (code 5) if the contract was never initialized.
- Emits an `admin_transferred` event with `(current_admin, new_admin)`.

## Storage Layout

All keys use the `DataKey` enum (instance storage):

| Key | Type | Description |
|-----|------|-------------|
| `DataKey::Admin` | `Address` | Contract admin |
| `DataKey::Token` | `Address` | Token contract address |
| `DataKey::Paused` | `bool` | Pause flag |
| `DataKey::MinBalance` | `i128` | Minimum balance guard |

## Error Codes

| Code | Variant | Meaning |
|------|---------|---------|
| 1 | `NegativeMinBalance` | `min_balance` must be ≥ 0 |
| 2 | `Paused` | Contract is paused |
| 3 | `InsufficientBalance` | Balance < requested withdrawal amount |
| 4 | `MinBalanceViolation` | Withdrawal would leave balance below `min_balance` |
| 5 | `NotInitialized` | Contract was never initialized (or re-init attempted) |
| 6 | `InvalidAmount` | Deposit or withdrawal amount must be > 0 |

## Building and Testing

```bash
# Run tests
cargo test --package treasury

# Build wasm release
cargo build --package treasury --target wasm32-unknown-unknown --release
```
