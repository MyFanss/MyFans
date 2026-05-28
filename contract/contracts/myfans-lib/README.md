# MyFans Shared Library

Shared types and enums for MyFans Soroban contracts.

## Types

### SubscriptionStatus

Represents the lifecycle status of a subscription.

```rust
pub enum SubscriptionStatus {
    Pending = 0,    // Subscription created but payment pending
    Active = 1,     // Subscription active and valid
    Cancelled = 2,  // Subscription cancelled by user or creator
    Expired = 3,    // Subscription expired (payment not renewed)
}
```

### ContentType

Represents content access type.

```rust
pub enum ContentType {
    Free = 0,  // Publicly accessible content
    Paid = 1,  // Subscription-gated content
}
```

## Usage

Add to your contract's `Cargo.toml`:

```toml
[dependencies]
myfans-lib = { path = "../myfans-lib" }
```

Import in your contract:

```rust
use myfans_lib::{SubscriptionStatus, ContentType};

#[contract]
pub struct SubscriptionContract;

#[contractimpl]
impl SubscriptionContract {
    pub fn create_subscription(env: Env) -> SubscriptionStatus {
        SubscriptionStatus::Pending
    }
    
    pub fn get_content_type(env: Env) -> ContentType {
        ContentType::Paid
    }
}
```

## Testing

Run tests:

```bash
cargo test
```

All enums are:
- Soroban-compatible (using `#[contracttype]`)
- Serializable/deserializable
- Copy, Clone, Debug, Eq, PartialEq
- Represented as u32 for efficient storage

## Features

- ✅ Soroban SDK integration
- ✅ Serialization/deserialization support
- ✅ Type-safe enum values
- ✅ Comprehensive tests
- ✅ Ready for cross-contract usage
