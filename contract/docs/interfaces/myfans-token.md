# MyFans Token Interface

## Overview

`MyFansToken` is a SEP-41 style fungible token with an admin-controlled mint and burn. Amounts are expressed in the token's smallest unit and formatted by wallets and the frontend using the token's `decimals` value.

## Initialization

### `initialize(admin, name, symbol, decimals)`

Initializes the token metadata and sets the admin. The `admin` address **must authorize** the call (`admin.require_auth()`), consistent with the treasury contract.

- If `DataKey::Admin` is already set, the call panics with `AlreadyInitialized`.
- If the admin signature is missing, the call fails and no storage is written, so a later authorized `initialize` can still succeed.
- On success, `admin`, `name`, `symbol`, `decimals` are stored and `total_supply` is set to `0`.

### Decimals cap

`decimals` must be **at most 18**. Values of `0` through `18` (inclusive) are accepted; the tests use `7`. Any value greater than `18` (for example `19` or `u32::MAX`) is rejected with `TokenError::InvalidAmount` and no storage is written, leaving the contract uninitialized.

This cap keeps amounts representable and prevents wallets and the frontend from formatting nonsense prices.

## Read methods

- `admin() -> Address`
- `name() -> String`
- `symbol() -> String`
- `decimals() -> u32`
- `total_supply() -> i128`
- `balance(id: Address) -> i128`
- `allowance(from: Address, spender: Address) -> i128` — returns `0` once the stored expiration ledger has passed.

## State-changing methods

- `mint(to, amount)` — requires admin auth.
- `burn(from, amount)` — requires `from` auth.
- `transfer(from, to, amount)` — requires `from` auth.
- `approve(from, spender, amount)` — requires `from` auth. Stores `(amount, expiration_ledger)`; an `amount` of `0` clears the allowance.
- `transfer_from(from, spender, to, amount)` — requires `spender` auth. Rejects a non-positive `amount`, an expired allowance, or an insufficient allowance, moves the balance once, and decreases the stored allowance by `amount`. Self-transfers follow the same rule as `transfer`.

## Events

`mint`, `burn`, and `transfer` each publish exactly one event on success, next to the balance write. Failed calls (for example an insufficient balance or a missing authorization) emit nothing. All topics fit `symbol_short` (at most nine characters).

| Operation | Topics | Data |
| --- | --- | --- |
| `mint(to, amount)` | `("mint", to)` | `amount` |
| `burn(from, amount)` | `("burn", from)` | `amount` |
| `transfer(from, to, amount)` | `("transfer", from, to)` | `amount` |

An indexer can reconstruct supply and transfers from these events without scanning storage.

## Errors

| Error | Meaning |
| --- | --- |
| `InvalidAmount` | An amount or configuration value (including `decimals > 18`) is out of range. |
