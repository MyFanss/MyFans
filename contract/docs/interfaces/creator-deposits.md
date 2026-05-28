# Creator Deposits (contracts/creator-deposits/src/lib.rs)

Platform-fee earnings deposits.

## Methods

| Method | Args | Returns | Auth | Example Invoke | Expected Events |
|--------|------|---------|------|---------------|-----------------|
| `init` | `admin: Address, platform_fee_bps: u32, platform_treasury: Address` | `()` | admin | `soroban contract invoke ... init -- ADMIN 500 TREASURY` | None |
| `deposit` | `creator: Address, token: Address, amount: i128` | `()` | creator | `soroban contract invoke ... deposit -- CREATOR TOKEN 1000` | `("EarningsDeposited", creator, token) -> net` |
| `withdraw` | `creator: Address, token: Address, amount: i128` | `()` | creator | `soroban contract invoke ... withdraw -- CREATOR TOKEN 500` | `("EarningsWithdrawn", creator, token) -> amount` |
| `set_platform_fee` | `bps: u32` | `()` | admin | `soroban contract invoke ... set_platform_fee -- 1000` | None |
| `get_balance` | `creator: Address` | `i128` | none | `soroban contract invoke ... get_balance -- CREATOR` | None |
| `get_platform_fee` | `()` | `u32` | none | `soroban contract invoke ... get_platform_fee` | None |

## Overview
Creator deposits earnings; platform takes bps fee on deposit.

