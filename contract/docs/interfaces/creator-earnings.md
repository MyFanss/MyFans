# Creator Earnings (contracts/creator-earnings/src/lib.rs)

Authorized earnings vault.

## Methods

| Method | Args | Returns | Auth | Example Invoke | Expected Events |
|--------|------|---------|------|---------------|-----------------|
| `initialize` | `admin: Address, token_address: Address` | `()` | admin | `soroban contract invoke ... initialize -- ADMIN TOKEN_ID` | `("initialized",) -> { admin, token }` |
| `add_authorized` | `contract: Address` | `()` | admin | `soroban contract invoke ... add_authorized -- CONTRACT_ID` | `("authorized_added",) -> { depositor }` |
| `deposit` | `from: Address, creator: Address, amount: i128` | `()` | authorized/from | `soroban contract invoke ... deposit -- FROM CREATOR 1000` | `("deposit",) -> { from, creator, amount, token }` |
| `balance` | `creator: Address` | `i128` | none | `soroban contract invoke ... balance -- CREATOR` | None |
| `withdraw` | `creator: Address, amount: i128` | `()` | creator | `soroban contract invoke ... withdraw -- CREATOR 500` | `("withdraw",) -> { creator, amount, token }` |

## Error Codes

| Code | Variant | Description |
|------|---------|-------------|
| 1 | `NotInitialized` | Contract was never initialized |
| 2 | `NotAuthorized` | Caller is not the admin or an authorized depositor |
| 3 | `InsufficientBalance` | Creator balance is less than the requested withdrawal amount |
| 4 | `AlreadyInitialized` | `initialize` was called more than once |
| 5 | `InvalidAmount` | Deposit or withdrawal amount must be strictly positive |

## Overview

Admin-authorized deposits to creator balances; creators withdraw at any time. Token transfer
integrated. Depositor contracts must be whitelisted via `add_authorized` (admin is always
permitted). All amounts must be strictly positive.
