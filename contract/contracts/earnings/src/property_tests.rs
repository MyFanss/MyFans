//! Property-based tests for the earnings contract invariants (issue #969).
//!
//! Run with: `cargo test -p earnings prop_`
//!
//! # Invariants under test
//!
//! 1. **Record monotonicity**: `record(x)` increases creator's earnings by exactly x.
//! 2. **Withdraw deduction**: `withdraw(x)` decreases creator's earnings by exactly x.
//! 3. **Record–withdraw symmetry**: `record(x); withdraw(x)` is a no-op on earnings.
//! 4. **Balance non-negativity**: earnings are always ≥ 0 after any valid operation.
//! 5. **Overdraft rejection**: `withdraw(balance + ε)` is always rejected.
//! 6. **Init-once invariant**: second `init` call always fails regardless of admin address.
//! 7. **Multi-creator isolation**: records for one creator never affect another's earnings.

#[cfg(test)]
mod props {
    extern crate std;

    use crate::{Earnings, EarningsClient, Error};
    use proptest::prelude::*;
    use soroban_sdk::{testutils::Address as _, Address, Env, Error as SorobanError};

    // ── helpers ───────────────────────────────────────────────────────────────

    fn setup(env: &Env) -> (EarningsClient<'_>, Address) {
        env.mock_all_auths();
        let admin = Address::generate(env);
        let contract_id = env.register_contract(None, Earnings);
        let client = EarningsClient::new(env, &contract_id);
        client.init(&admin);
        (client, admin)
    }

    // ── record invariants ─────────────────────────────────────────────────────

    proptest! {
        /// record(x) increases the creator's earnings by exactly x.
        #[test]
        fn prop_record_increases_earnings_by_exact_amount(
            amount in 1i128..=1_000_000_000i128,
        ) {
            let env = Env::default();
            let (client, _) = setup(&env);
            let creator = Address::generate(&env);

            let before = client.get_earnings(&creator);
            client.record(&creator, &amount);
            let after = client.get_earnings(&creator);

            prop_assert_eq!(
                after - before,
                amount,
                "record must increase earnings by exactly amount"
            );
        }

        /// Multiple sequential records accumulate: total equals the sum of all amounts.
        #[test]
        fn prop_multiple_records_accumulate_correctly(
            a in 1i128..=500_000_000i128,
            b in 1i128..=500_000_000i128,
        ) {
            let env = Env::default();
            let (client, _) = setup(&env);
            let creator = Address::generate(&env);

            client.record(&creator, &a);
            client.record(&creator, &b);

            prop_assert_eq!(
                client.get_earnings(&creator),
                a + b,
                "two records must sum correctly"
            );
        }

        /// A creator with no records always has earnings of 0.
        #[test]
        fn prop_unrecorded_creator_has_zero_earnings(
            _seed in 0u32..=1000u32,
        ) {
            let env = Env::default();
            let (client, _) = setup(&env);
            let creator = Address::generate(&env);

            prop_assert_eq!(
                client.get_earnings(&creator),
                0i128,
                "creator with no records must have 0 earnings"
            );
        }
    }

    // ── withdraw invariants ───────────────────────────────────────────────────

    proptest! {
        /// withdraw(x) decreases the creator's earnings by exactly x.
        #[test]
        fn prop_withdraw_decreases_earnings_by_exact_amount(
            initial in 1i128..=1_000_000_000i128,
            withdraw_amount in 1i128..=1_000_000_000i128,
        ) {
            let withdraw_amount = withdraw_amount.min(initial);
            let env = Env::default();
            let (client, _) = setup(&env);
            let creator = Address::generate(&env);
            client.record(&creator, &initial);

            let before = client.get_earnings(&creator);
            client.withdraw(&creator, &withdraw_amount);
            let after = client.get_earnings(&creator);

            prop_assert_eq!(
                before - after,
                withdraw_amount,
                "withdraw must decrease earnings by exactly amount"
            );
        }

        /// Creator earnings are always ≥ 0 after any valid withdraw.
        #[test]
        fn prop_balance_non_negative_after_withdraw(
            initial in 1i128..=1_000_000_000i128,
            withdraw_amount in 1i128..=1_000_000_000i128,
        ) {
            let withdraw_amount = withdraw_amount.min(initial);
            let env = Env::default();
            let (client, _) = setup(&env);
            let creator = Address::generate(&env);
            client.record(&creator, &initial);

            client.withdraw(&creator, &withdraw_amount);

            prop_assert!(
                client.get_earnings(&creator) >= 0,
                "earnings must never go negative"
            );
        }

        /// Overdraft (withdraw > balance) is always rejected.
        #[test]
        fn prop_overdraft_always_rejected(
            initial in 1i128..=1_000_000_000i128,
            excess in 1i128..=1_000_000i128,
        ) {
            let env = Env::default();
            let (client, _) = setup(&env);
            let creator = Address::generate(&env);
            client.record(&creator, &initial);

            let overdraft = initial.saturating_add(excess);
            prop_assert!(
                client.try_withdraw(&creator, &overdraft).is_err(),
                "withdraw({}) on balance {} must be rejected",
                overdraft,
                initial
            );
        }

        /// Withdrawing from a zero balance is always rejected.
        #[test]
        fn prop_withdraw_from_zero_always_rejected(
            amount in 1i128..=1_000_000_000i128,
        ) {
            let env = Env::default();
            let (client, _) = setup(&env);
            let creator = Address::generate(&env);

            prop_assert!(
                client.try_withdraw(&creator, &amount).is_err(),
                "withdraw from zero balance must always be rejected"
            );
        }
    }

