//! Property-based tests for creator-earnings contract invariants.
//!
//! Run with: `cargo test -p creator-earnings prop_`
//!
//! # Invariants under test
//!
//! 1. **Deposit monotonicity**: `deposit(x)` increases creator balance by exactly x.
//! 2. **Withdraw deduction**: `withdraw(x)` decreases creator balance by exactly x.
//! 3. **Deposit–withdraw symmetry**: `deposit(x); withdraw(x)` is a no-op on balance.
//! 4. **Balance non-negativity**: creator balance is always ≥ 0 after any valid operation.
//! 5. **Overdraft rejection**: `withdraw(balance + ε)` is always rejected.
//! 6. **Zero/negative rejection**: `deposit(≤ 0)` and `withdraw(≤ 0)` always fail.
//! 7. **Token custody**: contract token balance equals sum of all creator balances.
//! 8. **Multi-creator isolation**: deposits to one creator never affect another's balance.

#[cfg(test)]
mod props {
    extern crate std;

    use crate::{CreatorEarnings, CreatorEarningsClient, Error};
    use proptest::prelude::*;
    use soroban_sdk::{
        testutils::Address as _,
        token::{Client as TokenClient, StellarAssetClient},
        Address, Env, Error as SorobanError,
    };

    // ── helpers ───────────────────────────────────────────────────────────────

    fn setup(env: &Env) -> (CreatorEarningsClient<'_>, Address, TokenClient<'_>, StellarAssetClient<'_>) {
        env.mock_all_auths();
        let admin = Address::generate(env);
        let token_admin = Address::generate(env);
        let token_id = env
            .register_stellar_asset_contract_v2(token_admin.clone())
            .address();
        let token_client = TokenClient::new(env, &token_id);
        let sac = StellarAssetClient::new(env, &token_id);
        let contract_id = env.register_contract(None, CreatorEarnings);
        let client = CreatorEarningsClient::new(env, &contract_id);
        client.initialize(&admin, &token_id);
        // admin is already authorized as depositor; also register it explicitly
        client.add_authorized(&admin);
        (client, admin, token_client, sac)
    }

    fn funded_depositor(
        env: &Env,
        sac: &StellarAssetClient<'_>,
        client: &CreatorEarningsClient<'_>,
        amount: i128,
    ) -> Address {
        let depositor = Address::generate(env);
        sac.mint(&depositor, &amount);
        client.add_authorized(&depositor);
        depositor
    }

    // ── deposit invariants ────────────────────────────────────────────────────

    proptest! {
        /// deposit(x) increases the creator's tracked balance by exactly x.
        #[test]
        fn prop_deposit_increases_balance_by_exact_amount(
            amount in 1i128..=1_000_000_000i128,
        ) {
            let env = Env::default();
            let (client, _, _, sac) = setup(&env);
            let creator = Address::generate(&env);
            let depositor = funded_depositor(&env, &sac, &client, amount);

            let before = client.balance(&creator);
            client.deposit(&depositor, &creator, &amount);
            let after = client.balance(&creator);

            prop_assert_eq!(after - before, amount, "deposit must increase balance by exactly amount");
        }

        /// deposit(0) and deposit(negative) are always rejected.
        #[test]
        fn prop_non_positive_deposit_always_rejected(
            bad_amount in i128::MIN..=0i128,
        ) {
            let env = Env::default();
            let (client, _, _, sac) = setup(&env);
            let creator = Address::generate(&env);
            let depositor = funded_depositor(&env, &sac, &client, 1_000_000);

            prop_assert!(
                client.try_deposit(&depositor, &creator, &bad_amount).is_err(),
                "deposit({}) must be rejected", bad_amount
            );
        }

        /// Unauthorized caller is always rejected regardless of amount.
        #[test]
        fn prop_unauthorized_deposit_always_rejected(
            amount in 1i128..=1_000_000_000i128,
        ) {
            let env = Env::default();
            let (client, _, _, sac) = setup(&env);
            let creator = Address::generate(&env);
            // Mint tokens but do NOT call add_authorized.
            let unauthorized = Address::generate(&env);
            sac.mint(&unauthorized, &amount);

            prop_assert_eq!(
                client.try_deposit(&unauthorized, &creator, &amount),
                Err(Ok(SorobanError::from_contract_error(Error::NotAuthorized as u32))),
                "unauthorized deposit({}) must be rejected", amount
            );
        }
    }

