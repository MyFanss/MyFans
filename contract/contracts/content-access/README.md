# Content Access Contract

Soroban smart contract for managing content access control in MyFans platform.

## Features

- **has_access**: Check if a buyer has access to specific content
- **grant_access**: Grant access to content for a buyer
- **has_access_batch**: Batch check access for multiple content items

## Functions

### has_access
```rust
pub fn has_access(env: Env, buyer: Address, creator: Address, content_id: u64) -> bool
```
Check if buyer has access to a single content item.

### grant_access
```rust
pub fn grant_access(env: Env, buyer: Address, creator: Address, content_id: u64)
```
Grant access to content for a buyer (typically called after subscription payment).

### has_access_batch
```rust
pub fn has_access_batch(
    env: Env,
    buyer: Address,
    content_ids: Vec<(Address, u64)>
) -> Vec<bool>
```
Batch check access for multiple content items. Returns a vector of boolean results in the same order as input.

**Parameters:**
- `buyer`: The address checking for access
- `content_ids`: Vector of (creator_address, content_id) tuples

**Returns:**
- Vector of boolean values indicating access for each content item

## Tests

Run tests:
```bash
cargo test
```

### Test Coverage

1. **test_has_access_single** - Basic single access check
2. **test_has_access_batch_empty** - Batch check with empty input
3. **test_has_access_batch_single** - Batch check with one item
4. **test_has_access_batch_multiple** - Batch check with multiple items (mixed access)
5. **test_has_access_batch_different_buyers** - Verify access is buyer-specific

## Usage Example

```rust
let buyer = Address::generate(&env);
let creator1 = Address::generate(&env);
let creator2 = Address::generate(&env);

// Grant access
client.grant_access(&buyer, &creator1, &1);
client.grant_access(&buyer, &creator2, &3);

// Batch check
let content_ids = vec![
    &env,
    (creator1, 1),
    (creator1, 2),
    (creator2, 3),
];

let results = client.has_access_batch(&buyer, &content_ids);
// results: [true, false, true]
```

## Integration

This contract works with:
- Subscription contracts (grant access on payment)
- Content delivery backend (check access before serving)
- Frontend (display accessible content)
