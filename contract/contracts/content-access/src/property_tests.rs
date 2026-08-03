//! Property-based tests for the content-access contract invariants.
//!
//! Run with: `cargo test -p content-access prop_`

#[cfg(test)]
mod props {
    extern crate std;

    use crate::{ContentAccess, ContentAccessClient, Error};
    use proptest::prelude::*;
    use soroban_sdk::{
        contract, contractimpl,
        testutils::{Address as _, Ledger},
        Address, Env, Error as SorobanError,
    };

    // ── Mock token ─────────────────────────────────────────────────────────────

    #[contract]
    pub struct MockToken;

    #[contractimpl]
    impl MockToken {
        pub fn balance(_env: Env, _id: Address) -> i128 {
            0
        }
        pub fn transfer(_env: Env, _from: Address, _to: Address, _amount: i128) {}
    }

    // ── Setup ──────────────────────────────────────────────────────────────────

    fn setup(env: &Env) -> (ContentAccessClient<'_>, Address, Address) {
        env.mock_all_auths();
        env.ledger().with_mut(|li| {
            li.sequence_number = 1000;
            li.min_persistent_entry_ttl = 10_000_000;
            li.min_temp_entry_ttl = 10_000_000;
        });

        let admin = Address::generate(env);
        let token_address = env.register_contract(None, MockToken);
        let contract_id = env.register_contract(None, ContentAccess);
        let client = ContentAccessClient::new(env, &contract_id);

        client.initialize(&admin, &token_address);
        (client, admin, token_address)
    }

    // ── Helper: assert invariant helpers ───────────────────────────────────────

    fn assert_grant_invariant(
        client: &ContentAccessClient<'_>,
        buyer: &Address,
        creator: &Address,
        content_id: u64,
        expected_access: bool,
    ) {
        assert_eq!(
            client.has_access(buyer, creator, &content_id),
            expected_access,
            "has_access must match expected state"
        );
        if expected_access {
            let verify_result = client.try_verify_access(buyer, creator, &content_id);
            assert!(
                verify_result.is_ok(),
                "verify_access must succeed when has_access is true"
            );
        } else {
            let verify_result = client.try_verify_access(buyer, creator, &content_id);
            assert_eq!(
                verify_result,
                Err(Ok(SorobanError::from_contract_error(
                    Error::NotBuyer as u32,
                ))),
                "verify_access must fail with NotBuyer when no grant exists"
            );
        }
    }

    // ── Property: Grant/revoke by expiry ──────────────────────────────────────

    proptest! {
        #![proptest_config(ProptestConfig::with_cases(16))]

        /// For any set of random unlock operations, the contract's access state
        /// must remain consistent: has_access and verify_access agree, and expiry
        /// boundaries are respected.
        #[test]
        fn prop_unlock_preserves_access_invariants(
            ops in prop::collection::vec(
                (0u64..5u64, 0u64..5u64, 1u64..10_000u64),
                1..16usize
            )
        ) {
            let env = Env::default();
            let (client, _admin, _token_address) = setup(&env);

            let buyers: [Address; 3] = core::array::from_fn(|_| Address::generate(&env));
            let creators: [Address; 3] = core::array::from_fn(|_| Address::generate(&env));

            // Set prices for all (creator, content_id) combos we might use
            for creator in &creators {
                for content_id in 0u64..5u64 {
                    client.set_content_price(creator, &content_id, &100);
                }
            }

            for (buyer_idx, creator_idx, expiry_ledger) in ops {
                let buyer = &buyers[buyer_idx as usize % 3];
                let creator = &creators[creator_idx as usize % 3];
                let content_id = buyer_idx % 5;

                let current_seq: u64 = env.ledger().sequence() as u64;
                let unlock_result = client.try_unlock_content(buyer, creator, &content_id, &expiry_ledger);

                if expiry_ledger <= current_seq {
                    prop_assert_eq!(
                        unlock_result,
                        Err(Ok(SorobanError::from_contract_error(
                            Error::InvalidExpiry as u32,
                        ))),
                        "expiry_ledger <= current_seq must be rejected with InvalidExpiry"
                    );
                    prop_assert!(!client.has_access(buyer, creator, &content_id));
                } else {
                    prop_assert!(unlock_result.is_ok());
                    prop_assert!(client.has_access(buyer, creator, &content_id));

                    let new_seq = current_seq + (expiry_ledger - current_seq) + 1;
                    env.ledger().with_mut(|li| {
                        li.sequence_number = new_seq as u32;
                    });

                    prop_assert!(
                        !client.has_access(buyer, creator, &content_id),
                        "access must expire after expiry ledger is passed"
                    );
                }
            }
        }
    }

    // ── Property: Price setting invariants ────────────────────────────────────

    proptest! {
        /// For any valid price, set_content_price stores it and get_content_price
        /// retrieves it; non-positive prices are always rejected.
        #[test]
        fn prop_price_set_and_get(
            price in -100i128..10_000i128,
            content_id in 0u64..100u64,
        ) {
            let env = Env::default();
            let (client, _admin, _token_address) = setup(&env);
            let creator = Address::generate(&env);

            let result = client.try_set_content_price(&creator, &content_id, &price);

            if price <= 0 {
                prop_assert_eq!(
                    result,
                    Err(Ok(SorobanError::from_contract_error(
                        Error::InvalidPrice as u32,
                    ))),
                    "non-positive price must be rejected"
                );
            } else {
                prop_assert!(result.is_ok());
                prop_assert_eq!(
                    client.get_content_price(&creator, &content_id),
                    Some(price),
                    "price must be retrievable after set"
                );
            }
        }
    }

    // ── Property: Access is buyer-scoped ──────────────────────────────────────

    proptest! {
        /// Unlocking content for one buyer must NOT grant access to another buyer.
        #[test]
        fn prop_access_is_buyer_scoped(
            content_id in 0u64..10u64,
        ) {
            let env = Env::default();
            let (client, _admin, _token_address) = setup(&env);

            let creator = Address::generate(&env);
            let buyer1 = Address::generate(&env);
            let buyer2 = Address::generate(&env);

            client.set_content_price(&creator, &content_id, &100);

            // Only buyer1 unlocks
            client.unlock_content(&buyer1, &creator, &content_id, &u64::MAX);

            prop_assert!(client.has_access(&buyer1, &creator, &content_id));
            prop_assert!(!client.has_access(&buyer2, &creator, &content_id));
        }
    }
}
