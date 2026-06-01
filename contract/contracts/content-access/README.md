# Content Access Contract

This Soroban contract manages paid access to creator content on the MyFans platform.

## Overview

The contract allows a buyer to unlock a specific piece of content owned by a creator by
paying the configured token price. Purchases are stored with an expiry ledger sequence
so access can be time-limited or permanent (use `u64::MAX` for non-expiring purchases).

## Public functions

All signatures are shown with Soroban types.

- `pub fn initialize(env: Env, admin: Address, token_address: Address)`
  - Set the contract admin and the token contract address used for payments.
  - Requires `admin` to authorize the call.
  - Panics with `Error::AlreadyInitialized` if called more than once.

- `pub fn unlock_content(env: Env, buyer: Address, creator: Address, content_id: u64, expiry_ledger: u64)`
  - Buyer authorizes the call (`buyer.require_auth()`).
  - Looks up the configured price via `get_content_price`; panics with
    `Error::ContentPriceNotSet` if no price is set for `(creator, content_id)`.
  - Transfers the price from `buyer` to `creator` using the configured token.
  - Stores a `Purchase { expiry }` record under `DataKey::Access(buyer, creator, content_id)`.
  - `expiry_ledger` is an exclusive ledger sequence; use `u64::MAX` for no expiry.
  - If a valid, non-expired purchase already exists, the call is idempotent and returns early.
  - Emits `content_unlocked` event with `(content_id, price)` and topics `("content_unlocked", buyer, creator)`.

- `pub fn has_access(env: Env, buyer: Address, creator: Address, content_id: u64) -> bool`
  - Returns `true` if a non-expired purchase record exists for the tuple `(buyer, creator, content_id)`.
  - Returns `false` otherwise.

- `pub fn verify_access(env: Env, claimer: Address, creator: Address, content_id: u64)`
  - Verifies that `claimer` is the buyer who purchased the content and that the purchase has not expired.
  - Panics with `Error::NotBuyer` if no purchase record exists for `claimer`.
  - Panics with `Error::PurchaseExpired` if the purchase exists but has expired.

