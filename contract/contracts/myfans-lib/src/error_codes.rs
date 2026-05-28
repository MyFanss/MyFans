//! Stable numeric error codes for every MyFans contract.
//!
//! Each sub-module mirrors the `Error` enum of the corresponding contract.
//! Clients (TypeScript SDK, backend, frontend) can import these constants
//! instead of hard-coding magic numbers when inspecting Soroban error results.
//!
//! # Usage
//!
//! ```rust
//! use myfans_lib::error_codes::subscription as sub_err;
//!
//! // Check whether a Soroban invocation failed with SubscriptionNotFound:
//! // result.err() == Some(sub_err::SUBSCRIPTION_NOT_FOUND)
//! ```
//!
//! These values **must** match the `#[contracterror]` discriminants in each
//! contract's `Error` enum. Tests in `test-consumer` enforce this invariant.

/// Error codes for the **subscription** contract.
pub mod subscription {
    pub const ALREADY_INITIALIZED: u32 = 1;
    pub const PAUSED: u32 = 2;
    pub const SUBSCRIPTION_NOT_FOUND: u32 = 3;
    pub const SUBSCRIPTION_EXPIRED: u32 = 4;
    pub const ADMIN_NOT_INITIALIZED: u32 = 5;
    pub const INVALID_FEE_RECIPIENT: u32 = 6;
    pub const INVALID_FEE_BPS: u32 = 7;
    pub const INVALID_TOKEN_ADDRESS: u32 = 8;
    pub const INVALID_PRICE: u32 = 9;
}

/// Error codes for the **content-access** contract.
pub mod content_access {
    pub const ALREADY_INITIALIZED: u32 = 1;
    pub const CONTENT_PRICE_NOT_SET: u32 = 2;
    pub const NOT_INITIALIZED: u32 = 3;
    pub const PURCHASE_EXPIRED: u32 = 4;
    // Note: code 5 is intentionally unassigned (reserved gap).
    pub const NOT_BUYER: u32 = 6;
}

/// Error codes for the **content-likes** contract.
pub mod content_likes {
    pub const NOT_LIKED: u32 = 1;
}

/// Error codes for the **creator-registry** contract.
pub mod creator_registry {
    pub const ALREADY_INITIALIZED: u32 = 1;
    pub const NOT_INITIALIZED: u32 = 2;
    pub const UNAUTHORIZED: u32 = 3;
    pub const RATE_LIMITED: u32 = 4;
    pub const ALREADY_REGISTERED: u32 = 5;
    pub const NOT_REGISTERED: u32 = 6;
    pub const INVALID_AMOUNT: u32 = 7;
}

/// Error codes for the **treasury** contract.
pub mod treasury {
    pub const NEGATIVE_MIN_BALANCE: u32 = 1;
    pub const PAUSED: u32 = 2;
    pub const INSUFFICIENT_BALANCE: u32 = 3;
    pub const MIN_BALANCE_VIOLATION: u32 = 4;
    pub const NOT_INITIALIZED: u32 = 5;
    pub const INVALID_AMOUNT: u32 = 6;
}

/// Error codes for the **earnings** contract.
pub mod earnings {
    pub const ALREADY_INITIALIZED: u32 = 1;
}

/// Error codes for the **creator-earnings** contract.
pub mod creator_earnings {
    pub const NOT_INITIALIZED: u32 = 1;
    pub const NOT_AUTHORIZED: u32 = 2;
    pub const INSUFFICIENT_BALANCE: u32 = 3;
    pub const ALREADY_INITIALIZED: u32 = 4;
    pub const INVALID_AMOUNT: u32 = 5;
}

/// Error codes for the **creator-deposits** contract.
pub mod creator_deposits {
    pub const INVALID_FEE_BPS: u32 = 1;
    pub const INSUFFICIENT_BALANCE: u32 = 2;
}

/// Error codes for the **myfans-contract** (main contract).
pub mod myfans_contract {
    pub const CREATOR_ALREADY_REGISTERED: u32 = 1;
    pub const NOT_INITIALIZED: u32 = 2;
    pub const CREATOR_NOT_REGISTERED: u32 = 3;
    pub const PAUSED: u32 = 4;
    pub const SUBSCRIPTION_DOES_NOT_EXIST: u32 = 5;
    pub const ADMIN_NOT_INITIALIZED: u32 = 6;
}

/// Error codes for the **myfans-token** contract.
pub mod myfans_token {
    pub const INSUFFICIENT_BALANCE: u32 = 1;
    pub const INSUFFICIENT_ALLOWANCE: u32 = 2;
    pub const ALLOWANCE_EXPIRED: u32 = 3;
    pub const INVALID_AMOUNT: u32 = 4;
    pub const INVALID_EXPIRATION: u32 = 5;
    pub const NO_ALLOWANCE: u32 = 6;
    pub const UNAUTHORIZED: u32 = 7;
}
