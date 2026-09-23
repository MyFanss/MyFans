# myfans-token Interface

## Overview

The `myfans-token` contract implements the fungible token used across the
myfans protocol. It exposes a minimal, auditable surface: admin-controlled
minting and burning, plus standard transfers. All supply-changing operations
use checked arithmetic and are gated by the authorization matrix described in
`contract/AUTH_MATRIX.md`.

## Storage

| Key | Type | Description |
| --- | --- | --- |
| `Admin` | `Address` | Account authorized to mint and burn. |
| `TotalSupply` | `u128` | Sum of all balances. Invariant: never negative, increases only on mint, decreases only on burn. |
| `Balance(Address)` | `u128` | Per-account balance. |

## Invariants

1. `TotalSupply == sum(Balance(a) for all a)`.
2. `TotalSupply` is monotonically non-decreasing except across `burn` calls.
3. `mint` increases `TotalSupply` by exactly `amount`.
4. `burn` decreases `TotalSupply` by exactly `amount` and never below zero.
5. No balance may exceed `u128::MAX`; overflow reverts with a typed error.

## Methods

### `initialize(admin: Address)`

Sets the admin account. Callable once. Emits `Initialized { admin }`.

### `mint(to: Address, amount: u128)`

- **Auth:** `admin.require_auth()` — admin only.
- **Behavior:** `Balance(to) = Balance(to).checked_add(amount)` and
  `TotalSupply = TotalSupply.checked_add(amount)`.
- **Reverts:** `Error::Overflow` if either checked add overflows;
  `Error::Unauthorized` if the caller is not the admin.
- **Emits:** `Mint { to, amount }`.

### `burn(from: Address, amount: u128)`

- **Auth:** `from.require_auth()` — the holder authorizes the burn.
- **Behavior:** `Balance(from) = Balance(from).checked_sub(amount)` and
  `TotalSupply = TotalSupply.checked_sub(amount)`.
- **Reverts:** `Error::InsufficientBalance` if `amount > Balance(from)`;
  `Error::Underflow` if the supply subtraction underflows.
- **Emits:** `Burn { from, amount }`.

### `transfer(from: Address, to: Address, amount: u128)`

- **Auth:** `from.require_auth()`.
- **Behavior:** `Balance(from) = Balance(from).checked_sub(amount)` and
  `Balance(to) = Balance(to).checked_add(amount)`. `TotalSupply` is unchanged.
- **Reverts:** `Error::InsufficientBalance` if `amount > Balance(from)`;
  `Error::Overflow` if the recipient balance would overflow.
- **Emits:** `Transfer { from, to, amount }`.

### `total_supply() -> u128`

Returns the current `TotalSupply`.

### `balance_of(account: Address) -> u128`

Returns `Balance(account)`.

## Errors

| Variant | Condition |
| --- | --- |
| `Unauthorized` | Caller is not the admin for an admin-only method. |
| `Overflow` | A `checked_add` would exceed `u128::MAX`. |
| `Underflow` | A `checked_sub` on `TotalSupply` would go below zero. |
| `InsufficientBalance` | `burn`/`transfer` amount exceeds the source balance. |

## Authorization Matrix

See `contract/AUTH_MATRIX.md` for the canonical rows. Summary:

| Method | Caller | Valid | Invalid |
| --- | --- | --- | --- |
| `mint` | admin | ✅ | non-admin → `Unauthorized` |
| `burn` | holder | ✅ | other account → `Unauthorized` |
| `transfer` | holder | ✅ | other account → `Unauthorized` |

Negative cases must be exercised without `mock_all_auths` so that the
revert is produced by the real auth check, not by a mocked environment.

## Test Plan

- `cargo test -p myfans-token`
- Happy paths: mint, burn, transfer, supply accounting.
- Overflow: mint that would exceed `u128::MAX` reverts with `Error::Overflow`.
- Underflow: burn more than `TotalSupply` reverts with `Error::Underflow`.
- Insufficient balance: burn/transfer more than balance reverts with
  `Error::InsufficientBalance`.
- Auth: non-admin `mint` reverts with `Error::Unauthorized` (no `mock_all_auths`).

## Out of Scope

Public fair launch, secondary-market mechanics, and fee-on-transfer logic.
