//! Property-based tests for content-access contract invariants.
//!
//! Run with: `cargo test -p content-access prop_`

#[cfg(test)]
mod props {
    use crate::{ContentAccess, ContentAccessClient, Error};
    use proptest::prelude::*;
    use soroban_sdk::{
        testutils::{Address as _, Ledger},
        Address, Env, Error as SorobanError,
    };

    // ── helpers ──────────────────────────────────────────────────────────────

    fn setup(env: &Env) -> (ContentAccessClient<'_>, Address, Address) {
        env.mock_all_auths();
        env.ledger().with_mut(|li| {
            li.sequence_number = 1000;
            li.min_persistent_entry_ttl = 10_000_000;
            li.min_temp_entry_ttl = 10_000_000;
        });

        let admin = Address::generate(env);
        let contract_id = env.register_contract(None, ContentAccess);
        let client = ContentAccessClient::new(env, &contract_id);

        let token_address = Address::generate(env);

        client.initialize(&admin, &token_address);
        (client, admin, token_address)
    }

    // ── grant/expiry invariants ──────────────────────────────────────────────

    proptest! {
        #![proptest_config(ProptestConfig::with_cases(32))]

        /// After unlock_content with a specific expiry, has_access returns true
        /// before expiry and false after expiry.
        #[test]
        fn prop_access_granted_then_expires(
            content_id in any::<u64>(),
            price in 1i128..=10_000_000i128,
            duration_ledgers in 1u64..=10_000u64,
        ) {
            let env = Env::default();
            let (client, _admin, _token_address) = setup(&env);
            let buyer = Address::generate(&env);
            let creator = Address::generate(&env);

            client.set_content_price(&creator, &content_id, &price);
            client.unlock_content(&buyer, &creator, &content_id, &(1000 + duration_ledgers));

            prop_assert!(
                client.has_access(&buyer, &creator, &content_id),
                "access must be granted immediately after unlock"
            );

            // Advance past expiry
            env.ledger().with_mut(|li| {
                li.sequence_number = 1000 + duration_ledgers + 1;
            });

            prop_assert!(
                !client.has_access(&buyer, &creator, &content_id),
                "access must be revoked after expiry"
            );
        }

        /// Non-expiring purchases (expiry = u64::MAX) never expire.
        #[test]
        fn prop_non_expiring_never_expires(
            content_id in any::<u64>(),
            price in 1i128..=10_000_000i128,
            advance_ledgers in 0u64..=1_000_000u64,
        ) {
            let env = Env::default();
            let (client, _admin, _token_address) = setup(&env);
            let buyer = Address::generate(&env);
            let creator = Address::generate(&env);

            client.set_content_price(&creator, &content_id, &price);
            client.unlock_content(&buyer, &creator, &content_id, &u64::MAX);

            env.ledger().with_mut(|li| {
                li.sequence_number = 1000 + advance_ledgers;
            });

            prop_assert!(
                client.has_access(&buyer, &creator, &content_id),
                "non-expiring access must never expire"
            );
        }


        /// Access is scoped per (buyer, creator, content_id) tuple.
        #[test]
        fn prop_access_is_triple_scoped(
            content_id_a in any::<u64>(),
            content_id_b in any::<u64>(),
            price in 1i128..=10_000_000i128,
        ) {
            let env = Env::default();
            let (client, _admin, _token_address) = setup(&env);
            let buyer = Address::generate(&env);
            let creator_a = Address::generate(&env);
            let creator_b = Address::generate(&env);

            client.set_content_price(&creator_a, &content_id_a, &price);
            client.set_content_price(&creator_b, &content_id_b, &price);

            client.unlock_content(&buyer, &creator_a, &content_id_a, &u64::MAX);

            prop_assert!(client.has_access(&buyer, &creator_a, &content_id_a));
            if content_id_a == content_id_b {
                prop_assert!(!client.has_access(&buyer, &creator_b, &content_id_a));
            } else {
                prop_assert!(!client.has_access(&buyer, &creator_a, &content_id_b));
                prop_assert!(!client.has_access(&buyer, &creator_b, &content_id_a));
            }
        }


        /// Grants are idempotent: unlocking the same content multiple times
        /// does not change the outcome.
        #[test]
        fn prop_unlock_is_idempotent(
            content_id in any::<u64>(),
            price in 1i128..=10_000_000i128,
        ) {
            let env = Env::default();
            let (client, _admin, _token_address) = setup(&env);
            let buyer = Address::generate(&env);
            let creator = Address::generate(&env);

            client.set_content_price(&creator, &content_id, &price);
            client.unlock_content(&buyer, &creator, &content_id, &u64::MAX);
            client.unlock_content(&buyer, &creator, &content_id, &u64::MAX);

            prop_assert!(client.has_access(&buyer, &creator, &content_id));
        }


        /// A purchase that expires can be re-purchased (re-granted).
        #[test]
        fn prop_expired_purchase_can_be_renewed(
            content_id in any::<u64>(),
            price in 1i128..=10_000_000i128,
            duration_ledgers in 1u64..=1_000u64,
        ) {
            let env = Env::default();
            let (client, _admin, _token_address) = setup(&env);
            let buyer = Address::generate(&env);
            let creator = Address::generate(&env);

            client.set_content_price(&creator, &content_id, &price);
            client.unlock_content(&buyer, &creator, &content_id, &(1000 + duration_ledgers));

            // Let it expire
            env.ledger().with_mut(|li| {
                li.sequence_number = 1000 + duration_ledgers + 1;
            });

            prop_assert!(!client.has_access(&buyer, &creator, &content_id));

            // Re-purchase with a new longer expiry
            let new_expiry = 1000 + duration_ledgers + 100;
            client.unlock_content(&buyer, &creator, &content_id, &new_expiry);

            prop_assert!(
                client.has_access(&buyer, &creator, &content_id),
                "re-purchase after expiry must re-grant access"
            );
        }


        /// verify_access succeeds iff has_access returns true.
        #[test]
        fn prop_verify_matches_has_access(
            content_id in any::<u64>(),
            price in 1i128..=10_000_000i128,
        ) {
            let env = Env::default();
            let (client, _admin, _token_address) = setup(&env);
            let buyer = Address::generate(&env);
            let creator = Address::generate(&env);

            client.set_content_price(&creator, &content_id, &price);

            // Before unlock: has_access false, verify_access errors
            prop_assert!(!client.has_access(&buyer, &creator, &content_id));
            let verify_result = client.try_verify_access(&buyer, &creator, &content_id);
            prop_assert_eq!(
                verify_result,
                Err(Ok(SorobanError::from_contract_error(
                    Error::NotBuyer as u32,
                )))
            );

            // After unlock: has_access true, verify_access succeeds
            client.unlock_content(&buyer, &creator, &content_id, &u64::MAX);
            prop_assert!(client.has_access(&buyer, &creator, &content_id));
            prop_assert!(client.try_verify_access(&buyer, &creator, &content_id).is_ok());
        }


        /// Price set by creator is always retrievable and matches exactly.
        #[test]
        fn prop_price_set_is_retrievable(
            content_id in any::<u64>(),
            price in 1i128..=10_000_000i128,
        ) {
            let env = Env::default();
            let (client, _admin, _token_address) = setup(&env);
            let creator = Address::generate(&env);

            client.set_content_price(&creator, &content_id, &price);

            let retrieved = client.get_content_price(&creator, &content_id);
            prop_assert_eq!(retrieved, Some(price));
        }

        /// Non-positive prices are always rejected.
        #[test]
        fn prop_non_positive_price_rejected(
            content_id in any::<u64>(),
            price in i128::MIN..=0i128,
        ) {
            let env = Env::default();
            let (client, _admin, _token_address) = setup(&env);
            let creator = Address::generate(&env);

            let result = client.try_set_content_price(&creator, &content_id, &price);
            prop_assert_eq!(
                result,
                Err(Ok(SorobanError::from_contract_error(Error::InvalidPrice as u32)))
            );
            prop_assert_eq!(client.get_content_price(&creator, &content_id), None);
        }
    }
}


