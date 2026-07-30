//! Property-based tests for myfans-lib invariants (issue #979).
//!
//! Run with: `cargo test -p myfans-lib prop_`
//!
//! # Invariants under test
//!
//! 1. **SubscriptionStatus stability**: All discriminants match expected u32 values.
//! 2. **ContentType stability**: Both discriminants are stable and distinct.
//! 3. **MyfansError stability**: All 15 discriminants are stable and unique.
//! 4. **error_codes consistency**: Every error_codes constant matches the corresponding
//!    MyfansError discriminant where the two map to the same concept.
//! 5. **No-overlap**: No two MyfansError variants share a discriminant.
//! 6. **is_active semantics**: Active is the only variant for which `== Active` is true.

#[cfg(test)]
mod props {
    extern crate std;

    use crate::{ContentType, MyfansError, SubscriptionStatus};
    use proptest::prelude::*;

    // ── SubscriptionStatus invariants ─────────────────────────────────────────

    proptest! {
        /// SubscriptionStatus::Active always equals 1 and no other variant does.
        #[test]
        fn prop_only_active_equals_one(
            _seed in 0u32..=1000u32,
        ) {
            prop_assert_eq!(SubscriptionStatus::Active as u32, 1u32);
            prop_assert_ne!(SubscriptionStatus::Pending as u32, 1u32);
            prop_assert_ne!(SubscriptionStatus::Cancelled as u32, 1u32);
            prop_assert_ne!(SubscriptionStatus::Expired as u32, 1u32);
        }

        /// SubscriptionStatus variants form a contiguous range 0..=3.
        #[test]
        fn prop_subscription_status_contiguous_range(
            _seed in 0u32..=1000u32,
        ) {
            let codes = [
                SubscriptionStatus::Pending as u32,
                SubscriptionStatus::Active as u32,
                SubscriptionStatus::Cancelled as u32,
                SubscriptionStatus::Expired as u32,
            ];
            let mut sorted = codes;
            sorted.sort();
            prop_assert_eq!(sorted, [0u32, 1, 2, 3]);
        }

        /// All SubscriptionStatus variants are pairwise distinct.
        #[test]
        fn prop_subscription_status_all_distinct(
            _seed in 0u32..=1000u32,
        ) {
            let codes = [
                SubscriptionStatus::Pending as u32,
                SubscriptionStatus::Active as u32,
                SubscriptionStatus::Cancelled as u32,
                SubscriptionStatus::Expired as u32,
            ];
            for i in 0..codes.len() {
                for j in (i + 1)..codes.len() {
                    prop_assert_ne!(
                        codes[i], codes[j],
                        "SubscriptionStatus variants [{}] and [{}] must be distinct",
                        i, j
                    );
                }
            }
        }
    }

    // ── ContentType invariants ────────────────────────────────────────────────

    proptest! {
        /// ContentType::Free is always 0 and ContentType::Paid is always 1.
        #[test]
        fn prop_content_type_codes_stable(
            _seed in 0u32..=1000u32,
        ) {
            prop_assert_eq!(ContentType::Free as u32, 0u32);
            prop_assert_eq!(ContentType::Paid as u32, 1u32);
        }

        /// ContentType variants are always distinct.
        #[test]
        fn prop_content_type_variants_distinct(
            _seed in 0u32..=1000u32,
        ) {
            prop_assert_ne!(ContentType::Free as u32, ContentType::Paid as u32);
        }
    }

    // ── MyfansError discriminant invariants ───────────────────────────────────

    proptest! {
        /// All 15 MyfansError discriminants are stable across any run.
        #[test]
        fn prop_myfans_error_discriminants_stable(
            _seed in 0u32..=1000u32,
        ) {
            prop_assert_eq!(MyfansError::AlreadyInitialized as u32, 1);
            prop_assert_eq!(MyfansError::NotInitialized as u32, 2);
            prop_assert_eq!(MyfansError::NotAuthorized as u32, 3);
            prop_assert_eq!(MyfansError::InsufficientBalance as u32, 4);
            prop_assert_eq!(MyfansError::InvalidFeeBps as u32, 5);
            prop_assert_eq!(MyfansError::RateLimited as u32, 6);
            prop_assert_eq!(MyfansError::AlreadyRegistered as u32, 7);
            prop_assert_eq!(MyfansError::NotLiked as u32, 8);
            prop_assert_eq!(MyfansError::Paused as u32, 9);
            prop_assert_eq!(MyfansError::ContentPriceNotSet as u32, 101);
            prop_assert_eq!(MyfansError::SubscriptionNotFound as u32, 102);
            prop_assert_eq!(MyfansError::SubscriptionExpired as u32, 103);
            prop_assert_eq!(MyfansError::AdminNotInitialized as u32, 104);
            prop_assert_eq!(MyfansError::NegativeMinBalance as u32, 105);
            prop_assert_eq!(MyfansError::MinBalanceViolation as u32, 106);
        }

        /// No two MyfansError variants share a discriminant.
        #[test]
        fn prop_myfans_error_discriminants_unique(
            _seed in 0u32..=1000u32,
        ) {
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
            for i in 0..codes.len() {
                for j in (i + 1)..codes.len() {
                    prop_assert_ne!(
                        codes[i], codes[j],
                        "MyfansError variants [{}] and [{}] must have distinct codes",
                        i, j
                    );
                }
            }
        }

        /// Initialize-path codes (1, 2, 104) never collide with each other.
        #[test]
        fn prop_init_path_codes_no_collision(
            _seed in 0u32..=1000u32,
        ) {
            let already_init = MyfansError::AlreadyInitialized as u32;
            let not_init     = MyfansError::NotInitialized as u32;
            let admin_not_init = MyfansError::AdminNotInitialized as u32;

            prop_assert_ne!(already_init, not_init);
            prop_assert_ne!(already_init, admin_not_init);
            prop_assert_ne!(not_init, admin_not_init);
        }
    }

