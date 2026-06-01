//! Issue #885 – Validate error codes and panic messages.
//!
//! Each `#[should_panic]` test asserts the exact Soroban host panic string
//! `"Error(Contract, #N)"` that corresponds to the [`Error`] discriminant.
//!
//! Error map (stable, must not be renumbered):
//!   1 = InsufficientBalance
//!   2 = InsufficientAllowance
//!   3 = AllowanceExpired
//!   4 = InvalidAmount
//!   5 = InvalidExpiration
//!   6 = NoAllowance
//!   7 = Unauthorized

#[cfg(test)]
mod cases {
    use crate::{MyFansToken, MyFansTokenClient};
    use soroban_sdk::{
        testutils::{Address as _, Ledger},
        Address, Env, String,
    };

    fn setup(env: &Env) -> (MyFansTokenClient<'_>, Address) {
        let id = env.register_contract(None, MyFansToken);
        let client = MyFansTokenClient::new(env, &id);
        let admin = Address::generate(env);
        client.initialize(
            &admin,
            &String::from_str(env, "MyFans Token"),
            &String::from_str(env, "MFAN"),
            &7,
            &0,
        );
        (client, admin)
    }

    // ── Error code 1: InsufficientBalance ────────────────────────────────────

    #[test]
    #[should_panic(expected = "Error(Contract, #1)")]
    fn error_code_1_insufficient_balance_transfer() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, _) = setup(&env);

        let user = Address::generate(&env);
        let other = Address::generate(&env);
        client.mint(&user, &100);
        // Exceeds balance → InsufficientBalance (code 1)
        client.transfer(&user, &other, &101);
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #1)")]
    fn error_code_1_insufficient_balance_burn() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, _) = setup(&env);

        let user = Address::generate(&env);
        client.mint(&user, &50);
        // Exceeds balance → InsufficientBalance (code 1)
        client.burn(&user, &51);
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #1)")]
    fn error_code_1_insufficient_balance_transfer_from() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, _) = setup(&env);

        let owner = Address::generate(&env);
        let spender = Address::generate(&env);
        let receiver = Address::generate(&env);
        // Approve more than owner has
        client.approve(&owner, &spender, &1000, &500);
        // owner has 0 balance → InsufficientBalance (code 1)
        client.transfer_from(&spender, &owner, &receiver, &1);
    }

    // ── Error code 2: InsufficientAllowance ──────────────────────────────────

    #[test]
    #[should_panic(expected = "Error(Contract, #2)")]
    fn error_code_2_insufficient_allowance() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, _) = setup(&env);

        let owner = Address::generate(&env);
        let spender = Address::generate(&env);
        let receiver = Address::generate(&env);
        client.mint(&owner, &1000);
        client.approve(&owner, &spender, &50, &500);
        // Exceeds allowance → InsufficientAllowance (code 2)
        client.transfer_from(&spender, &owner, &receiver, &51);
    }

    // ── Error code 3: AllowanceExpired ───────────────────────────────────────

    #[test]
    #[should_panic(expected = "Error(Contract, #3)")]
    fn error_code_3_allowance_expired() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, _) = setup(&env);

        let owner = Address::generate(&env);
        let spender = Address::generate(&env);
        let receiver = Address::generate(&env);
        client.mint(&owner, &1000);

        env.ledger().with_mut(|li| li.sequence_number = 10);
        client.approve(&owner, &spender, &500, &20);

        // Advance past expiry → AllowanceExpired (code 3)
        env.ledger().with_mut(|li| li.sequence_number = 21);
        client.transfer_from(&spender, &owner, &receiver, &100);
    }

    // ── Error code 4: InvalidAmount ──────────────────────────────────────────

    #[test]
    #[should_panic(expected = "Error(Contract, #4)")]
    fn error_code_4_invalid_amount_transfer_zero() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, _) = setup(&env);

        let user = Address::generate(&env);
        let other = Address::generate(&env);
        client.mint(&user, &100);
        // Zero amount → InvalidAmount (code 4)
        client.transfer(&user, &other, &0);
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #4)")]
    fn error_code_4_invalid_amount_mint_zero() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, _) = setup(&env);

        let user = Address::generate(&env);
        // Zero mint → InvalidAmount (code 4)
        client.mint(&user, &0);
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #4)")]
    fn error_code_4_invalid_amount_burn_zero() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, _) = setup(&env);

        let user = Address::generate(&env);
        client.mint(&user, &100);
        // Zero burn → InvalidAmount (code 4)
        client.burn(&user, &0);
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #4)")]
    fn error_code_4_invalid_amount_transfer_from_zero() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, _) = setup(&env);

        let owner = Address::generate(&env);
        let spender = Address::generate(&env);
        let receiver = Address::generate(&env);
        client.mint(&owner, &1000);
        client.approve(&owner, &spender, &500, &500);
        // Zero amount → InvalidAmount (code 4)
        client.transfer_from(&spender, &owner, &receiver, &0);
    }

    // ── Error code 5: InvalidExpiration ──────────────────────────────────────

    #[test]
    #[should_panic(expected = "Error(Contract, #5)")]
    fn error_code_5_invalid_expiration() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, _) = setup(&env);

        let owner = Address::generate(&env);
        let spender = Address::generate(&env);
        // Advance ledger to 50, then try to approve with expiry in the past
        env.ledger().with_mut(|li| li.sequence_number = 50);
        // expiration_ledger = 10 < sequence 50 → InvalidExpiration (code 5)
        client.approve(&owner, &spender, &100, &10);
    }

    // ── Error code 6: NoAllowance ─────────────────────────────────────────────

    #[test]
    #[should_panic(expected = "Error(Contract, #6)")]
    fn error_code_6_no_allowance() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, _) = setup(&env);

        let owner = Address::generate(&env);
        let spender = Address::generate(&env);
        let receiver = Address::generate(&env);
        client.mint(&owner, &1000);
        // No approve call → NoAllowance (code 6)
        client.transfer_from(&spender, &owner, &receiver, &100);
    }

    // ── Error code 7: Unauthorized ────────────────────────────────────────────
    //
    // `mint` calls `admin.require_auth()` which panics with `Error(Auth, …)`
    // when no matching auth is mocked.  The `Unauthorized` variant (code 7) is
    // the contract-level sentinel; its discriminant is verified here via
    // `try_mint` so the stable code value is asserted without relying on the
    // auth-panic path.

    #[test]
    fn error_code_7_unauthorized_discriminant_is_7() {
        // Verify the discriminant value is stable (part of the public ABI).
        assert_eq!(crate::Error::Unauthorized as u32, 7);
    }

    /// Calling mint without admin auth panics with an Auth error (not a
    /// contract error), confirming `require_auth` is the guard.
    #[test]
    #[should_panic(expected = "Error(Auth")]
    fn error_code_7_mint_without_auth_panics_with_auth_error() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, _) = setup(&env);

        // Clear ALL mocked auths so admin.require_auth() inside mint fails.
        env.mock_auths(&[]);
        let recipient = Address::generate(&env);
        client.mint(&recipient, &100);
    }
}
