# Content Access Contract (contracts/content-access/src/lib.rs)

Pay-per-content unlocking.

## Methods

| Method | Args | Returns | Auth | Example Invoke | Expected Events |
|--------|------|---------|------|---------------|-----------------|
| `initialize` | `admin: Address, token_address: Address` | `()` | admin | `soroban contract invoke ... initialize -- ADMIN TOKEN_ID` | None |
| `unlock_content` | `buyer: Address, creator: Address, content_id: u64` | `()` (idempotent) | buyer | `soroban contract invoke ... unlock_content -- BUYER CREATOR 123` (fund buyer) | `("content_unlocked", buyer, creator) -> (content_id, price)` |
| `has_access` | `buyer: Address, creator: Address, content_id: u64` | `bool` | none | `soroban contract invoke ... has_access -- BUYER CREATOR 123` | None |
| `get_content_price` | `creator: Address, content_id: u64` | `Option<i128>` | none | `soroban contract invoke ... get_content_price -- CREATOR 123` | None |
| `set_content_price` | `creator: Address, content_id: u64, price: i128` | `()` | creator | `soroban contract invoke ... set_content_price -- CREATOR 123 100` | None |
| `set_admin` | `new_admin: Address` | `()` | current admin | `soroban contract invoke ... set_admin -- NEW_ADMIN` | None |

## Overview
Buyer pays creator-set price to unlock specific content. Access buyer/creator/content-specific.

