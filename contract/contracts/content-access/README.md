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

