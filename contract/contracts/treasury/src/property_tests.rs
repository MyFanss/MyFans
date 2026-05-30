//! Property tests for treasury contract invariants.
//!
//! These are parameterized "for-all" style tests that verify core invariants
//! hold across many input values, covering the boundary behavior that unit
//! tests with hand-picked values may miss.
//!
//! Invariants tested:
//! 1. **Token conservation**: treasury_balance = Σ deposits − Σ withdrawals
//! 2. **Pause invariant**: deposit and withdraw always fail while paused, for
//!    any positive amount
//! 3. **Min-balance floor**: after every successful withdraw, balance ≥ min_balance
//! 4. **Invalid-amount invariant**: amount ≤ 0 always rejected for deposit/withdraw
//! 5. **Negative min-balance invariant**: set_min_balance(<0) always rejected
//! 6. **Already-initialized invariant**: second initialize always fails

#[cfg(test)]
mod property_tests {
    use soroban_sdk::{
        testutils::Address as _,
        token::{StellarAssetClient, TokenClient},
        Address, Env,
    };

    use crate::Treasury;

    fn setup(env: &Env, initial_mint: i128) -> (Address, Address, Address, Address) {
        env.mock_all_auths();
        let admin = Address::generate(env);
        let user = Address::generate(env);
        let token_addr = env
            .register_stellar_asset_contract_v2(admin.clone())
            .address();
        StellarAssetClient::new(env, &token_addr).mint(&user, &initial_mint);
        let treasury_id = env.register_contract(None, Treasury);
        crate::TreasuryClient::new(env, &treasury_id).initialize(&admin, &token_addr);
        (admin, user, token_addr, treasury_id)
    }

    // ── Invariant 1: Token conservation ──────────────────────────────────────

    /// For any sequence of (deposit_amount, withdraw_amount) where
    /// deposit ≥ withdraw > 0, the treasury balance equals the difference.
    #[test]
    fn prop_token_conservation_across_amounts() {
        let cases: &[(i128, i128)] = &[
            (1, 1),
            (100, 50),
            (1_000, 999),
            (10_000, 1),
            (10_000, 10_000),
            (i64::MAX as i128, i64::MAX as i128 - 1),
        ];

        for &(deposit, withdraw) in cases {
            let env = Env::default();
            let (_admin, user, token_addr, treasury_id) = setup(&env, deposit);
            let token = TokenClient::new(&env, &token_addr);
            let client = crate::TreasuryClient::new(&env, &treasury_id);

            client.deposit(&user, &deposit);
            assert_eq!(
                token.balance(&treasury_id),
                deposit,
                "after deposit({deposit}): balance must equal deposit"
            );

            client.withdraw(&user, &withdraw);
            assert_eq!(
                token.balance(&treasury_id),
                deposit - withdraw,
                "after withdraw({withdraw}): balance must equal deposit - withdraw"
            );
        }
    }

    /// Multiple sequential deposits accumulate correctly.
    #[test]
    fn prop_sequential_deposits_accumulate() {
        let deposit_sequence: &[i128] = &[1, 10, 100, 500, 1_000, 3_389];
        let total: i128 = deposit_sequence.iter().sum();

        let env = Env::default();
        let (_admin, user, token_addr, treasury_id) = setup(&env, total);
        let token = TokenClient::new(&env, &token_addr);
        let client = crate::TreasuryClient::new(&env, &treasury_id);

        let mut running = 0i128;
        for &amount in deposit_sequence {
            client.deposit(&user, &amount);
            running += amount;
            assert_eq!(
                token.balance(&treasury_id),
                running,
                "balance must accumulate after deposit({amount})"
            );
        }
        assert_eq!(token.balance(&treasury_id), total);
    }

    // ── Invariant 2: Pause blocks all mutating ops ────────────────────────────

    /// For all positive amounts in the table, deposit always fails while paused.
    #[test]
    fn prop_paused_always_blocks_deposit() {
        let amounts: &[i128] = &[1, 50, 1_000, 99_999];

        for &amount in amounts {
            let env = Env::default();
            let (_admin, user, _token_addr, treasury_id) = setup(&env, amount);
            let client = crate::TreasuryClient::new(&env, &treasury_id);

            client.set_paused(&true);
            assert!(
                client.try_deposit(&user, &amount).is_err(),
                "deposit({amount}) must fail while paused"
            );
        }
    }

    /// For all positive amounts, withdraw always fails while paused (even when funded).
    #[test]
    fn prop_paused_always_blocks_withdraw() {
        let amounts: &[i128] = &[1, 50, 1_000, 99_999];

        for &amount in amounts {
            let env = Env::default();
            let (_admin, user, _token_addr, treasury_id) = setup(&env, amount * 2);
            let client = crate::TreasuryClient::new(&env, &treasury_id);

            client.deposit(&user, &amount);
            client.set_paused(&true);

            assert!(
                client.try_withdraw(&user, &amount).is_err(),
                "withdraw({amount}) must fail while paused"
            );
        }
    }

