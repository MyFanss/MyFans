# Creator Earnings Contract

Authorized earnings vault for the MyFans platform.
Located in `contract/contracts/creator-earnings/`.

Authorized depositor contracts (e.g. the subscription contract) push earnings into per-creator
balances; creators withdraw at any time. All token transfers are settled on-chain via the
configured Stellar asset contract.

---

## Public Functions

### `initialize`

```rust
pub fn initialize(env: Env, admin: Address, token_address: Address)
```

One-time contract setup. Stores the admin address and the token contract used for all
deposits and withdrawals.

- Requires `admin` authorization.
- Panics with `AlreadyInitialized` (code 4) if called more than once.
- Emits `initialized` event: `{ admin, token }`.

---

### `add_authorized`

```rust
pub fn add_authorized(env: Env, contract: Address)
```

Grants `contract` permission to call `deposit`. Typically used to whitelist the
subscription or payment-routing contract.

- Requires admin authorization.
- Panics with `NotInitialized` (code 1) if the contract has not been initialized.
- Emits `authorized_added` event: `{ depositor }`.

---

### `deposit`

```rust
pub fn deposit(env: Env, from: Address, creator: Address, amount: i128)
```

Transfers `amount` tokens from `from` into the contract and credits `creator`'s internal
balance.

- `amount` must be strictly positive; panics with `InvalidAmount` (code 5) otherwise.
- `from` must authorize the call.
- `from` must be the admin or a contract previously registered via `add_authorized`;
  panics with `NotAuthorized` (code 2) otherwise.
- Emits `deposit` event: `{ from, creator, amount, token }`.

---

### `balance`

```rust
pub fn balance(env: Env, creator: Address) -> i128
```

Returns the current unclaimed earnings balance for `creator`. Returns `0` if no balance
record exists. No authorization required.

---

### `withdraw`

```rust
pub fn withdraw(env: Env, creator: Address, amount: i128)
```

Transfers `amount` tokens from the contract to `creator` and decrements their internal
balance.

- `amount` must be strictly positive; panics with `InvalidAmount` (code 5) otherwise.
- `creator` must authorize the call.
- Panics with `InsufficientBalance` (code 3) if `creator`'s balance is less than `amount`.
- Token transfer is attempted first; if it fails the balance is not updated (fail-fast).
- Emits `withdraw` event: `{ creator, amount, token }`.

---

## Error Codes

| Code | Variant | Description |
|------|---------|-------------|
| 1 | `NotInitialized` | Contract was never initialized |
| 2 | `NotAuthorized` | Caller is not the admin or an authorized depositor |
| 3 | `InsufficientBalance` | Creator balance is less than the requested withdrawal amount |
| 4 | `AlreadyInitialized` | `initialize` was called more than once |
| 5 | `InvalidAmount` | Deposit or withdrawal amount must be strictly positive |

Error discriminants are stable and form part of the public client API. Do not renumber
existing variants; add new ones at the end.

---

## Events

| Event | Topics | Data struct |
|-------|--------|-------------|
| `initialized` | `("initialized",)` | `InitializedEvent { admin, token }` |
| `authorized_added` | `("authorized_added",)` | `AuthorizedAddedEvent { depositor }` |
| `deposit` | `("deposit",)` | `DepositEvent { from, creator, amount, token }` |
| `withdraw` | `("withdraw",)` | `WithdrawEvent { creator, amount, token }` |

---

## Storage Layout

All keys use `DataKey` (instance storage):

| Key | Type | Description |
|-----|------|-------------|
| `DataKey::Admin` | `Address` | Contract admin |
| `DataKey::Token` | `Address` | Token contract used for all transfers |
| `DataKey::Balance(Address)` | `i128` | Per-creator unclaimed earnings |
| `DataKey::AuthorizedDepositor(Address)` | `bool` | Whitelist flag for depositor contracts |

---

## Building and Testing

```bash
# Run unit tests
cargo test --package creator-earnings --features testutils

# Build WASM release artifact
cargo build --package creator-earnings --target wasm32-unknown-unknown --release
```

### Test Coverage

| Test | What it verifies |
|------|-----------------|
| `deposit_increases_balance` | Deposit credits creator balance and transfers tokens to contract |
| `withdraw_reduces_balance_and_transfers_tokens` | Withdraw debits balance and sends tokens to creator |
| `withdraw_insufficient_balance_reverts` | `InsufficientBalance` error on overdraft |
| `unauthorized_deposit_reverts` | `NotAuthorized` error for non-whitelisted depositor |
| `test_unauthorized_withdraw_reverts` | Non-creator cannot withdraw; balance unchanged |
| `withdraw_emits_event` | `withdraw` event fields are correct |
| `withdraw_failed_emits_no_event` | Failed withdraw emits no event |
| `initialize_emits_event` | `initialized` event fields are correct |
| `add_authorized_emits_event` | `authorized_added` event fields are correct |
| `deposit_emits_event` | `deposit` event fields are correct |
| `double_initialize_reverts` | `AlreadyInitialized` error on second `initialize` call |
| `invalid_amount_deposit_reverts` | `InvalidAmount` error for zero/negative deposit |
| `invalid_amount_withdraw_reverts` | `InvalidAmount` error for zero/negative withdrawal |
| `admin_can_deposit` | Admin address is accepted as a depositor without `add_authorized` |

---

## Interface Docs

Full method reference table: [../../docs/interfaces/creator-earnings.md](../../docs/interfaces/creator-earnings.md)
