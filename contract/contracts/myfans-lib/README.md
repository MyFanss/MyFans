# MyFans Shared Library

Shared types, enums, and error codes for MyFans Soroban contracts. This library provides common definitions used across all MyFans smart contracts, ensuring type safety and consistency.

## Public API

### Enums

#### SubscriptionStatus

Represents the lifecycle status of a subscription.

```rust
pub enum SubscriptionStatus {
    Pending = 0,    // Subscription created but payment pending
    Active = 1,     // Subscription active and valid
    Cancelled = 2,  // Subscription cancelled by user or creator
    Expired = 3,    // Subscription expired (payment not renewed)
}
```

**Properties:**
- Soroban-compatible (decorated with `#[contracttype]`)
- Copy, Clone, Debug, Eq, PartialEq
- Serializable/deserializable
- Represented as `u32` for efficient storage

#### ContentType

Represents content access type classification.

```rust
pub enum ContentType {
    Free = 0,  // Publicly accessible content
    Paid = 1,  // Subscription-gated content
}
```

**Properties:**
- Soroban-compatible (decorated with `#[contracttype]`)
- Copy, Clone, Debug, Eq, PartialEq
- Serializable/deserializable
- Represented as `u32` for efficient storage

#### MyfansError

Shared error enum across all MyFans contracts. Error codes are preserved exactly for test snapshot compatibility.

```rust
pub enum MyfansError {
    // Common init/admin errors
    AlreadyInitialized = 1,
    NotInitialized = 2,
    NotAuthorized = 3,
    // Balance/transfer errors
    InsufficientBalance = 4,
    // Fee/config errors
    InvalidFeeBps = 5,
    // Spam/security
    RateLimited = 6,
    AlreadyRegistered = 7,
    NotLiked = 8,
    // State control
    Paused = 9,
    // content-access specific
    ContentPriceNotSet = 101,
    // subscription specific
    SubscriptionNotFound = 102,
    SubscriptionExpired = 103,
    AdminNotInitialized = 104,
    // treasury specific
    NegativeMinBalance = 105,
    MinBalanceViolation = 106,
}
```

**Properties:**
- Decorated with `#[contracterror]` for Soroban error handling
- Copy, Clone, Debug, Eq, PartialEq
- Numeric discriminants are stable and fixed for compatibility

### Modules

#### error_codes

Provides stable numeric error code constants for each contract, enabling clients (TypeScript SDK, backend, frontend) to inspect Soroban error results without hard-coding magic numbers.

**Usage:**
```rust
use myfans_lib::error_codes::subscription as sub_err;

// Check whether a Soroban invocation failed with SubscriptionNotFound:
// if result.err() == Some(sub_err::SUBSCRIPTION_NOT_FOUND) { ... }
```

**Available sub-modules:**
- `subscription` - Error codes for the subscription contract
- `content_access` - Error codes for the content-access contract
- `content_likes` - Error codes for the content-likes contract
- `creator_registry` - Error codes for the creator-registry contract
- `treasury` - Error codes for the treasury contract
- `earnings` - Error codes for the earnings contract
- `creator_earnings` - Error codes for the creator-earnings contract
- `creator_deposits` - Error codes for the creator-deposits contract
- `myfans_contract` - Error codes for the main myfans-contract

**Note:** Error codes in each sub-module **must** match the `#[contracterror]` discriminants in the corresponding contract's `Error` enum. The `test-consumer` contract enforces this invariant through tests.

#### test_fixtures

Provides shared test fixtures for cross-contract integration tests. Only available when the `testutils` feature is enabled.

**Usage:**
```rust
[dev-dependencies]
myfans-lib = { path = "../myfans-lib", features = ["testutils"] }
```

## Getting Started

### Installation

Add to your contract's `Cargo.toml`:

```toml
[dependencies]
myfans-lib = { path = "../myfans-lib" }
```

### Basic Example

```rust
use myfans_lib::{SubscriptionStatus, ContentType, MyfansError};
use soroban_sdk::{contract, contractimpl, Env};

#[contract]
pub struct SubscriptionContract;

#[contractimpl]
impl SubscriptionContract {
    /// Check if a subscription is active
    pub fn is_active(_env: Env, status: SubscriptionStatus) -> bool {
        status == SubscriptionStatus::Active
    }
    
    /// Get the numeric discriminant of a content type
    pub fn content_code(_env: Env, ct: ContentType) -> u32 {
        ct as u32
    }
    
    /// Handle errors by their numeric codes
    pub fn error_code(_env: Env, err: MyfansError) -> u32 {
        err as u32
    }
}
```

### Error Handling Example

```rust
use myfans_lib::error_codes::subscription as sub_err;

fn handle_error(code: u32) {
    match code {
        sub_err::SUBSCRIPTION_NOT_FOUND => println!("Subscription not found"),
        sub_err::SUBSCRIPTION_EXPIRED => println!("Subscription expired"),
        sub_err::ALREADY_INITIALIZED => println!("Already initialized"),
        _ => println!("Unknown error"),
    }
}
```

## Testing

Run tests:

```bash
cargo test
```

All types are thoroughly tested for:
- Soroban SDK compatibility
- Serialization/deserialization
- Cross-contract type safety
- Error code stability

## Features

- ✅ Shared type definitions across all MyFans contracts
- ✅ Stable error codes for client integration
- ✅ Soroban SDK integration
- ✅ Full serialization/deserialization support
- ✅ Type-safe enum values
- ✅ Comprehensive test coverage
- ✅ Cross-contract compatibility
- ✅ Zero-runtime overhead (compile-time only)
