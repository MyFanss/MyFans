# Subscription Contract

Soroban smart contract for managing subscriptions with lifecycle events.

## Events

### SubscriptionCreated
Emitted when a new subscription is created.

```rust
pub struct SubscriptionCreated {
    pub fan: Address,
    pub creator: Address,
    pub expires_at: u64,
}
```

**Topic:** `sub_new`

### SubscriptionCancelled
Emitted when a subscription is cancelled.

```rust
pub struct SubscriptionCancelled {
    pub fan: Address,
    pub creator: Address,
}
```

**Topic:** `sub_cncl`

### SubscriptionExpired
Emitted when a subscription expires.

```rust
pub struct SubscriptionExpired {
    pub fan: Address,
    pub creator: Address,
}
```

**Topic:** `sub_exp`

## Functions

### create_subscription
```rust
pub fn create_subscription(
    env: Env,
    fan: Address,
    creator: Address,
    expires_at: u64,
) -> SubscriptionStatus
```

Creates a new subscription and emits `SubscriptionCreated` event.

### cancel_subscription
```rust
pub fn cancel_subscription(env: Env, fan: Address, creator: Address)
```

Cancels an existing subscription and emits `SubscriptionCancelled` event.

### expire_subscription
```rust
pub fn expire_subscription(env: Env, fan: Address, creator: Address)
```

Expires a subscription and emits `SubscriptionExpired` event.

### get_expiry
```rust
pub fn get_expiry(env: Env, fan: Address, creator: Address) -> Option<u64>
```

Returns the expiry timestamp for a subscription, or None if not found.

## Tests

Run tests:
```bash
cargo test
```

### Test Coverage

1. **test_create_subscription_emits_event** - Verifies SubscriptionCreated event
2. **test_cancel_subscription_emits_event** - Verifies SubscriptionCancelled event
3. **test_expire_subscription_emits_event** - Verifies SubscriptionExpired event
4. **test_subscription_lifecycle** - Full lifecycle test

## Usage Example

```rust
let fan = Address::generate(&env);
let creator = Address::generate(&env);
let expires_at = 1000;

// Create subscription (emits SubscriptionCreated)
client.create_subscription(&fan, &creator, &expires_at);

// Cancel subscription (emits SubscriptionCancelled)
client.cancel_subscription(&fan, &creator);
```

## Event Indexing

Backend can listen to these events to:
- Update subscription database
- Send notifications to users
- Track subscription metrics
- Trigger content access updates