    // ── withdraw invariants ───────────────────────────────────────────────────

    proptest! {
        /// withdraw(x) decreases the creator's tracked balance by exactly x.
        #[test]
        fn prop_withdraw_decreases_balance_by_exact_amount(
            initial in 1i128..=1_000_000_000i128,
            withdraw_amount in 1i128..=1_000_000_000i128,
        ) {
            let withdraw_amount = withdraw_amount.min(initial);
            let env = Env::default();
            let (client, _, _, sac) = setup(&env);
            let creator = Address::generate(&env);
            let depositor = funded_depositor(&env, &sac, &client, initial);
            client.deposit(&depositor, &creator, &initial);

            let before = client.balance(&creator);
            client.withdraw(&creator, &withdraw_amount);
            let after = client.balance(&creator);

            prop_assert_eq!(before - after, withdraw_amount, "withdraw must decrease balance by exactly amount");
        }

        /// Creator balance is always ≥ 0 after any valid withdraw.
        #[test]
        fn prop_balance_non_negative_after_withdraw(
            initial in 1i128..=1_000_000_000i128,
            withdraw_amount in 1i128..=1_000_000_000i128,
        ) {
            let withdraw_amount = withdraw_amount.min(initial);
            let env = Env::default();
            let (client, _, _, sac) = setup(&env);
            let creator = Address::generate(&env);
            let depositor = funded_depositor(&env, &sac, &client, initial);
            client.deposit(&depositor, &creator, &initial);

            client.withdraw(&creator, &withdraw_amount);

            prop_assert!(client.balance(&creator) >= 0, "creator balance must never go negative");
        }

        /// Overdraft (withdraw > balance) is always rejected.
        #[test]
        fn prop_overdraft_always_rejected(
            initial in 1i128..=1_000_000_000i128,
            excess in 1i128..=1_000_000i128,
        ) {
            let env = Env::default();
            let (client, _, _, sac) = setup(&env);
            let creator = Address::generate(&env);
            let depositor = funded_depositor(&env, &sac, &client, initial);
            client.deposit(&depositor, &creator, &initial);

            let overdraft = initial.saturating_add(excess);
            prop_assert!(
                client.try_withdraw(&creator, &overdraft).is_err(),
                "withdraw({}) on balance {} must be rejected", overdraft, initial
            );
        }

        /// withdraw(0) and withdraw(negative) are always rejected.
        #[test]
        fn prop_non_positive_withdraw_always_rejected(
            initial in 1i128..=1_000_000_000i128,
            bad_amount in i128::MIN..=0i128,
        ) {
            let env = Env::default();
            let (client, _, _, sac) = setup(&env);
            let creator = Address::generate(&env);
            let depositor = funded_depositor(&env, &sac, &client, initial);
            client.deposit(&depositor, &creator, &initial);

            prop_assert!(
                client.try_withdraw(&creator, &bad_amount).is_err(),
                "withdraw({}) must be rejected", bad_amount
            );
        }
    }

    // ── deposit–withdraw symmetry ─────────────────────────────────────────────