- `pub fn get_content_price(env: Env, creator: Address, content_id: u64) -> Option<i128>`
  - Returns the configured price (in the contract token's smallest unit) or `None`.

- `pub fn set_content_price(env: Env, creator: Address, content_id: u64, price: i128)`
  - Creator must authorize.
  - `price` must be positive; if `MaxPrice` is set, `price` must not exceed it.
  - Persists price under `DataKey::ContentPrice(creator, content_id)`.

- `pub fn set_max_price(env: Env, max_price: i128)`
  - Admin-only. Current admin must authorize.
  - Passing `0` removes the cap. Otherwise sets `MaxPrice` to the given positive value.

- `pub fn get_max_price(env: Env) -> Option<i128>`
  - Returns the configured maximum price cap, or `None` if not set.

- `pub fn set_admin(env: Env, new_admin: Address)`
  - Current admin must authorize. Sets a new admin address.
  - Panics with `Error::NotInitialized` if the contract is uninitialized.

- `pub fn admin(env: Env) -> Address`
  - View-only. Returns the configured admin address.
  - Panics with `Error::NotInitialized` if not initialized.

## Storage layout

Key enum (summary):

- `DataKey::Admin` — stored `Address` for admin
- `DataKey::TokenAddress` — stored `Address` for token contract used for payments
- `DataKey::Access(Address, Address, u64)` — maps `(buyer, creator, content_id)` -> `Purchase { expiry: u64 }`
- `DataKey::ContentPrice(Address, u64)` — maps `(creator, content_id)` -> `i128` price
- `DataKey::MaxPrice` — optional `i128` cap set by admin

Purchases use an explicit `expiry` ledger sequence so access checks are time-aware.

## Events

- Emits a `content_unlocked` event on successful unlocks. Topics are `("content_unlocked", buyer, creator)` and the payload is `(content_id: u64, price: i128)`.

## Errors

The contract defines a stable `Error` enum used for panics that are part of the contract API:

- `AlreadyInitialized` (1)
- `ContentPriceNotSet` (2)
- `NotInitialized` (3)
- `PurchaseExpired` (4)
- `NotBuyer` (6)

Client code should treat these codes as part of the contract's public API.

## Usage example

```rust
let client = ContentAccessClient::new(&env, &contract_id);

// Initialize contract (admin authorizes)
client.initialize(&admin, &token_address);

// Creator sets price
client.set_content_price(&creator, &42, &500);

// Buyer unlocks content with no expiry
client.unlock_content(&buyer, &creator, &42, &u64::MAX);

// Check access
assert!(client.has_access(&buyer, &creator, &42));
```

## Notes

- `unlock_content` does not accept a price argument; it reads the configured price from storage.
- Use `u64::MAX` for permanent access; use a ledger sequence to limit access duration.
# Content Access Contract

Soroban smart contract for managing paid content access in MyFans platform.

## Features

- **initialize**: Set up contract with admin and token address
- **unlock_content**: Buyer authorizes and pays to unlock content
- **has_access**: Check if buyer has access to specific content
- **Idempotent unlocks**: Duplicate unlock attempts are no-ops

## Functions

### initialize
```rust
pub fn initialize(env: Env, admin: Address, token_address: Address)
```
Initialize the contract with admin and token address for payments.

**Parameters:**
- `admin` - Admin address
- `token_address` - Token contract address used for payments

### unlock_content
```rust
pub fn unlock_content(
    env: Env,
    buyer: Address,
    creator: Address,
    content_id: u64,
    price: i128,
)
```
Unlock content for a buyer by transferring payment to creator.

**Parameters:**
- `buyer` - Buyer address (must authorize transaction)
- `creator` - Creator address (receives payment)
- `content_id` - Content ID to unlock
- `price` - Price in tokens

**Behavior:**
- Buyer must authorize the transaction
- Transfers `price` tokens from buyer to creator
- Stores access record (buyer, creator, content_id) → true
- Idempotent: duplicate unlock is a no-op (returns early if already unlocked)
- Emits `content_unlocked` event

### has_access
```rust
pub fn has_access(env: Env, buyer: Address, creator: Address, content_id: u64) -> bool
```
Check if buyer has access to specific content.

**Parameters:**
- `buyer` - Buyer address
- `creator` - Creator address
- `content_id` - Content ID

**Returns:**
- `true` if buyer has unlocked this content, `false` otherwise

## Storage

Uses enum-based DataKey pattern for efficient storage:
- `DataKey::Admin` - Admin address
- `DataKey::TokenAddress` - Token contract address
- `DataKey::Access(buyer, creator, content_id)` - Access records

## Tests

Run tests:
```bash
cargo test
```

### Test Coverage

1. **test_initialize** - Contract initialization
2. **test_unlock_content_works** - Basic unlock and access check
3. **test_unlock_content_requires_buyer_auth** - Authorization enforcement
4. **test_duplicate_unlock_is_idempotent** - Duplicate unlock handling
5. **test_has_access_returns_false_for_non_existent** - Non-existent content
6. **test_access_is_buyer_specific** - Access isolation by buyer
7. **test_access_is_creator_specific** - Access isolation by creator
8. **test_access_is_content_id_specific** - Access isolation by content ID
9. **test_multiple_unlocks_different_content** - Multiple content unlocks
10. **test_multiple_buyers_same_content** - Multiple buyers for same content

## Acceptance Criteria

✅ Buyer can unlock content (with authorization)
✅ Payment transferred to creator (via token contract)
✅ has_access returns true after unlock
✅ Duplicate unlock is idempotent (no-op)
✅ All tests pass

## Interface Docs

Full method reference: [../docs/interfaces/content-access.md](../docs/interfaces/content-access.md)

## Usage Example

```rust
let buyer = Address::generate(&env);
let creator = Address::generate(&env);
let token_address = Address::generate(&env);

// Initialize
client.initialize(&admin, &token_address);

// Unlock content
client.unlock_content(&buyer, &creator, &1, &100);

// Check access
assert!(client.has_access(&buyer, &creator, &1));

// Duplicate unlock is safe
client.unlock_content(&buyer, &creator, &1, &100); // no-op
```

## Integration

This contract works with:
- Token contracts (for payment transfers)
- Backend services (to verify access before serving content)
- Frontend (to display accessible content)

