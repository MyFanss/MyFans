# MyFans Token Interface

## Overview

The MyFans token is a SEP-41 compliant fungible token used by the app for
pricing and payments. Amounts are expressed in the token's smallest unit and
formatted by wallets and the frontend using the token's `decimals` value.

## Initialization

`initialize(env, admin, name, symbol, decimals)` sets up the token once.

### Decimals cap

`decimals` must be **at most 18**. Values of `0` through `18` (inclusive) are
accepted; the tests use `7`. Any value greater than `18` (for example `19` or
`u32::MAX`) is rejected with `TokenError::InvalidAmount` and no storage is
written, leaving the contract uninitialized.

This cap keeps amounts representable and prevents wallets and the frontend
from formatting nonsense prices.

## Events

`mint`, `burn`, and `transfer` each publish exactly one event on success, next
to the balance write. Failed calls (for example an insufficient balance or a
missing authorization) emit nothing. All topics fit `symbol_short` (at most
nine characters).

| Operation | Topics | Data |
| --- | --- | --- |
| `mint(to, amount)` | `("mint", to)` | `amount` |
| `burn(from, amount)` | `("burn", from)` | `amount` |
| `transfer(from, to, amount)` | `("transfer", from, to)` | `amount` |

An indexer can reconstruct supply and transfers from these events without
scanning storage.

## Errors

| Error | Meaning |
| --- | --- |
| `InvalidAmount` | An amount or configuration value (including `decimals > 18`) is out of range. |
