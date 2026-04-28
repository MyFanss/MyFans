#![no_std]

use soroban_sdk::{contracterror, contracttype};

/// Subscription lifecycle status
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum SubscriptionStatus {
    Pending = 0,
    Active = 1,
    Cancelled = 2,
    Expired = 3,
}

/// Content access type
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum ContentType {
    Free = 0,
    Paid = 1,
}

/// Shared error enum across all MyFans contracts.
/// Codes preserved exactly for test snapshot compatibility.
#[contracterror]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum MyfansError {
    /// Common init/admin errors
    AlreadyInitialized = 1,
    NotInitialized = 2,
    NotAuthorized = 3,
    /// Balance/transfer errors
    InsufficientBalance = 4,
    /// Fee/config errors
    InvalidFeeBps = 5,
    /// Spam/security
    RateLimited = 6,
    AlreadyRegistered = 7,
    NotLiked = 8,
    /// State control
    Paused = 9,
    /// content-access specific
    ContentPriceNotSet = 101,
    /// subscription specific
    SubscriptionNotFound = 102,
    SubscriptionExpired = 103,
    AdminNotInitialized = 104,
    /// treasury specific
    NegativeMinBalance = 105,
    MinBalanceViolation = 106,
}

/// Stable numeric error codes for every MyFans contract, grouped by contract.
/// Clients can import these instead of hard-coding magic numbers.
///
/// ```rust
/// use myfans_lib::error_codes::subscription as sub_err;
/// assert_eq!(sub_err::SUBSCRIPTION_NOT_FOUND, 3);
/// ```
pub mod error_codes;

/// Shared test fixtures for cross-contract integration tests.
/// Only compiled when the `testutils` feature is enabled.
#[cfg(any(test, feature = "testutils"))]
pub mod test_fixtures;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_subscription_status_values() {
        assert_eq!(SubscriptionStatus::Pending as u32, 0);
        assert_eq!(SubscriptionStatus::Active as u32, 1);
        assert_eq!(SubscriptionStatus::Cancelled as u32, 2);
        assert_eq!(SubscriptionStatus::Expired as u32, 3);
    }

    // ... (rest unchanged)
}
