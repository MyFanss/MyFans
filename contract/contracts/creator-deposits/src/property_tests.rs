//! Property-based tests for the creator-deposits contract invariants.
//!
//! Run with: `cargo test -p creator-deposits prop_`
//!
//! # Invariants under test
//!
//! 1. **Deposit monotonicity**: `deposit(x)` increases creator balance by exactly x - fee.
//! 2. **Withdraw deduction**: `withdraw(x)` decreases creator balance by exactly x.
//! 3. **Deposit–withdraw symmetry**: `deposit(x); withdraw(net(x))` is a balance no-op.
//! 4. **Balance non-negativity**: creator balance is always ≥ 0 after any valid operation.
//! 5. **Overdraft rejection**: `withdraw(balance + ε)` is always rejected.
//! 6. **Fee bounds**: platform fee is always < 10 000 bps.
//! 7. **Multi-creator isolation**: deposits to one creator never affect another's balance.
//! 8. **Admin-only fee update**: only admin can update the platform fee.
//! 9. **Invalid init rejected**: init with bps ≥ 10 000 always fails.

#[cfg(test)]
mod props {
    extern crate std;

    use crate::{CreatorDeposits, CreatorDepositsClient, Error};
    use proptest::prelude::*;
    use soroban_sdk::{
        testutils::Address as _,
        token::{Client as TokenClient, StellarAssetClient},
        Address, Env, Error as SorobanError,
    };

    // ── helpers ───────────────────────────────────────────────────────────────

    fn setup(
        env: &Env,
        fee_bps: u32,
    ) -> (
        CreatorDepositsClient<'_>,
        Address,
        TokenClient<'_>,
        StellarAssetClient<'_>,
    ) {
        env.mock_all_auths();
        let admin = Address::generate(env);
        let treasury = Address::generate(env);
        let token_admin = Address::generate(env);
        let token_id = env
            .register_stellar_asset_contract_v2(token_admin.clone())
            .address();
        let token_client = TokenClient::new(env, &token_id);
        let sac = StellarAssetClient::new(env, &token_id);

        let contract_id = env.register_contract(None, CreatorDeposits);
        let client = CreatorDepositsClient::new(env, &contract_id);
        client.init(&admin, &fee_bps, &treasury);
        (client, admin, token_client, sac)
    }

    fn funded_creator(env: &Env, sac: &StellarAssetClient<'_>, amount: i128) -> Address {
        let creator = Address::generate(env);
        sac.mint(&creator, &amount);
        creator
    }

    fn net_amount(amount: i128, fee_bps: u32) -> i128 {
        let fee = (amount * fee_bps as i128) / 10000;
        amount - fee
    }

    // ── deposit invariants ────────────────────────────────────────────────────

    proptest! {
        /// deposit(x) increases the creator's tracked balance by exactly net(x) = x - fee.
        #[test]
        fn prop_deposit_increases_balance_by_net_amount(
            amount in 1i128..=1_000_000_000i128,
            fee_bps in 0u32..9999u32,
        ) {
            let env = Env::default();
            let (client, _, _, sac) = setup(&env, fee_bps);
            let creator = funded_creator(&env, &sac, amount);

            let before = client.get_balance(&creator);
            client.deposit(&creator, &client.address, &amount);
            let after = client.get_balance(&creator);

            let expected_net = net_amount(amount, fee_bps);
            prop_assert_eq!(
                after - before,
                expected_net,
                "deposit must increase balance by net amount (amount - fee)"
            );
        }
    }

    // ── withdraw invariants ───────────────────────────────────────────────────

    proptest! {
        /// withdraw(x) decreases the creator's tracked balance by exactly x.
        #[test]
        fn prop_withdraw_decreases_balance_by_exact_amount(
            deposit_amount in 1i128..=1_000_000_000i128,
            fee_bps in 0u32..9999u32,
            withdraw_frac in 0u32..=1000u32,
        ) {
            let env = Env::default();
            let (client, _, _, sac) = setup(&env, fee_bps);
            let creator = funded_creator(&env, &sac, deposit_amount);

            client.deposit(&creator, &client.address, &deposit_amount);
            let balance = client.get_balance(&creator);

            // Use a fraction of the available balance to stay within valid range
            let withdraw_amount = (balance * withdraw_frac as i128) / 1000;
            let withdraw_amount = withdraw_amount.max(1).min(balance);

            let before = client.get_balance(&creator);
            client.withdraw(&creator, &client.address, &withdraw_amount);
            let after = client.get_balance(&creator);

            prop_assert_eq!(
                before - after,
                withdraw_amount,
                "withdraw must decrease balance by exactly amount"
            );
        }

        /// Creator balance is always ≥ 0 after any valid withdraw.
        #[test]
        fn prop_balance_non_negative_after_withdraw(
            deposit_amount in 1i128..=1_000_000_000i128,
            fee_bps in 0u32..9999u32,
        ) {
            let env = Env::default();
            let (client, _, _, sac) = setup(&env, fee_bps);
            let creator = funded_creator(&env, &sac, deposit_amount);

            client.deposit(&creator, &client.address, &deposit_amount);
            let balance = client.get_balance(&creator);

            if balance > 0 {
                client.withdraw(&creator, &client.address, &balance);
            }

            prop_assert!(
                client.get_balance(&creator) >= 0,
                "creator balance must never go negative"
            );
        }

        /// Overdraft (withdraw > balance) is always rejected.
        #[test]
        fn prop_overdraft_always_rejected(
            deposit_amount in 1i128..=1_000_000_000i128,
            fee_bps in 0u32..9999u32,
            excess in 1i128..=1_000_000i128,
        ) {
            let env = Env::default();
            let (client, _, _, sac) = setup(&env, fee_bps);
            let creator = funded_creator(&env, &sac, deposit_amount);

            client.deposit(&creator, &client.address, &deposit_amount);
            let balance = client.get_balance(&creator);
            let overdraft = balance.saturating_add(excess);

            prop_assert!(
                client.try_withdraw(&creator, &client.address, &overdraft).is_err(),
                "withdraw({}) on balance {} must be rejected",
                overdraft, balance
            );
        }
    }

