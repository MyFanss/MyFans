# Subscription Contract (contracts/subscription/src/lib.rs)

Advanced subscription with ledger expiry.

## Methods

| Method | Args | Returns | Auth | Example Invoke | Expected Events |
|--------|------|---------|------|---------------|-----------------|
| `init` | `admin: Address, fee_bps: u32, fee_recipient: Address, token: Address, price: i128` | `()` | admin | `soroban contract invoke ... init -- ADMIN 100 TREASURY TOKEN 1000` | None |
| `create_plan` | `creator: Address, asset: Address, amount: i128, interval_days: u32` | `u32` | creator | `soroban contract invoke ... create_plan -- CREATOR TOKEN 1000 30` | `("plan_created", plan_id) -> creator` |
| `subscribe` | `fan: Address, plan_id: u32, token: Address` | `()` | fan | `soroban contract invoke ... subscribe -- FAN 1 TOKEN` | `("subscribed", plan_id) -> fan` |
| `is_subscriber` | `fan: Address, creator: Address` | `bool` | none | `soroban contract invoke ... is_subscriber -- FAN CREATOR` | None |
| `extend_subscription` | `fan: Address, creator: Address, extra_ledgers: u32, token: Address` | `()` | fan | `soroban contract invoke ... extend_subscription -- FAN CREATOR 100 TOKEN` | `("extended", plan_id) -> fan` |
| `cancel` | `fan: Address, creator: Address` | `()` | fan | `soroban contract invoke ... cancel -- FAN CREATOR` | `("cancelled",) -> fan` |
| `create_subscription` | `fan: Address, creator: Address, duration_ledgers: u32` | `()` | fan | `soroban contract invoke ... create_subscription -- FAN CREATOR 17280` | None (internal) |
| `pause` / `unpause` | `()` | `()` | admin | `soroban contract invoke ... pause --` | `("paused" / "unpaused",) -> admin` |
| `is_paused` | `()` | `bool` | none | `soroban contract invoke ... is_paused` | None |

## Overview
Subscription plans with extend/cancel; overlaps main contract. Uses ledger seq for expiry.

