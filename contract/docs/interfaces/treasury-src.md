# Treasury (contracts/myfans-contract/src/treasury.rs)

Basic treasury.

## Methods

| Method | Args | Returns | Auth | Example Invoke | Expected Events |
|--------|------|---------|------|---------------|-----------------|
| `initialize` | `admin: Address, token_address: Address` | `()` | admin | `soroban contract invoke ... initialize -- ADMIN TOKEN` | None |
| `deposit` | `from: Address, amount: i128` | `()` | from | `soroban contract invoke ... deposit -- FROM 1000` | None |
| `withdraw` | `to: Address, amount: i128` | `()` | admin | `soroban contract invoke ... withdraw -- TO 500` | None |

## Overview
Simple deposit/withdraw to contract balance.

The token address is stored at `initialize`. `deposit` pulls `amount` of the configured token from `from` into the contract via `soroban_sdk::token::Client` and only then credits the internal balance. `withdraw` debits the internal balance and transfers the same amount of tokens to `to`; if the token transfer fails, storage is left unchanged. The admin must authorize `withdraw`, and the pause flag blocks both `deposit` and `withdraw`.
