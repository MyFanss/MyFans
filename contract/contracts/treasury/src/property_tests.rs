//! Property-based tests for treasury contract invariants (issue #909).
//!
//! Uses `proptest` to verify that the treasury's core invariants hold for
//! arbitrary input combinations — not just the specific values in unit tests.
//!
//! # Invariants under test
//!
//! 1. **Deposit monotonicity**: `deposit(x)` increases treasury balance by exactly x.
//! 2. **Withdraw deduction**: `withdraw(x)` decreases treasury balance by exactly x.
//! 3. **Deposit–withdraw symmetry**: `deposit(x); withdraw(x)` is a no-op on balance.
//! 4. **Balance non-negativity**: treasury balance is always ≥ 0 after any valid operation.
//! 5. **Overdraft rejection**: `withdraw(balance + ε)` is always rejected.
//! 6. **Zero/negative rejection**: `deposit(≤ 0)` and `withdraw(≤ 0)` always fail.
//! 7. **Min-balance guard**: withdraw leaving balance < min_balance always fails.
//! 8. **Paused guard**: while paused, deposit and withdraw both always fail.

#[cfg(test)]
mod props {
    extern crate std;

    use crate::{Treasury, TreasuryClient};
    use proptest::prelude::*;
    use soroban_sdk::{
        testutils::Address as _,
        token::{StellarAssetClient, TokenClient},
        Address, Env,
    };

    // ── helpers ──────────────────────────────────────────────────────────────

