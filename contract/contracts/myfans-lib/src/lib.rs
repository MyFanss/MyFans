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
#[repr(u32)]
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

// Ensure numeric discriminants are represented as `u32` in the compiled ABI.
// This keeps the contracterror discriminants stable across builds and targets.


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
mod property_tests;
#[cfg(test)]
mod tests {
    use super::*;

    // ── SubscriptionStatus discriminants ──────────────────────────────────────

    #[test]
    fn test_subscription_status_values() {
        assert_eq!(SubscriptionStatus::Pending as u32, 0);
        assert_eq!(SubscriptionStatus::Active as u32, 1);
        assert_eq!(SubscriptionStatus::Cancelled as u32, 2);
        assert_eq!(SubscriptionStatus::Expired as u32, 3);
    }

    #[test]
    fn test_subscription_status_active_is_unique() {
        let active = SubscriptionStatus::Active as u32;
        assert_ne!(active, SubscriptionStatus::Pending as u32);
        assert_ne!(active, SubscriptionStatus::Cancelled as u32);
        assert_ne!(active, SubscriptionStatus::Expired as u32);
    }

    // ── ContentType discriminants ─────────────────────────────────────────────

    #[test]
    fn test_content_type_values() {
        assert_eq!(ContentType::Free as u32, 0);
        assert_eq!(ContentType::Paid as u32, 1);
    }

    #[test]
    fn test_content_type_variants_are_distinct() {
        assert_ne!(ContentType::Free as u32, ContentType::Paid as u32);
    }

    // ── MyfansError discriminants (initialize and admin paths) ────────────────

    /// Verify the error codes used by the initialize path are stable.
    #[test]
    fn test_initialize_path_error_codes() {
        assert_eq!(MyfansError::AlreadyInitialized as u32, 1);
        assert_eq!(MyfansError::NotInitialized as u32, 2);
        assert_eq!(MyfansError::AdminNotInitialized as u32, 104);
    }

    /// Verify the admin authorization error code is stable.
    #[test]
    fn test_admin_path_error_code() {
        assert_eq!(MyfansError::NotAuthorized as u32, 3);
    }

    /// Verify all remaining MyfansError discriminants are stable.
    #[test]
    fn test_all_myfans_error_discriminants_are_stable() {
        assert_eq!(MyfansError::AlreadyInitialized as u32, 1);
        assert_eq!(MyfansError::NotInitialized as u32, 2);
        assert_eq!(MyfansError::NotAuthorized as u32, 3);
        assert_eq!(MyfansError::InsufficientBalance as u32, 4);
        assert_eq!(MyfansError::InvalidFeeBps as u32, 5);
        assert_eq!(MyfansError::RateLimited as u32, 6);
        assert_eq!(MyfansError::AlreadyRegistered as u32, 7);
        assert_eq!(MyfansError::NotLiked as u32, 8);
        assert_eq!(MyfansError::Paused as u32, 9);
        assert_eq!(MyfansError::ContentPriceNotSet as u32, 101);
        assert_eq!(MyfansError::SubscriptionNotFound as u32, 102);
        assert_eq!(MyfansError::SubscriptionExpired as u32, 103);
        assert_eq!(MyfansError::AdminNotInitialized as u32, 104);
        assert_eq!(MyfansError::NegativeMinBalance as u32, 105);
        assert_eq!(MyfansError::MinBalanceViolation as u32, 106);
    }

    /// All MyfansError variants have unique discriminants.
    #[test]
    fn test_myfans_error_discriminants_are_unique() {
        let codes: &[u32] = &[
            MyfansError::AlreadyInitialized as u32,
            MyfansError::NotInitialized as u32,
            MyfansError::NotAuthorized as u32,
            MyfansError::InsufficientBalance as u32,
            MyfansError::InvalidFeeBps as u32,
            MyfansError::RateLimited as u32,
            MyfansError::AlreadyRegistered as u32,
            MyfansError::NotLiked as u32,
            MyfansError::Paused as u32,
            MyfansError::ContentPriceNotSet as u32,
            MyfansError::SubscriptionNotFound as u32,
            MyfansError::SubscriptionExpired as u32,
            MyfansError::AdminNotInitialized as u32,
            MyfansError::NegativeMinBalance as u32,
            MyfansError::MinBalanceViolation as u32,
        ];
        // Verify uniqueness by checking each pair.
        for i in 0..codes.len() {
            for j in (i + 1)..codes.len() {
                assert_ne!(
                    codes[i], codes[j],
                    "codes[{}]={} and codes[{}]={} must be distinct",
                    i, codes[i], j, codes[j]
                );
            }
        }
    }