    // ── record–withdraw symmetry ──────────────────────────────────────────────

    proptest! {
        /// record(x) followed by withdraw(x) leaves earnings unchanged.
        #[test]
        fn prop_record_withdraw_symmetry(
            initial in 0i128..=1_000_000_000i128,
            amount  in 1i128..=1_000_000_000i128,
        ) {
            let env = Env::default();
            let (client, _) = setup(&env);
            let creator = Address::generate(&env);

            if initial > 0 {
                client.record(&creator, &initial);
            }
            let balance_before = client.get_earnings(&creator);

            client.record(&creator, &amount);
            client.withdraw(&creator, &amount);
            let balance_after = client.get_earnings(&creator);

            prop_assert_eq!(
                balance_after,
                balance_before,
                "record+withdraw of same amount must be an earnings no-op"
            );
        }
    }

    // ── init-once invariant ───────────────────────────────────────────────────

    proptest! {
        /// A second init call always fails with AlreadyInitialized regardless of the admin address.
        #[test]
        fn prop_second_init_always_fails(
            _seed in 0u32..=1000u32,
        ) {
            let env = Env::default();
            let (client, admin) = setup(&env);

            let second_admin = Address::generate(&env);
            let result_same = client.try_init(&admin);
            let result_new  = client.try_init(&second_admin);

            prop_assert_eq!(
                result_same,
                Err(Ok(SorobanError::from_contract_error(
                    Error::AlreadyInitialized as u32
                ))),
                "second init with same admin must fail"
            );
            prop_assert_eq!(
                result_new,
                Err(Ok(SorobanError::from_contract_error(
                    Error::AlreadyInitialized as u32
                ))),
                "second init with different admin must also fail"
            );
        }
    }

    // ── multi-creator isolation ───────────────────────────────────────────────

    proptest! {
        /// A record for creator_a never changes creator_b's earnings.
        #[test]
        fn prop_record_for_one_creator_does_not_affect_another(
            amount_a in 1i128..=1_000_000_000i128,
            amount_b in 1i128..=1_000_000_000i128,
        ) {
            let env = Env::default();
            let (client, _) = setup(&env);
            let creator_a = Address::generate(&env);
            let creator_b = Address::generate(&env);

            client.record(&creator_b, &amount_b);
            let b_before = client.get_earnings(&creator_b);

            client.record(&creator_a, &amount_a);

            prop_assert_eq!(
                client.get_earnings(&creator_b),
                b_before,
                "record for creator_a must not change creator_b's earnings"
            );
        }

        /// A withdraw by creator_a never changes creator_b's earnings.
        #[test]
        fn prop_withdraw_by_one_creator_does_not_affect_another(
            amount_a in 1i128..=1_000_000_000i128,
            amount_b in 1i128..=1_000_000_000i128,
            withdraw_a in 1i128..=1_000_000_000i128,
        ) {
            let withdraw_a = withdraw_a.min(amount_a);
            let env = Env::default();
            let (client, _) = setup(&env);
            let creator_a = Address::generate(&env);
            let creator_b = Address::generate(&env);

            client.record(&creator_a, &amount_a);
            client.record(&creator_b, &amount_b);
            let b_before = client.get_earnings(&creator_b);

            client.withdraw(&creator_a, &withdraw_a);

            prop_assert_eq!(
                client.get_earnings(&creator_b),
                b_before,
                "withdraw by creator_a must not change creator_b's earnings"
            );
        }
    }
}
