# Treasury (contracts/treasury/src/lib.rs)

Advanced treasury with pause/min_balance.

## Methods

| Method | Args | Returns | Auth | Example Invoke | Expected Events |
|--------|------|---------|------|---------------|-----------------|
| `initialize` | `admin: Address, token_address: Address` | `()` | admin | `soroban contract invoke ... initialize -- ADMIN TOKEN` | None |
| `set_paused` | `paused: bool` | `()` | admin | `soroban contract invoke ... set_paused -- true` | None |
| `set_min_balance` | `amount: i128` | `()` | admin | `soroban contract invoke ... set_min_balance -- 1000` | None |
| `deposit` | `from: Address, amount: i128` | `()` | from | `soroban contract invoke ... deposit -- FROM 2000` | `("deposit",) -> (from, amount, token)` |
| `withdraw` | `to: Address, amount: i128` | `()` | admin | `soroban contract invoke ... withdraw -- TO 1500` | None |

## Overview
Paused blocks ops; min_balance protects liquidity.