    fn create_token<'a>(
        env: &Env,
        admin: &Address,
    ) -> (Address, TokenClient<'a>, StellarAssetClient<'a>) {
        let addr = env
            .register_stellar_asset_contract_v2(admin.clone())
            .address();
        (addr.clone(), TokenClient::new(env, &addr), StellarAssetClient::new(env, &addr))
    }

    fn setup_with_balance(
        env: &Env,
        initial_deposit: i128,
    ) -> (TreasuryClient<'_>, Address, TokenClient<'_>, Address) {
        env.mock_all_auths();
        let admin = Address::generate(env);
        let depositor = Address::generate(env);
        let (token_addr, token_client, sac) = create_token(env, &admin);
        sac.mint(&depositor, &initial_deposit);
        let treasury_id = env.register_contract(None, Treasury);
        let client = TreasuryClient::new(env, &treasury_id);
        client.initialize(&admin, &token_addr);
        client.deposit(&depositor, &initial_deposit);
        (client, depositor, token_client, treasury_id)
    }

    // ── deposit invariants ────────────────────────────────────────────────────

    proptest! {
        /// For any positive amount, deposit increases the treasury balance by exactly that amount.
        #[test]
        fn prop_deposit_increases_balance_by_exact_amount(
            amount in 1i128..=1_000_000_000i128,
        ) {
            let env = Env::default();
            env.mock_all_auths();
            let admin = Address::generate(&env);
            let depositor = Address::generate(&env);
            let (token_addr, token_client, sac) = create_token(&env, &admin);
            sac.mint(&depositor, &amount);
            let treasury_id = env.register_contract(None, Treasury);
            let client = TreasuryClient::new(&env, &treasury_id);
            client.initialize(&admin, &token_addr);

            let before = token_client.balance(&treasury_id);
            client.deposit(&depositor, &amount);
            let after = token_client.balance(&treasury_id);

            prop_assert_eq!(after - before, amount, "deposit must increase balance by exactly amount");
        }

        /// deposit(0) and deposit(negative) always fail.
        #[test]
        fn prop_non_positive_deposit_always_rejected(
            bad_amount in i128::MIN..=0i128,
        ) {
            let env = Env::default();
            env.mock_all_auths();
            let admin = Address::generate(&env);
            let depositor = Address::generate(&env);
            let (token_addr, _, sac) = create_token(&env, &admin);
            sac.mint(&depositor, &1_000_000);
            let treasury_id = env.register_contract(None, Treasury);
            let client = TreasuryClient::new(&env, &treasury_id);
            client.initialize(&admin, &token_addr);

            prop_assert!(
                client.try_deposit(&depositor, &bad_amount).is_err(),
                "deposit({}) must be rejected", bad_amount
            );
        }
    }

    // ── withdraw invariants ───────────────────────────────────────────────────

    proptest! {
        /// For any positive amount ≤ balance, withdraw decreases treasury balance by exactly that amount.
        #[test]
        fn prop_withdraw_decreases_balance_by_exact_amount(
            initial in 1i128..=1_000_000_000i128,
            withdraw_amount in 1i128..=1_000_000_000i128,
        ) {
            // Only test when withdraw_amount ≤ initial (valid case).
            let withdraw_amount = withdraw_amount.min(initial);
            let env = Env::default();
            let (client, _, token_client, treasury_id) = setup_with_balance(&env, initial);
            let recipient = Address::generate(&env);

            let before = token_client.balance(&treasury_id);
            client.withdraw(&recipient, &withdraw_amount);
            let after = token_client.balance(&treasury_id);

            prop_assert_eq!(before - after, withdraw_amount, "withdraw must decrease balance by exactly amount");
        }

        /// Treasury balance is always ≥ 0 after any valid withdraw.
        #[test]
        fn prop_balance_non_negative_after_withdraw(
            initial in 1i128..=1_000_000_000i128,
            withdraw_amount in 1i128..=1_000_000_000i128,
        ) {
            let withdraw_amount = withdraw_amount.min(initial);
            let env = Env::default();
            let (client, _, token_client, treasury_id) = setup_with_balance(&env, initial);
            let recipient = Address::generate(&env);

            client.withdraw(&recipient, &withdraw_amount);
            let balance = token_client.balance(&treasury_id);

            prop_assert!(balance >= 0, "treasury balance must never go negative; got {}", balance);
        }

        /// Overdraft (withdraw > balance) is always rejected.
        #[test]
        fn prop_overdraft_always_rejected(
            initial in 1i128..=1_000_000_000i128,
            excess in 1i128..=1_000_000i128,
        ) {
            let env = Env::default();
            let (client, _, _, _) = setup_with_balance(&env, initial);
            let recipient = Address::generate(&env);
            let overdraft = initial.saturating_add(excess);

            prop_assert!(
                client.try_withdraw(&recipient, &overdraft).is_err(),
                "withdraw({}) on balance {} must be rejected", overdraft, initial
            );
        }

        /// withdraw(0) and withdraw(negative) always fail.
        #[test]
        fn prop_non_positive_withdraw_always_rejected(
            initial in 1i128..=1_000_000_000i128,
            bad_amount in i128::MIN..=0i128,
        ) {
            let env = Env::default();
            let (client, _, _, _) = setup_with_balance(&env, initial);
            let recipient = Address::generate(&env);

            prop_assert!(
                client.try_withdraw(&recipient, &bad_amount).is_err(),
                "withdraw({}) must be rejected", bad_amount
            );
        }
    }

    // ── deposit–withdraw symmetry ─────────────────────────────────────────────

    proptest! {
        /// deposit(x) followed by withdraw(x) leaves the treasury balance unchanged.
        #[test]
        fn prop_deposit_withdraw_symmetry(
            initial in 0i128..=1_000_000_000i128,
            amount  in 1i128..=1_000_000_000i128,
        ) {
            let env = Env::default();
            env.mock_all_auths();
            let admin = Address::generate(&env);
            let depositor = Address::generate(&env);
            let recipient = Address::generate(&env);
            let (token_addr, token_client, sac) = create_token(&env, &admin);
            // Mint enough for both the initial balance and the round-trip deposit.
            let total_mint = initial.saturating_add(amount);
            sac.mint(&depositor, &total_mint);
            let treasury_id = env.register_contract(None, Treasury);
            let client = TreasuryClient::new(&env, &treasury_id);
            client.initialize(&admin, &token_addr);

            // Establish initial balance.
            if initial > 0 {
                client.deposit(&depositor, &initial);
            }
            let balance_before = token_client.balance(&treasury_id);

            // Round-trip: deposit then withdraw the same amount.
            client.deposit(&depositor, &amount);
            client.withdraw(&recipient, &amount);
            let balance_after = token_client.balance(&treasury_id);

            prop_assert_eq!(
                balance_after, balance_before,
                "deposit+withdraw of same amount must be a balance no-op"
            );
        }
    }

    // ── min_balance invariant ─────────────────────────────────────────────────

    proptest! {
        /// Withdrawing below the configured min_balance is always rejected.
        #[test]
        fn prop_withdrawal_below_min_balance_rejected(
            initial in 2i128..=1_000_000_000i128,
            min_balance_frac in 1u32..=50u32, // min_balance = initial * frac/100
            extra_withdraw in 1i128..=1_000_000i128,
        ) {
            let min_balance = (initial * min_balance_frac as i128) / 100;
            if min_balance == 0 || min_balance >= initial {
                return Ok(());
            }

            let env = Env::default();
            let (client, _, _, _) = setup_with_balance(&env, initial);
            let recipient = Address::generate(&env);

            client.set_min_balance(&min_balance);

            // Compute the maximum valid withdraw: initial - min_balance.
            let max_valid = initial - min_balance;
            // Attempt to withdraw more than max_valid.
            let overdraw = max_valid.saturating_add(extra_withdraw).min(initial);
            if overdraw > max_valid {
                prop_assert!(
                    client.try_withdraw(&recipient, &overdraw).is_err(),
                    "withdraw({}) below min_balance {} must be rejected (initial={})",
                    overdraw, min_balance, initial
                );
            }
        }
    }

    // ── paused invariant ──────────────────────────────────────────────────────

    proptest! {
        /// While paused, deposit always fails regardless of amount.
        #[test]
        fn prop_paused_deposit_always_rejected(
            amount in 1i128..=1_000_000_000i128,
        ) {
            let env = Env::default();
            env.mock_all_auths();
            let admin = Address::generate(&env);
            let depositor = Address::generate(&env);
            let (token_addr, _, sac) = create_token(&env, &admin);
            sac.mint(&depositor, &amount);
            let treasury_id = env.register_contract(None, Treasury);
            let client = TreasuryClient::new(&env, &treasury_id);
            client.initialize(&admin, &token_addr);
            client.set_paused(&true);

            prop_assert!(
                client.try_deposit(&depositor, &amount).is_err(),
                "deposit must fail when paused"
            );
        }

        /// While paused, withdraw always fails regardless of available balance.
        #[test]
        fn prop_paused_withdraw_always_rejected(
            initial in 1i128..=1_000_000_000i128,
            withdraw_amount in 1i128..=1_000_000_000i128,
        ) {
            let withdraw_amount = withdraw_amount.min(initial);
            let env = Env::default();
            let (client, _, _, _) = setup_with_balance(&env, initial);
            let recipient = Address::generate(&env);
            client.set_paused(&true);

            prop_assert!(
                client.try_withdraw(&recipient, &withdraw_amount).is_err(),
                "withdraw must fail when paused"
            );
        }
    }
}
