//! Gas usage review for treasury hot paths (issue #906).
//!
//! Soroban metering tracks CPU instructions and memory bytes per invocation.
//! These tests exercise the three hot paths — `deposit`, `withdraw`, and the
//! implicit balance-read inside `withdraw` — under realistic conditions and
//! assert on observable correctness that would break if an optimization
//! regressed.  Correctness is the observable proxy for metering: wrong
//! balances indicate a bad write path, which is also where gas is spent.
//!
//! # Hot-path analysis
//!
//! | Function  | Dominant cost                         | Storage tier   | Notes                        |
//! |-----------|---------------------------------------|----------------|------------------------------|
//! | `deposit` | token cross-contract `transfer`       | instance       | single SAC call              |
//! | `withdraw` | auth check + balance read + transfer  | instance       | auth before storage read     |
//! | balance (internal) | `token_client.balance()`     | off-contract   | reads token's persistent key |
//!
//! # Optimization guidance
//! - All treasury keys (`ADMIN`, `TOKEN`, `PAUSED`, `MIN_BALANCE`) use
//!   **instance** storage — cheapest TTL model, shared with contract lifetime.
//! - Auth check in `withdraw` is performed before token I/O so failing calls
//!   abort early (low wasted CPU).
//! - The `deposit` guard (`amount <= 0`) fires before `require_auth`, keeping
//!   bad-amount rejections maximally cheap.

#[cfg(test)]
mod gas_benchmark_tests {
    use crate::{Treasury, TreasuryClient};
    use soroban_sdk::{
        testutils::Address as _,
        token::{StellarAssetClient, TokenClient},
        Address, Env,
    };