    proptest! {
        /// deposit(x) followed by withdraw(x) leaves the creator balance unchanged.
        #[test]
        fn prop_deposit_withdraw_symmetry(
            initial in 0i128..=1_000_000_000i128,
            amount  in 1i128..=1_000_000_000i128,
        ) {
            let env = Env::default();
            let (client, _, _, sac) = setup(&env);
            let creator = Address::generate(&env);
            let total_mint = initial.saturating_add(amount);
            let depositor = funded_depositor(&env, &sac, &client, total_mint);

            if initial > 0 {
                client.deposit(&depositor, &creator, &initial);
            }
            let balance_before = client.balance(&creator);

            client.deposit(&depositor, &creator, &amount);
            client.withdraw(&creator, &amount);
            let balance_after = client.balance(&creator);

            prop_assert_eq!(
                balance_after, balance_before,
                "deposit+withdraw of same amount must be a balance no-op"
            );
        }
    }

    // ── token custody invariant ───────────────────────────────────────────────

    proptest! {
        /// The contract's token balance equals the sum of all creator balances
        /// (no tokens created or destroyed by deposit/withdraw).
        #[test]
        fn prop_token_custody_matches_sum_of_creator_balances(
            a in 1i128..=500_000_000i128,
            b in 1i128..=500_000_000i128,
            withdraw_a in 1i128..=500_000_000i128,
        ) {
            let withdraw_a = withdraw_a.min(a);
            let env = Env::default();
            let (client, _, token_client, sac) = setup(&env);
            let creator_a = Address::generate(&env);
            let creator_b = Address::generate(&env);
            let depositor = funded_depositor(&env, &sac, &client, a.saturating_add(b));

            client.deposit(&depositor, &creator_a, &a);
            client.deposit(&depositor, &creator_b, &b);
            client.withdraw(&creator_a, &withdraw_a);

            let bal_a = client.balance(&creator_a);
            let bal_b = client.balance(&creator_b);
            let contract_tokens = token_client.balance(&client.address);

            prop_assert_eq!(
                contract_tokens,
                bal_a + bal_b,
                "contract token balance must equal sum of creator balances"
            );
        }
    }

    // ── multi-creator isolation ───────────────────────────────────────────────

    proptest! {
        /// A deposit to creator_a never changes creator_b's balance.
        #[test]
        fn prop_deposit_to_one_creator_does_not_affect_another(
            amount_a in 1i128..=1_000_000_000i128,
            amount_b in 1i128..=1_000_000_000i128,
        ) {
            let env = Env::default();
            let (client, _, _, sac) = setup(&env);
            let creator_a = Address::generate(&env);
            let creator_b = Address::generate(&env);
            let total = amount_a.saturating_add(amount_b);
            let depositor = funded_depositor(&env, &sac, &client, total);

            client.deposit(&depositor, &creator_b, &amount_b);
            let b_before = client.balance(&creator_b);

            client.deposit(&depositor, &creator_a, &amount_a);

            prop_assert_eq!(
                client.balance(&creator_b), b_before,
                "deposit to creator_a must not change creator_b's balance"
            );
        }

        /// A withdraw by creator_a never changes creator_b's balance.
        #[test]
        fn prop_withdraw_by_one_creator_does_not_affect_another(
            amount_a in 1i128..=1_000_000_000i128,
            amount_b in 1i128..=1_000_000_000i128,
            withdraw_a in 1i128..=1_000_000_000i128,
        ) {
            let withdraw_a = withdraw_a.min(amount_a);
            let env = Env::default();
            let (client, _, _, sac) = setup(&env);
            let creator_a = Address::generate(&env);
            let creator_b = Address::generate(&env);
            let total = amount_a.saturating_add(amount_b);
            let depositor = funded_depositor(&env, &sac, &client, total);

            client.deposit(&depositor, &creator_a, &amount_a);
            client.deposit(&depositor, &creator_b, &amount_b);
            let b_before = client.balance(&creator_b);

            client.withdraw(&creator_a, &withdraw_a);

            prop_assert_eq!(
                client.balance(&creator_b), b_before,
                "withdraw by creator_a must not change creator_b's balance"
            );
        }
    }
}