    // ── error_codes module: initialize and admin paths ────────────────────────

    /// error_codes constants for the initialize path must match MyfansError.
    #[test]
    fn test_error_codes_initialize_paths_match_myfans_error() {
        use crate::error_codes;
        // subscription module
        assert_eq!(
            error_codes::subscription::ALREADY_INITIALIZED,
            MyfansError::AlreadyInitialized as u32
        );
        // content-access
        assert_eq!(
            error_codes::content_access::ALREADY_INITIALIZED,
            MyfansError::AlreadyInitialized as u32
        );
        // creator-registry
        assert_eq!(
            error_codes::creator_registry::ALREADY_INITIALIZED,
            MyfansError::AlreadyInitialized as u32
        );
        assert_eq!(
            error_codes::creator_registry::NOT_INITIALIZED,
            MyfansError::NotInitialized as u32
        );
        // treasury uses its own error numbering; NOT_INITIALIZED = 5 (not shared with MyfansError).
        assert_eq!(error_codes::treasury::NOT_INITIALIZED, 5u32);
    }

    /// error_codes constants for admin authorization paths must be non-zero.
    #[test]
    fn test_error_codes_admin_paths_are_non_zero() {
        use crate::error_codes;
        assert!(error_codes::creator_registry::UNAUTHORIZED > 0);
        assert!(error_codes::creator_earnings::NOT_AUTHORIZED > 0);
        assert!(error_codes::myfans_contract::NOT_INITIALIZED > 0);
        assert!(error_codes::myfans_contract::ADMIN_NOT_INITIALIZED > 0);
    }

    /// All error_codes sub-modules: spot-check several constants are correct.
    #[test]
    fn test_error_codes_spot_check() {
        use crate::error_codes;
        assert_eq!(error_codes::earnings::ALREADY_INITIALIZED, 1);
        assert_eq!(error_codes::treasury::INSUFFICIENT_BALANCE, 3);
        assert_eq!(error_codes::myfans_token::UNAUTHORIZED, 7);
        assert_eq!(error_codes::subscription::PLAN_NOT_FOUND, 10);
        assert_eq!(error_codes::content_access::NOT_INITIALIZED, 3);
    }

    // ── TestEnv initialization ────────────────────────────────────────────────
    // Compiled only when the `testutils` soroban feature is enabled.

    #[cfg(feature = "testutils")]
    mod test_env_tests {
        use crate::test_fixtures::TestEnv;

        #[test]
        fn test_env_new_produces_distinct_addresses() {
            let f = TestEnv::new();
            assert_ne!(f.admin, f.fee_recipient, "admin and fee_recipient must differ");
            assert_ne!(f.admin, f.creator, "admin and creator must differ");
            assert_ne!(f.admin, f.fan, "admin and fan must differ");
            assert_ne!(f.creator, f.fan, "creator and fan must differ");
            assert_ne!(
                f.admin, f.token_address,
                "admin and token_address must differ"
            );
        }

        #[test]
        fn test_env_default_matches_new() {
            // Both TestEnv::new() and TestEnv::default() must produce a usable environment.
            // We verify each independently (cross-Env address comparisons are not permitted).
            let f1 = TestEnv::new();
            let f2 = TestEnv::default();
            // Each instance should have a distinct admin address within its own Env.
            assert_ne!(f1.admin, f1.creator);
            assert_ne!(f2.admin, f2.fan);
        }

        #[test]
        fn test_env_mint_increases_balance() {
            let f = TestEnv::new();
            f.mint(&f.fan, 1_000);
            assert_eq!(f.token_client.balance(&f.fan), 1_000);
        }

        #[test]
        fn test_env_advance_ledger_increments_sequence() {
            let f = TestEnv::new();
            let before = f.env.ledger().sequence();
            f.advance_ledger(50);
            assert_eq!(f.env.ledger().sequence(), before + 50);
        }
    }
}
