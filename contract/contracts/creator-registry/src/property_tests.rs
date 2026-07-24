//! Property-based tests for creator-registry invariants.
//!
//! Run with: `cargo test -p creator-registry prop_`

#[cfg(test)]
mod props {
    extern crate std;

    use crate::{
        CreatorRegistryContract, CreatorRegistryContractClient, Error, DEFAULT_RATE_LIMIT,
    };
    use proptest::prelude::*;
    use soroban_sdk::{
        testutils::{Address as _, Ledger},
        Address, Env, Error as SorobanError,
    };

    proptest! {
        #![proptest_config(ProptestConfig::with_cases(16))]

        /// Registrations by distinct creators must preserve each creator's exact
        /// ID without changing any previously written mapping.
        #[test]
        fn prop_self_registrations_are_isolated_and_exact(
            creator_ids in prop::collection::vec(any::<u64>(), 1..16),
        ) {
            let env = Env::default();
            env.mock_all_auths();

            let contract_id = env.register_contract(None, CreatorRegistryContract);
            let client = CreatorRegistryContractClient::new(&env, &contract_id);
            let admin = Address::generate(&env);
            client.initialize(&admin);

            let mut registered = std::vec::Vec::new();
            for creator_id in creator_ids {
                let creator = Address::generate(&env);
                client.register_creator(&creator, &creator, &creator_id);
                registered.push((creator, creator_id));

                for (registered_creator, registered_id) in &registered {
                    prop_assert_eq!(
                        client.get_creator_id(registered_creator),
                        Some(*registered_id),
                        "a new registration must not alter an existing creator mapping"
                    );
                }
            }
        }

        /// The rate-limit boundary is exact for every generated pair of IDs:
        /// before the window the write is rejected without partial state; at
        /// and after the window it succeeds with the requested ID.
        #[test]
        fn prop_rate_limit_preserves_state_and_allows_only_at_boundary(
            first_id in any::<u64>(),
            second_id in any::<u64>(),
            elapsed_ledgers in 0u32..=(DEFAULT_RATE_LIMIT * 2),
        ) {
            let env = Env::default();
            env.mock_all_auths();

            let contract_id = env.register_contract(None, CreatorRegistryContract);
            let client = CreatorRegistryContractClient::new(&env, &contract_id);
            let admin = Address::generate(&env);
            let first_creator = Address::generate(&env);
            let second_creator = Address::generate(&env);
            client.initialize(&admin);

            env.ledger().with_mut(|ledger| ledger.sequence_number = 100);
            client.register_creator(&admin, &first_creator, &first_id);
            env.ledger()
                .with_mut(|ledger| ledger.sequence_number = 100 + elapsed_ledgers);

            let result = client.try_register_creator(&admin, &second_creator, &second_id);
            if elapsed_ledgers < DEFAULT_RATE_LIMIT {
                prop_assert_eq!(
                    result,
                    Err(Ok(SorobanError::from_contract_error(Error::RateLimited as u32)))
                );
                prop_assert_eq!(client.get_creator_id(&second_creator), None);
            } else {
                prop_assert_eq!(result, Ok(Ok(())));
                prop_assert_eq!(client.get_creator_id(&second_creator), Some(second_id));
            }

            prop_assert_eq!(client.get_creator_id(&first_creator), Some(first_id));
        }

        /// A creator_id is globally unique: once claimed by one address, no
        /// other address may register with the same id, regardless of order
        /// or how many other distinct ids are registered around it.
        #[test]
        fn prop_creator_id_is_globally_unique(
            shared_id in any::<u64>(),
            other_ids in prop::collection::vec(any::<u64>(), 0..8),
        ) {
            let env = Env::default();
            env.mock_all_auths();

            let contract_id = env.register_contract(None, CreatorRegistryContract);
            let client = CreatorRegistryContractClient::new(&env, &contract_id);
            let admin = Address::generate(&env);
            let first_owner = Address::generate(&env);
            client.initialize(&admin);

            client.register_creator(&first_owner, &first_owner, &shared_id);
            let mut claimed_ids = std::vec![shared_id];

            for other_id in other_ids {
                let claimant = Address::generate(&env);
                let result = client.try_register_creator(&claimant, &claimant, &shared_id);
                prop_assert_eq!(
                    result,
                    Err(Ok(SorobanError::from_contract_error(Error::CreatorIdTaken as u32))),
                    "a second address must never claim an already-registered creator_id"
                );
                prop_assert_eq!(client.get_creator_id(&claimant), None);

                if !claimed_ids.contains(&other_id) {
                    // A genuinely distinct id from a distinct address must still succeed.
                    let distinct_owner = Address::generate(&env);
                    client.register_creator(&distinct_owner, &distinct_owner, &other_id);
                    prop_assert_eq!(client.get_creator_id(&distinct_owner), Some(other_id));
                    claimed_ids.push(other_id);
                }
            }

            prop_assert_eq!(client.get_creator_id(&first_owner), Some(shared_id));
        }
    }
}