    // ── error_codes module vs MyfansError consistency ─────────────────────────

    proptest! {
        /// error_codes::subscription::ALREADY_INITIALIZED matches MyfansError::AlreadyInitialized.
        #[test]
        fn prop_error_codes_subscription_already_initialized_matches(
            _seed in 0u32..=1000u32,
        ) {
            use crate::error_codes;
            prop_assert_eq!(
                error_codes::subscription::ALREADY_INITIALIZED,
                MyfansError::AlreadyInitialized as u32
            );
        }

        /// error_codes::content_access::ALREADY_INITIALIZED matches MyfansError::AlreadyInitialized.
        #[test]
        fn prop_error_codes_content_access_already_initialized_matches(
            _seed in 0u32..=1000u32,
        ) {
            use crate::error_codes;
            prop_assert_eq!(
                error_codes::content_access::ALREADY_INITIALIZED,
                MyfansError::AlreadyInitialized as u32
            );
        }

        /// error_codes::creator_registry::NOT_INITIALIZED matches MyfansError::NotInitialized.
        #[test]
        fn prop_error_codes_creator_registry_not_initialized_matches(
            _seed in 0u32..=1000u32,
        ) {
            use crate::error_codes;
            prop_assert_eq!(
                error_codes::creator_registry::NOT_INITIALIZED,
                MyfansError::NotInitialized as u32
            );
        }

        /// error_codes::treasury::NOT_INITIALIZED has its own stable code (5).
        #[test]
        fn prop_error_codes_treasury_not_initialized_stable(
            _seed in 0u32..=1000u32,
        ) {
            use crate::error_codes;
            // Treasury uses its own error numbering; NOT_INITIALIZED = 5.
            prop_assert_eq!(error_codes::treasury::NOT_INITIALIZED, 5u32);
            prop_assert!(error_codes::treasury::NOT_INITIALIZED > 0);
        }

        /// All error_codes sub-module constants are non-zero (Soroban contract errors must be > 0).
        #[test]
        fn prop_all_error_codes_non_zero(
            _seed in 0u32..=1000u32,
        ) {
            use crate::error_codes;
            let all_codes: &[u32] = &[
                error_codes::subscription::ALREADY_INITIALIZED,
                error_codes::subscription::PAUSED,
                error_codes::subscription::SUBSCRIPTION_NOT_FOUND,
                error_codes::subscription::PLAN_NOT_FOUND,
                error_codes::content_access::ALREADY_INITIALIZED,
                error_codes::content_access::CONTENT_PRICE_NOT_SET,
                error_codes::content_access::NOT_INITIALIZED,
                error_codes::content_likes::NOT_LIKED,
                error_codes::creator_registry::ALREADY_INITIALIZED,
                error_codes::creator_registry::NOT_INITIALIZED,
                error_codes::creator_registry::UNAUTHORIZED,
                error_codes::treasury::NOT_INITIALIZED,
                error_codes::treasury::INSUFFICIENT_BALANCE,
                error_codes::earnings::ALREADY_INITIALIZED,
                error_codes::creator_earnings::NOT_INITIALIZED,
                error_codes::creator_earnings::NOT_AUTHORIZED,
                error_codes::creator_earnings::INSUFFICIENT_BALANCE,
                error_codes::creator_deposits::INSUFFICIENT_BALANCE,
                error_codes::myfans_contract::NOT_INITIALIZED,
                error_codes::myfans_token::UNAUTHORIZED,
            ];
            for &code in all_codes {
                prop_assert!(code > 0, "error code {} must be non-zero (Soroban requirement)", code);
            }
        }
    }
}
