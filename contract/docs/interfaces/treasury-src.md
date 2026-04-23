# Treasury (src/treasury.rs)

Basic treasury.

## Methods

| Method | Args | Returns | Auth | Example Invoke | Expected Events |
|--------|------|---------|------|---------------|-----------------|
| `initialize` | `admin: Address, token_address: Address` | `()` | admin | `soroban contract invoke ... initialize -- ADMIN TOKEN` | None |
| `deposit` | `from: Address, amount: i128` | `()` | from | `soroban contract invoke ... deposit -- FROM 1000` | None |
| `withdraw` | `to: Address, amount: i128` | `()` | admin | `soroban contract invoke ... withdraw -- TO 500` | None |

## Overview
Simple deposit/withdraw to contract balance.