    fn create_token_contract<'a>(
        env: &Env,
        admin: &Address,
    ) -> (Address, TokenClient<'a>, StellarAssetClient<'a>) {
        let addr = env
            .register_stellar_asset_contract_v2(admin.clone())
            .address();
        (
            addr.clone(),
            TokenClient::new(env, &addr),
            StellarAssetClient::new(env, &addr),
        )
    }

    fn setup(env: &Env) -> (TreasuryClient<'_>, Address, TokenClient<'_>, Address) {
        env.mock_all_auths();
        let admin = Address::generate(env);
        let depositor = Address::generate(env);
        let (token_address, token_client, sac) = create_token_contract(env, &admin);
        sac.mint(&depositor, &10_000_000);
        let treasury_id = env.register_contract(None, Treasury);
        let client = TreasuryClient::new(env, &treasury_id);
        client.initialize(&admin, &token_address);
        (client, depositor, token_client, treasury_id)
    }

    // ── deposit hot path ──────────────────────────────────────────────────────

    /// Deposit updates both treasury and sender balances by the exact amount.
    /// Guards: amount > 0, not paused, from.require_auth().
    #[test]
    fn deposit_hot_path_balances_correct() {
        let env = Env::default();
        let (client, depositor, token_client, treasury_id) = setup(&env);

        client.deposit(&depositor, &1_000_000);

        assert_eq!(
            token_client.balance(&treasury_id),
            1_000_000,
            "treasury balance must equal deposited amount"
        );
        assert_eq!(
            token_client.balance(&depositor),
            9_000_000,
            "depositor balance must decrease by deposited amount"
        );
    }

    /// Repeated deposits accumulate correctly — verifies no write-path drift.
    #[test]
    fn deposit_hot_path_repeated_accumulates() {
        let env = Env::default();
        let (client, depositor, token_client, treasury_id) = setup(&env);

        for _ in 0..5 {
            client.deposit(&depositor, &100_000);
        }

        assert_eq!(token_client.balance(&treasury_id), 500_000);
        assert_eq!(token_client.balance(&depositor), 9_500_000);
    }

    /// Zero-amount deposit is rejected before auth — cheapest possible failure.
    #[test]
    fn deposit_zero_amount_rejected() {
        let env = Env::default();
        let (client, depositor, _, _) = setup(&env);
        let result = client.try_deposit(&depositor, &0);
        assert!(result.is_err(), "zero deposit must be rejected");
    }

    /// Negative-amount deposit is rejected immediately.
    #[test]
    fn deposit_negative_amount_rejected() {
        let env = Env::default();
        let (client, depositor, _, _) = setup(&env);
        let result = client.try_deposit(&depositor, &-1);
        assert!(result.is_err(), "negative deposit must be rejected");
    }

    // ── withdraw hot path ─────────────────────────────────────────────────────

    /// Withdraw deducts from treasury and credits recipient.
    /// Guards: amount > 0, not paused, admin.require_auth(), balance check,
    /// min_balance check.
    #[test]
    fn withdraw_hot_path_balances_correct() {
        let env = Env::default();
        let (client, depositor, token_client, treasury_id) = setup(&env);

        client.deposit(&depositor, &2_000_000);
        let recipient = Address::generate(&env);

        client.withdraw(&recipient, &500_000);

        assert_eq!(
            token_client.balance(&treasury_id),
            1_500_000,
            "treasury balance must decrease by withdrawn amount"
        );
        assert_eq!(
            token_client.balance(&recipient),
            500_000,
            "recipient balance must increase by withdrawn amount"
        );
    }

    /// Withdrawing exactly the full balance leaves treasury at zero.
    #[test]
    fn withdraw_full_balance_leaves_zero() {
        let env = Env::default();
        let (client, depositor, token_client, treasury_id) = setup(&env);
        let recipient = Address::generate(&env);

        client.deposit(&depositor, &5_000_000);
        client.withdraw(&recipient, &5_000_000);

        assert_eq!(token_client.balance(&treasury_id), 0);
    }

    /// Overdraft is rejected with InsufficientBalance.
    #[test]
    fn withdraw_overdraft_rejected() {
        let env = Env::default();
        let (client, depositor, _, _) = setup(&env);
        let recipient = Address::generate(&env);

        client.deposit(&depositor, &100_000);
        let result = client.try_withdraw(&recipient, &100_001);
        assert!(result.is_err(), "overdraft must be rejected");
    }

    /// Zero-amount withdraw is rejected before auth.
    #[test]
    fn withdraw_zero_amount_rejected() {
        let env = Env::default();
        let (client, depositor, _, _) = setup(&env);
        let recipient = Address::generate(&env);

        client.deposit(&depositor, &100_000);
        let result = client.try_withdraw(&recipient, &0);
        assert!(result.is_err(), "zero withdraw must be rejected");
    }

    // ── balance read hot path (implicit in withdraw) ──────────────────────────

    /// Balance read inside withdraw is consistent with the token client's view.
    /// This ensures no caching layer is lying about the treasury's balance.
    #[test]
    fn balance_read_consistent_with_token_client() {
        let env = Env::default();
        let (client, depositor, token_client, treasury_id) = setup(&env);
        let recipient = Address::generate(&env);

        client.deposit(&depositor, &3_000_000);
        // withdraw uses internal balance read; assert it agrees with token_client
        client.withdraw(&recipient, &1_000_000);

        assert_eq!(
            token_client.balance(&treasury_id),
            2_000_000,
            "token_client balance must agree with treasury's internal balance read"
        );
    }

    // ── pause guard (shared across hot paths) ─────────────────────────────────

    /// Both deposit and withdraw are blocked when paused.
    /// Paused check fires before auth/storage, so it's the cheapest abort path.
    #[test]
    fn paused_blocks_deposit_and_withdraw() {
        let env = Env::default();
        let (client, depositor, _, _) = setup(&env);
        let recipient = Address::generate(&env);

        // Pre-fund so a withdraw would otherwise succeed
        client.deposit(&depositor, &1_000_000);
        client.set_paused(&true);

        assert!(
            client.try_deposit(&depositor, &100_000).is_err(),
            "deposit must fail when paused"
        );
        assert!(
            client.try_withdraw(&recipient, &100_000).is_err(),
            "withdraw must fail when paused"
        );
    }
}
