# Creator Registry (contracts/creator-registry/src/lib.rs)

Rate-limited creator registration.

## Methods

| Method | Args | Returns | Auth | Example Invoke | Expected Events |
|--------|------|---------|------|---------------|-----------------|
| `initialize` | `admin: Address` | `()` | admin | `soroban contract invoke ... initialize -- ADMIN` | None |
| `set_rate_limit` | `ledgers: u32` | `()` | admin | `soroban contract invoke ... set_rate_limit -- 10` | None |
| `set_spam_fee` | `token: Address, amount: i128` | `()` | admin | `soroban contract invoke ... set_spam_fee -- TOKEN 1000` | None |
| `register_creator` | `caller: Address, creator_address: Address, creator_id: u64` | `()` | admin/creator (+ rate limit) | `soroban contract invoke ... register_creator -- CALLER CREATOR 456` | None |
| `unregister_creator` | `creator_address: Address` | `()` | admin | `soroban contract invoke ... unregister_creator -- CREATOR` | None |
| `admin` | `()` | `Address` | none | `soroban contract invoke ... admin` | None |
| `get_creator_id` | `address: Address` | `Option<u64>` | none | `soroban contract invoke ... get_creator_id -- ADDR` | None |

## Overview
Admin/creator register with rate-limit (10 ledgers). Persistent storage.

