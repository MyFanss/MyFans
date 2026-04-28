# MyFans Main Contract Interface (contracts/myfans-contract/src/lib.rs)

Core subscription and creator registry.

## Methods

| Method | Args | Returns | Auth | Example Invoke | Expected Events |
|--------|------|---------|------|---------------|-----------------|
| `init` | `admin: Address, fee_bps: u32, fee_recipient: Address` | `()` | admin | `soroban contract invoke \ --network local --source registry \ --wasm target/wasm32-unknown-unknown/release/myfans_contract.wasm \ init -- ADMIN_ADDR 100 TREASURY_ADDR` | None |
| `register_creator` | `creator: Address` | `u32` (creator_id) | creator | `soroban contract invoke ... register_creator -- CREATOR_ADDR` | `("creator_registered", creator_id) -> creator` |
| `set_verified` | `creator_address: Address, verified: bool` | `()` | admin | `soroban contract invoke ... set_verified -- CREATOR_ADDR true` | `("verification_updated", creator_id) -> creator_address` |
| `get_creator` | `address: Address` | `Option<CreatorInfo>` | none | `soroban contract invoke ... get_creator -- ADDR` | None |
| `create_plan` | `creator: Address, asset: Address, amount: i128, interval_days: u32` | `u32` (plan_id) | creator | `soroban contract invoke ... create_plan -- CREATOR TOKEN_ID 1000 30` | `("plan_created", plan_id) -> creator` |
| `subscribe` | `fan: Address, plan_id: u32` | `()` | fan | `soroban contract invoke ... subscribe -- FAN_ADDR 1` (fund fan balance first) | `("subscribed", plan_id) -> fan` |
| `get_plan` | `plan_id: u32` | `Option<Plan>` | none | `soroban contract invoke ... get_plan -- 1` | None |
| `get_plan_count` | `()` | `u32` | none | `soroban contract invoke ... get_plan_count` | None |
| `is_subscriber` / `is_subscribed` | `fan: Address, creator: Address` | `bool` | none | `soroban contract invoke ... is_subscriber -- FAN CREATOR` | None |
| `get_subscription_expiry` | `fan: Address, creator: Address` | `Option<u64>` | none | `soroban contract invoke ... get_subscription_expiry -- FAN CREATOR` | None |
| `cancel` | `fan: Address, creator: Address` | `()` | fan | `soroban contract invoke ... cancel -- FAN CREATOR` | `("cancelled",) -> fan` |
| `pause` / `unpause` | `()` | `()` | admin | `soroban contract invoke ... pause --` | `("paused" / "unpaused",) -> admin` |
| `is_paused` | `()` | `bool` | none | `soroban contract invoke ... is_paused` | None |

## Overview
Handles creator registration, subscription plans, and basic state management. Paused state blocks mutations. Uses instance storage.