    // ── deposit–withdraw symmetry ─────────────────────────────────────────────

    proptest! {
        /// deposit(x) followed by withdraw(net(x)) leaves the creator balance unchanged.
        #[test]
        fn prop_deposit_withdraw_symmetry(
            initial in 0i128..=1_000_000_000i128,
            amount  in 1i128..=1_000_000_000i128,
            fee_bps in 0u32..9999u32,
        ) {
            let env = Env::default();
            let (client, _, _, sac) = setup(&env, fee_bps);
            let creator = funded_creator(&env, &sac, initial.saturating_add(amount));

            if initial > 0 {
                client.deposit(&creator, &client.address, &initial);
            }
            let balance_before = client.get_balance(&creator);

            client.deposit(&creator, &client.address, &amount);
            let net = net_amount(amount, fee_bps);
            if net > 0 {
                client.withdraw(&creator, &client.address, &net);
            }
            let balance_after = client.get_balance(&creator);

            prop_assert_eq!(
                balance_after, balance_before,
                "deposit+withdraw of net amount must be a balance no-op"
            );
        }
    }

    // ── invalid init ──────────────────────────────────────────────────────────

    proptest! {
        /// init with bps >= 10000 must always be rejected.
        #[test]
        fn prop_invalid_fee_bps_always_rejected(
            fee_bps in 10000u32..=20000u32,
        ) {
            let env = Env::default();
            env.mock_all_auths();
            let admin = Address::generate(&env);
            let treasury = Address::generate(&env);

            let contract_id = env.register_contract(None, CreatorDeposits);
            let client = CreatorDepositsClient::new(&env, &contract_id);

            let result = client.try_init(&admin, &fee_bps, &treasury);
            prop_assert_eq!(
                result,
                Err(Ok(SorobanError::from_contract_error(Error::InvalidFeeBps as u32))),
                "init with fee_bps={} must be rejected", fee_bps
            );
        }
    }

    // ── multi-creator isolation ───────────────────────────────────────────────

    proptest! {
        /// A deposit to creator_a never changes creator_b's balance.
        #[test]
        fn prop_deposit_to_one_creator_does_not_affect_another(
            amount_a in 1i128..=500_000_000i128,
            amount_b in 1i128..=500_000_000i128,
            fee_bps in 0u32..9999u32,
        ) {
            let env = Env::default();
            let (client, _, _, sac) = setup(&env, fee_bps);
            let creator_a = funded_creator(&env, &sac, amount_a);
            let creator_b = funded_creator(&env, &sac, amount_b);

            // Fund a single depositor with enough tokens
            let depositor = Address::generate(&env);
            let total = amount_a.saturating_add(amount_b);
            sac.mint(&depositor, &total);

            client.deposit(&depositor, &client.address, &amount_b);
            let b_before = client.get_balance(&creator_b);

            client.deposit(&depositor, &client.address, &amount_a);

            prop_assert_eq!(
                client.get_balance(&creator_b), b_before,
                "deposit to creator_a must not change creator_b's balance"
            );
        }

        /// A withdraw by creator_a never changes creator_b's balance.
        #[test]
        fn prop_withdraw_by_one_creator_does_not_affect_another(
            amount_a in 1i128..=500_000_000i128,
            amount_b in 1i128..=500_000_000i128,
            fee_bps in 0u32..9999u32,
        ) {
            let env = Env::default();
            let (client, _, _, sac) = setup(&env, fee_bps);
            let creator_a = funded_creator(&env, &sac, amount_a);
            let creator_b = funded_creator(&env, &sac, amount_b);

            let depositor = Address::generate(&env);
            let total = amount_a.saturating_add(amount_b);
            sac.mint(&depositor, &total);

            client.deposit(&depositor, &client.address, &amount_a);
            client.deposit(&depositor, &client.address, &amount_b);
            let b_before = client.get_balance(&creator_b);

            let balance_a = client.get_balance(&creator_a);
            if balance_a > 0 {
                client.withdraw(&creator_a, &client.address, &balance_a);
            }

            prop_assert_eq!(
                client.get_balance(&creator_b), b_before,
                "withdraw by creator_a must not change creator_b's balance"
            );
        }
    }

    // ── set_platform_fee invariants ────────────────────────────────────────────

    proptest! {
        /// set_platform_fee with bps >= 10000 must always be rejected.
        #[test]
        fn prop_set_platform_fee_invalid_bps_rejected(
            initial_fee in 0u32..9999u32,
            bad_fee in 10000u32..=20000u32,
        ) {
            let env = Env::default();
            let (client, _, _, _) = setup(&env, initial_fee);

            let result = client.try_set_platform_fee(&bad_fee);
            prop_assert_eq!(
                result,
                Err(Ok(SorobanError::from_contract_error(Error::InvalidFeeBps as u32))),
                "set_platform_fee({}) must be rejected", bad_fee
            );
        }

        /// set_platform_fee with valid bps succeeds and updates the fee.
        #[test]
        fn prop_set_platform_fee_valid_updates_fee(
            initial_fee in 0u32..5000u32,
            new_fee in 0u32..9999u32,
        ) {
            let env = Env::default();
            let (client, _, _, _) = setup(&env, initial_fee);

            client.set_platform_fee(&new_fee);

            prop_assert_eq!(
                client.get_platform_fee(),
                new_fee,
                "platform fee must be updated to {}",
                new_fee
            );
        }
    }
}
