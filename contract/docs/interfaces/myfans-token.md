# MyFans Token Interface

## Overview

`MyFansToken` is a SEP-41 style fungible token with an admin-controlled mint and burn.

## Initialization

### `initialize(admin, name, symbol, decimals)`

Initializes the token metadata and sets the admin. The `admin` address **must authorize** the call (`admin.require_auth()`), consistent with the treasury contract.

- If `DataKey::Admin` is already set, the call panics with `AlreadyInitialized`.
- If the admin signature is missing, the call fails and no storage is written, so a later authorized `initialize` can still succeed.
- On success, `admin`, `name`, `symbol`, `decimals` are stored and `total_supply` is set to `0`.

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
