//! Issue #313 – Token allowance expiration edge tests.
//!
//! The contract's `transfer_from` check is:
//!   `if data.expiration_ledger < env.ledger().sequence() { return Err(AllowanceExpired) }`
//!
//! This means `expiration_ledger` is **inclusive**: the allowance is valid when
//! `sequence <= expiration_ledger` and expired when `sequence > expiration_ledger`.
//!
//! All tests use ledger 100 as the expiration boundary to keep assertions exact
//! and deterministic.

#[cfg(test)]
mod allowance_expiry_tests {
    use crate::{Error, MyFansToken, MyFansTokenClient};
    use soroban_sdk::{
        testutils::{Address as _, Ledger},
        Address, Env, String,
    };

    /// Shared setup: deploy contract, mint `amount` to `owner`, approve `amount`
    /// for `spender` with `expiration_ledger = 100`.
    fn setup(env: &Env, amount: i128) -> (MyFansTokenClient, Address, Address, Address) {
        let contract_id = env.register_contract(None, MyFansToken);
        let client = MyFansTokenClient::new(env, &contract_id);

        let admin = Address::generate(env);
        client.initialize(
            &admin,
            &String::from_str(env, "MyFans Token"),
            &String::from_str(env, "MFAN"),
            &7,
            &0,
        );

        let owner = Address::generate(env);
        let spender = Address::generate(env);
        let receiver = Address::generate(env);

        client.mint(&owner, &amount);

        // Approve while ledger is at sequence 1 (default); expiry = 100.
        client.approve(&owner, &spender, &amount, &100);

        (client, owner, spender, receiver)
    }

    // ── Scenario A: Exact Boundary Success ───────────────────────────────────
    //
    // Verifying that `expiration_ledger = 100` is the **last valid** ledger.
    // At sequence 100 the check `100 < 100` is false → transfer succeeds.
    #[test]
    fn test_transfer_from_succeeds_at_exact_expiration_ledger() {
        let env = Env::default();
        env.mock_all_auths();

        let (client, owner, spender, receiver) = setup(&env, 500);

        // Advance to the exact expiration ledger.
        env.ledger().with_mut(|li| li.sequence_number = 100);

        // Must succeed: expiration_ledger (100) is NOT less than sequence (100).
        client.transfer_from(&spender, &owner, &receiver, &100);

        assert_eq!(client.balance(&receiver), 100);
        assert_eq!(client.allowance(&owner, &spender), 400);
    }

    // ── Scenario B: One-Ledger After Failure ─────────────────────────────────
    //
    // Verifying that `expiration_ledger = 100` is the **first invalid** ledger
    // boundary + 1. At sequence 101 the check `100 < 101` is true → AllowanceExpired.
    #[test]
    fn test_transfer_from_fails_one_ledger_after_expiration() {
        let env = Env::default();
        env.mock_all_auths();

        let (client, owner, spender, receiver) = setup(&env, 500);

        // Advance one ledger past expiration.
        env.ledger().with_mut(|li| li.sequence_number = 101);

        assert_eq!(
            client.try_transfer_from(&spender, &owner, &receiver, &100),
            Err(Ok(Error::AllowanceExpired)),
            "transfer_from must fail with AllowanceExpired at sequence 101"
        );

        // Balances must be untouched.
        assert_eq!(client.balance(&owner), 500);
        assert_eq!(client.balance(&receiver), 0);
    }

    // ── Scenario C: Mid-Batch Expiration ─────────────────────────────────────
    //
    // First transfer at ledger 99 succeeds; second transfer at ledger 101 fails.
    // Allowance after the failed call must equal the post-first-transfer remainder.
    #[test]
    fn test_mid_batch_expiration_second_transfer_fails() {
        let env = Env::default();
        env.mock_all_auths();

        let (client, owner, spender, receiver) = setup(&env, 500);

        // ── first transfer at ledger 99 (before expiry) ──────────────────────
        env.ledger().with_mut(|li| li.sequence_number = 99);
        client.transfer_from(&spender, &owner, &receiver, &200);

        assert_eq!(
            client.balance(&receiver),
            200,
            "first transfer must succeed"
        );
        let allowance_after_first = client.allowance(&owner, &spender);
        assert_eq!(allowance_after_first, 300, "allowance must decrease by 200");

        // ── second transfer at ledger 101 (past expiry) ──────────────────────
        env.ledger().with_mut(|li| li.sequence_number = 101);

        assert_eq!(
            client.try_transfer_from(&spender, &owner, &receiver, &100),
            Err(Ok(Error::AllowanceExpired)),
            "second transfer must fail with AllowanceExpired"
        );

        // Balances and allowance must be unchanged from the last successful state.
        assert_eq!(
            client.balance(&receiver),
            200,
            "receiver balance must not change after failed transfer"
        );
        assert_eq!(
            client.balance(&owner),
            300,
            "owner balance must not change after failed transfer"
        );
        // allowance() returns 0 for expired allowances (view function masks them).
        assert_eq!(
            client.allowance(&owner, &spender),
            0,
            "allowance view must return 0 for expired allowance"
        );
    }

    // ── Extra: allowance view returns 0 at exact expiry + 1 ─────────────────
    //
    // Confirms the `allowance()` view function is consistent with transfer_from.
    #[test]
    fn test_allowance_view_zero_after_expiry() {
        let env = Env::default();
        env.mock_all_auths();

        let (client, owner, spender, _) = setup(&env, 500);

        env.ledger().with_mut(|li| li.sequence_number = 100);
        assert_eq!(
            client.allowance(&owner, &spender),
            500,
            "valid at ledger 100"
        );

        env.ledger().with_mut(|li| li.sequence_number = 101);
        assert_eq!(
            client.allowance(&owner, &spender),
            0,
            "expired at ledger 101"
        );
    }
}
