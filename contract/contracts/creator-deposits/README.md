# Creator Deposits Contract

Platform-managed earnings vault for the MyFans platform.
Located in `contract/contracts/creator-deposits/`.

The contract collects creator deposits, deducts a configurable platform fee on each deposit,
and tracks per-creator balances for withdrawal. All token transfers are settled on-chain via
the configured Stellar asset contract.

---

## Public Functions

### `init`

```rust
pub fn init(env: Env, admin: Address, platform_fee_bps: u32, platform_treasury: Address)
```

One-time contract setup. Stores the admin address, the platform fee in basis points,
and the treasury address that receives platform fees.

- `platform_fee_bps` must be less than 10 000 (100 %); panics with `InvalidFeeBps` (code 1) otherwise.
- Requires `admin` authorization.
- Does **not** emit an event. (No event is defined for initialization.)

---

### `deposit`

```rust
pub fn deposit(env: Env, creator: Address, token: Address, amount: i128)
```

Transfers `amount` tokens from `creator` to the platform treasury (fee portion) and credits the
creator's internal balance (net amount).

- `creator` must authorize the call.
- Panics with `PlatformFeeNotInitialized` (code 4) if `init` has not been called.
- Panics with `PlatformTreasuryNotInitialized` (code 5) if the treasury has not been set.
- The platform fee is calculated as `amount * platform_fee_bps / 10000`. The fee part is
  transferred to the treasury; the remainder is credited to the creator's balance.
- If the fee is zero, no transfer to the treasury occurs (optimization).
- Emits `EarningsDeposited` event with topics `("EarningsDeposited", creator, token)` and
  data `net` (the post-fee amount credited).

---

### `withdraw`

```rust
pub fn withdraw(env: Env, creator: Address, token: Address, amount: i128)
```

Transfers `amount` tokens from the contract to `creator` and decrements their internal balance.

- `creator` must authorize the call.
- Panics with `InsufficientBalance` (code 2) if `creator`'s balance is less than `amount`.
- Token transfer is performed after the balance is validated (fail-fast on insufficient balance).
- Emits `EarningsWithdrawn` event with topics `("EarningsWithdrawn", creator, token)` and
  data `amount`.

---

### `set_platform_fee`

```rust
pub fn set_platform_fee(env: Env, bps: u32)
```

Updates the platform fee basis points.

- Requires admin authorization.
- Panics with `AdminNotInitialized` (code 3) if the contract has not been initialized.
- `bps` must be less than 10 000; panics with `InvalidFeeBps` (code 1) otherwise.
- Does **not** emit an event.

---

### `get_balance`

```rust
pub fn get_balance(env: Env, creator: Address) -> i128
```

View-only. Returns the current unclaimed balance for `creator`. Returns `0` if no balance
record exists. No authorization required.

---

### `get_platform_fee`

```rust
pub fn get_platform_fee(env: Env) -> u32
```

View-only. Returns the current platform fee in basis points, or `0` if not set.
No authorization required.

---

## Error Codes

| Code | Variant | Description |
|------|---------|-------------|
| 1 | `InvalidFeeBps` | Platform fee basis points must be < 10 000 |
| 2 | `InsufficientBalance` | Creator balance is less than the requested withdrawal amount |
| 3 | `AdminNotInitialized` | Admin key not present; contract was never initialized |
| 4 | `PlatformFeeNotInitialized` | Platform fee not set; contract init was incomplete |
| 5 | `PlatformTreasuryNotInitialized` | Platform treasury not set; contract init was incomplete |

Error discriminants are stable and form part of the public client API. Do not renumber
existing variants; add new ones at the end.

---

## Events

| Event | Topics | Data |
|-------|--------|------|
| `EarningsDeposited` | `("EarningsDeposited", creator, token)` | `net: i128` |
| `EarningsWithdrawn` | `("EarningsWithdrawn", creator, token)` | `amount: i128` |

---

## Storage Layout

All keys use `DataKey` (instance storage):

| Key | Type | Description |
|-----|------|-------------|
| `DataKey::Admin` | `Address` | Contract admin |
| `DataKey::PlatformFeeBps` | `u32` | Platform fee in basis points |
| `DataKey::PlatformTreasury` | `Address` | Treasury address receiving platform fees |
| `DataKey::CreatorBalance(Address)` | `i128` | Per-creator unclaimed earnings balance |

---

## Building and Testing

```bash
# Run unit tests
cargo test --package creator-deposits --features testutils

# Build WASM release artifact
cargo build --package creator-deposits --target wasm32-unknown-unknown --release
```

### Test Coverage

| Test | What it verifies |
|------|-----------------|
| `test_fee_deducted_correctly` | Platform fee is deducted and net amount is credited |
| `test_treasury_receives_fee` | Fee transfer to treasury is attempted |
| `test_creator_receives_net` | Creator receives full net amount after fee deduction |
| `test_invalid_bps_init_reverts` | `InvalidFeeBps` error on init with bps >= 10 000 |
| `test_invalid_bps_set_platform_fee_reverts` | `InvalidFeeBps` error on setting fee >= 10 000 |
| `test_set_platform_fee_admin_only` | Only admin can update the platform fee |
| `test_zero_fee` | Zero fee deposit credits full amount |
| `test_multiple_deposits_accumulate` | Multiple deposits correctly accumulate balance |
| `test_withdraw_works` | Withdrawal reduces balance correctly |
| `test_withdraw_insufficient_balance` | `InsufficientBalance` error on overdraft |
| `test_unauthorized_withdraw_reverts` | Non-creator cannot withdraw; balance unchanged |
| `test_admin_not_initialized_error` | `AdminNotInitialized` error when calling admin functions before init |
| `test_deposit_without_init_returns_error` | Deposit fails when contract is not initialized |

---

## Interface Docs

Full method reference table: [../../docs/interfaces/creator-deposits.md](../../docs/interfaces/creator-deposits.md)
