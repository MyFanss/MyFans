# Creator Earnings (contracts/creator-earnings/src/lib.rs)

Authorized earnings vault.

## Methods

| Method | Args | Returns | Auth | Example Invoke | Expected Events |
|--------|------|---------|------|---------------|-----------------|
| `initialize` | `admin: Address, token_address: Address` | `()` | admin | `soroban contract invoke ... initialize -- ADMIN TOKEN_ID` | None |
| `add_authorized` | `contract: Address` | `()` | admin | `soroban contract invoke ... add_authorized -- CONTRACT_ID` | None |
| `deposit` | `from: Address, creator: Address, amount: i128` | `()` | authorized/from | `soroban contract invoke ... deposit -- FROM CREATOR 1000` | None |
| `balance` | `creator: Address` | `i128` | none | `soroban contract invoke ... balance -- CREATOR` | None |
| `withdraw` | `creator: Address, amount: i128` | `()` | creator | `soroban contract invoke ... withdraw -- CREATOR 500` | `("withdraw",) -> (creator, amount, token)` |

## Overview
Admin-authorized deposits to creator balances; withdraw anytime. Token transfer integrated.

