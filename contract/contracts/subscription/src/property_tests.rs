//! Property-based tests for the subscription contract invariants.
//!
//! Run with: `cargo test -p subscription prop_`

#[cfg(test)]
mod props {
    use crate::{Error, MyfansContract, MyfansContractClient};
    use proptest::prelude::*;
    use soroban_sdk::{
        testutils::{Address as _, Ledger},
        token, Address, Env, String,
    };

    // ── helpers ──────────────────────────────────────────────────────────────

    fn setup(env: &Env) -> (MyfansContractClient<'_>, Address, Address, Address) {
        env.mock_all_auths();
        env.ledger().with_mut(|li| {
            li.min_persistent_entry_ttl = 10_000_000;
            li.min_temp_entry_ttl = 10_000_000;
        });

        let admin = Address::generate(env);
        let fee_recipient = Address::generate(env);

        let token_address = env.register_stellar_asset_contract_v2(admin.clone());
        let token_admin = token::StellarAssetClient::new(env, &token_address.address());

        let contract_id = env.register_contract(None, MyfansContract);
        let client = MyfansContractClient::new(env, &contract_id);

        // fee_bps = 500 (5%), price = 1000
        client.init(
            &admin,
            &500,
            &fee_recipient,
            &token_address.address(),
            &1000,
        );

        // Mint generous balance to a shared fan address used by callers.
        let fan = Address::generate(env);
        token_admin.mint(&fan, &1_000_000_000);

        (client, admin, fee_recipient, fan)
    }

    // ── fee split invariant ──────────────────────────────────────────────────

    proptest! {
        /// For any valid fee_bps (0..=10_000) and price (1..=1_000_000), the
        /// creator receives exactly `price - fee` and the fee recipient receives
        /// exactly `fee`, so creator_amount + fee == price (no tokens created or
        /// destroyed).
        #[test]
        fn prop_fee_split_sums_to_price(
            fee_bps in 0u32..=10_000u32,
            price in 1i128..=1_000_000i128,
        ) {
            let env = Env::default();
            env.mock_all_auths();
            env.ledger().with_mut(|li| {
                li.min_persistent_entry_ttl = 10_000_000;
                li.min_temp_entry_ttl = 10_000_000;
            });

            let admin = Address::generate(&env);
            let fee_recipient = Address::generate(&env);
            let token_address = env.register_stellar_asset_contract_v2(admin.clone());
            let token_admin = token::StellarAssetClient::new(&env, &token_address.address());

            let contract_id = env.register_contract(None, MyfansContract);
            let client = MyfansContractClient::new(&env, &contract_id);

            client.init(&admin, &fee_bps, &fee_recipient, &token_address.address(), &price);

            let fan = Address::generate(&env);
            let creator = Address::generate(&env);
            token_admin.mint(&fan, &price);

            client.create_subscription(&fan, &creator, &1000);

            let fee = (price * fee_bps as i128) / 10_000;
            let creator_amount = price - fee;

            prop_assert_eq!(
                token::Client::new(&env, &token_address.address()).balance(&creator),
                creator_amount,
                "creator balance must equal price minus fee"
            );
            prop_assert_eq!(
                token::Client::new(&env, &token_address.address()).balance(&fee_recipient),
                fee,
                "fee recipient balance must equal fee"
            );
            prop_assert_eq!(
                creator_amount + fee,
                price,
                "creator_amount + fee must equal price"
            );
        }
    }

    // ── is_subscriber expiry invariant ───────────────────────────────────────

    proptest! {
        /// After subscribing with `duration_ledgers`, `is_subscriber` returns
        /// true at the current ledger and false after advancing past expiry.
        #[test]
        fn prop_is_subscriber_respects_expiry(
            duration_ledgers in 1u32..=10_000u32,
        ) {
            let env = Env::default();
            let (client, _, _, fan) = setup(&env);

            let creator = Address::generate(&env);
            client.create_subscription(&fan, &creator, &duration_ledgers);

            // Active immediately after subscribing.
            prop_assert!(
                client.is_subscriber(&fan, &creator),
                "must be subscriber right after subscribing"
            );

            // Advance ledger past expiry.
            env.ledger().with_mut(|li| {
                li.sequence_number += duration_ledgers + 1;
            });

            prop_assert!(
                !client.is_subscriber(&fan, &creator),
                "must not be subscriber after expiry"
            );
        }
    }

    // ── cancel removes subscription ──────────────────────────────────────────

    proptest! {
        /// After cancel, is_subscriber always returns false regardless of
        /// remaining duration.
        #[test]
        fn prop_cancel_removes_subscription(
            duration_ledgers in 1u32..=10_000u32,
            reason in 0u32..=4u32,
        ) {
            let env = Env::default();
            let (client, _, _, fan) = setup(&env);

            let creator = Address::generate(&env);
            client.create_subscription(&fan, &creator, &duration_ledgers);

            prop_assert!(client.is_subscriber(&fan, &creator));

            client.cancel(&fan, &creator, &reason);

            prop_assert!(
                !client.is_subscriber(&fan, &creator),
                "must not be subscriber after cancel"
            );
        }
    }

    // ── invalid fee_bps rejected ─────────────────────────────────────────────

    proptest! {
        /// fee_bps > 10_000 must always be rejected with InvalidFeeBps.
        #[test]
        fn prop_init_rejects_fee_bps_over_10000(
            fee_bps in 10_001u32..=u32::MAX,
        ) {
            let env = Env::default();
            env.mock_all_auths();

            let admin = Address::generate(&env);
            let fee_recipient = Address::generate(&env);
            let token_address = env.register_stellar_asset_contract_v2(admin.clone());

            let contract_id = env.register_contract(None, MyfansContract);
            let client = MyfansContractClient::new(&env, &contract_id);

            let result = client.try_init(
                &admin,
                &fee_bps,
                &fee_recipient,
                &token_address.address(),
                &1000,
            );
            prop_assert_eq!(
                result,
                Err(Ok(soroban_sdk::Error::from_contract_error(
                    Error::InvalidFeeBps as u32,
                )))
            );
        }
    }

    // ── non-positive price rejected ──────────────────────────────────────────

    proptest! {
        /// price ≤ 0 must always be rejected with InvalidPrice.
        #[test]
        fn prop_init_rejects_non_positive_price(
            price in i128::MIN..=0i128,
        ) {
            let env = Env::default();
            env.mock_all_auths();

            let admin = Address::generate(&env);
            let fee_recipient = Address::generate(&env);
            let token_address = env.register_stellar_asset_contract_v2(admin.clone());

            let contract_id = env.register_contract(None, MyfansContract);
            let client = MyfansContractClient::new(&env, &contract_id);

            let result = client.try_init(
                &admin,
                &500,
                &fee_recipient,
                &token_address.address(),
                &price,
            );
            prop_assert_eq!(
                result,
                Err(Ok(soroban_sdk::Error::from_contract_error(
                    Error::InvalidPrice as u32,
                )))
            );
        }
    }
}