    // ── Invariant 3: Min-balance floor always respected ───────────────────────

    /// After every successful withdraw, balance ≥ min_balance for all valid combos.
    #[test]
    fn prop_min_balance_floor_always_holds_after_withdraw() {
        // (deposit, withdraw, min_balance) — all must satisfy deposit - withdraw >= min_balance
        let cases: &[(i128, i128, i128)] = &[
            (1_000, 500, 0),
            (1_000, 500, 500),
            (1_000, 999, 1),
            (10_000, 7_500, 2_500),
            (100, 1, 99),
        ];

        for &(deposit, withdraw, min_balance) in cases {
            let env = Env::default();
            let (_admin, user, token_addr, treasury_id) = setup(&env, deposit);
            let token = TokenClient::new(&env, &token_addr);
            let client = crate::TreasuryClient::new(&env, &treasury_id);

            client.deposit(&user, &deposit);
            client.set_min_balance(&min_balance);
            client.withdraw(&user, &withdraw);

            let remaining = token.balance(&treasury_id);
            assert!(
                remaining >= min_balance,
                "after withdraw({withdraw}), balance {remaining} < min_balance {min_balance}"
            );
        }
    }

    /// Withdrawals that would violate min_balance are always rejected.
    #[test]
    fn prop_min_balance_violation_always_rejected() {
        // (deposit, min_balance, withdraw_that_violates)
        let cases: &[(i128, i128, i128)] = &[
            (1_000, 500, 501),
            (1_000, 1_000, 1),
            (500, 100, 401),
            (10_000, 9_999, 2),
        ];

        for &(deposit, min_balance, withdraw) in cases {
            let env = Env::default();
            let (_admin, user, _token_addr, treasury_id) = setup(&env, deposit);
            let client = crate::TreasuryClient::new(&env, &treasury_id);

            client.deposit(&user, &deposit);
            client.set_min_balance(&min_balance);

            assert!(
                client.try_withdraw(&user, &withdraw).is_err(),
                "withdraw({withdraw}) with min_balance={min_balance} must be rejected"
            );
        }
    }

    // ── Invariant 4: Amount ≤ 0 always rejected ───────────────────────────────

    /// Zero and negative amounts always fail for deposit, regardless of state.
    #[test]
    fn prop_non_positive_amounts_always_rejected_for_deposit() {
        let invalid_amounts: &[i128] = &[0, -1, -100, i64::MIN as i128];

        for &amount in invalid_amounts {
            let env = Env::default();
            let (_admin, user, _token_addr, treasury_id) = setup(&env, 1_000);
            let client = crate::TreasuryClient::new(&env, &treasury_id);

            assert!(
                client.try_deposit(&user, &amount).is_err(),
                "deposit({amount}) must be rejected (amount ≤ 0)"
            );
        }
    }

    /// Zero and negative amounts always fail for withdraw, regardless of treasury balance.
    #[test]
    fn prop_non_positive_amounts_always_rejected_for_withdraw() {
        let invalid_amounts: &[i128] = &[0, -1, -100, i64::MIN as i128];

        for &amount in invalid_amounts {
            let env = Env::default();
            let (_admin, user, _token_addr, treasury_id) = setup(&env, 10_000);
            let client = crate::TreasuryClient::new(&env, &treasury_id);

            client.deposit(&user, &10_000);

            assert!(
                client.try_withdraw(&user, &amount).is_err(),
                "withdraw({amount}) must be rejected (amount ≤ 0)"
            );
        }
    }

    // ── Invariant 5: Negative min_balance always rejected ────────────────────

    #[test]
    fn prop_negative_min_balance_always_rejected() {
        let invalid: &[i128] = &[-1, -100, i64::MIN as i128];

        for &amount in invalid {
            let env = Env::default();
            let (_admin, _user, _token_addr, treasury_id) = setup(&env, 1_000);
            let client = crate::TreasuryClient::new(&env, &treasury_id);

            assert!(
                client.try_set_min_balance(&amount).is_err(),
                "set_min_balance({amount}) must be rejected"
            );
        }
    }

    // ── Invariant 6: Double-initialize always rejected ────────────────────────

    #[test]
    fn prop_double_initialize_always_rejected() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let token_addr = env
            .register_stellar_asset_contract_v2(admin.clone())
            .address();
        let treasury_id = env.register_contract(None, Treasury);
        let client = crate::TreasuryClient::new(&env, &treasury_id);

        client.initialize(&admin, &token_addr);

        // Any subsequent initialize must fail, regardless of arguments
        for _ in 0..3 {
            assert!(
                client.try_initialize(&admin, &token_addr).is_err(),
                "second initialize must always fail"
            );
        }
    }
}
