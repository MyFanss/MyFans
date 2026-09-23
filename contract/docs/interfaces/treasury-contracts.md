# Treasury (contracts/treasury/src/lib.rs)

Advanced treasury with pause/min_balance.

## Methods

| Method | Args | Returns | Auth | Example Invoke | Expected Events |
|--------|------|---------|------|---------------|-----------------|
| `initialize` | `admin: Address, token_address: Address` | `()` | admin | `soroban contract invoke ... initialize -- ADMIN TOKEN` | `("initialized",) -> (admin, token)` |
| `set_paused` | `paused: bool` | `()` | admin | `soroban contract invoke ... set_paused -- true` | `("paused_set",) -> paused` |
| `set_min_balance` | `amount: i128` | `()` | admin | `soroban contract invoke ... set_min_balance -- 1000` | `("min_balance_set",) -> amount` |
| `deposit` | `from: Address, amount: i128` | `()` | from | `soroban contract invoke ... deposit -- FROM 2000` | `("deposit",) -> (from, amount, token)` |
| `withdraw` | `to: Address, amount: i128` | `()` | admin | `soroban contract invoke ... withdraw -- TO 1500` | `("withdraw",) -> (to, amount, token)` |
| `admin` | `()` | `Address` | none | `soroban contract invoke ... admin` | None |
| `token` | `()` | `Address` | none | `soroban contract invoke ... token` | None |
| `set_admin` | `new_admin: Address` | `()` | current admin | `soroban contract invoke ... set_admin -- NEW_ADMIN` | `("admin_transferred",) -> (old_admin, new_admin)` |

## Fee collection

The treasury has **no fee parameter of its own** (immutable by design). Protocol fees are
configured in the [subscription contract](subscription.md): `init` / `set_fee_bps` are
admin-only and capped at `MAX_FEE_BPS = 1_000` (10%). The subscription contract routes the
fee portion of every payment into this treasury by calling `deposit(from, amount)` — so the
fee flows through this contract's own deposit path (pause honored, `deposit` event emitted)
and can only be withdrawn by the treasury admin via `withdraw`.

## Overview

Paused blocks ops; min_balance protects liquidity.

## Storage Layout

All keys use the `DataKey` enum (instance storage):

| Key | Type | Description |
|-----|------|-------------|
| `DataKey::Admin` | `Address` | Contract admin |
| `DataKey::Token` | `Address` | Token contract address |
| `DataKey::Paused` | `bool` | Pause flag |
| `DataKey::MinBalance` | `i128` | Minimum balance guard |

