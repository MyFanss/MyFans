//! Property-based tests for myfans-token transfer operations.
//!
//! These tests use `proptest` to drive arbitrary inputs through the token's
//! transfer, transfer_from, mint, and burn paths, verifying invariants that
//! must hold for any valid combination of amounts and balances.
//!
//! Run with: `cargo test -p myfans-token prop_`

#[cfg(test)]
mod props {
    use crate::{Error, MyFansToken, MyFansTokenClient};
    use proptest::prelude::*;
    use soroban_sdk::{
        testutils::{Address as _, Ledger},
        Address, Env, String,
    };

    // ── helpers ──────────────────────────────────────────────────────────────

    fn setup(env: &Env) -> (MyFansTokenClient<'_>, Address) {
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
        (client, admin)
    }

    // ── transfer invariants ──────────────────────────────────────────────────

    proptest! {
        /// For any valid transfer amount (1..=balance), balances shift by exactly
        /// `amount` and total supply is conserved.
        #[test]
        fn prop_transfer_conserves_supply(
            mint_amount in 1i128..=1_000_000_000i128,
            transfer_amount in 1i128..=1_000_000_000i128,
        ) {
            let env = Env::default();
            env.mock_all_auths();
            let (client, _) = setup(&env);

            let sender = Address::generate(&env);
            let receiver = Address::generate(&env);

            client.mint(&sender, &mint_amount);
            let supply_before = client.total_supply();

            // Only transfer if we have enough balance.
            if transfer_amount <= mint_amount {
                client.transfer(&sender, &receiver, &transfer_amount);

                prop_assert_eq!(client.balance(&sender), mint_amount - transfer_amount);
                prop_assert_eq!(client.balance(&receiver), transfer_amount);
                prop_assert_eq!(client.total_supply(), supply_before, "supply must not change on transfer");
            }
        }

        /// Zero and negative amounts must always be rejected with InvalidAmount.
        #[test]
        fn prop_transfer_rejects_non_positive_amount(
            mint_amount in 1i128..=1_000_000i128,
            bad_amount in i128::MIN..=0i128,
        ) {
            let env = Env::default();
            env.mock_all_auths();
            let (client, _) = setup(&env);

            let sender = Address::generate(&env);
            let receiver = Address::generate(&env);

            client.mint(&sender, &mint_amount);

            prop_assert_eq!(
                client.try_transfer(&sender, &receiver, &bad_amount),
                Err(Ok(Error::InvalidAmount))
            );
        }

        /// Transferring more than the balance must always fail with InsufficientBalance.
        #[test]
        fn prop_transfer_fails_when_exceeds_balance(
            mint_amount in 0i128..=1_000_000i128,
            excess in 1i128..=1_000_000i128,
        ) {
            let env = Env::default();
            env.mock_all_auths();
            let (client, _) = setup(&env);

            let sender = Address::generate(&env);
            let receiver = Address::generate(&env);

            if mint_amount > 0 {
                client.mint(&sender, &mint_amount);
            }

            let over_amount = mint_amount.saturating_add(excess);
            // over_amount is always > mint_amount (balance), so must fail.
            prop_assert_eq!(
                client.try_transfer(&sender, &receiver, &over_amount),
                Err(Ok(Error::InsufficientBalance))
            );
        }

        /// Self-transfer of a valid amount must succeed and leave balances unchanged.
        #[test]
        fn prop_self_transfer_is_noop(
            mint_amount in 1i128..=1_000_000i128,
            transfer_amount in 1i128..=1_000_000i128,
        ) {
            let env = Env::default();
            env.mock_all_auths();
            let (client, _) = setup(&env);

            let user = Address::generate(&env);
            client.mint(&user, &mint_amount);

            if transfer_amount <= mint_amount {
                client.transfer(&user, &user, &transfer_amount);
                // Balance must be unchanged after self-transfer.
                prop_assert_eq!(client.balance(&user), mint_amount);
            }
        }
    }

    // ── transfer_from invariants ─────────────────────────────────────────────

    proptest! {
        /// transfer_from with a valid allowance and sufficient balance must
        /// deduct from both the owner's balance and the remaining allowance.
        #[test]
        fn prop_transfer_from_deducts_allowance_and_balance(
            mint_amount   in 1i128..=1_000_000i128,
            allowance_amt in 1i128..=1_000_000i128,
            spend_amount  in 1i128..=1_000_000i128,
        ) {
            let env = Env::default();
            env.mock_all_auths();
            let (client, _) = setup(&env);

            let owner    = Address::generate(&env);
            let spender  = Address::generate(&env);
            let receiver = Address::generate(&env);

            client.mint(&owner, &mint_amount);
            // Approve with a ledger far in the future.
            client.approve(&owner, &spender, &allowance_amt, &10_000);

            if spend_amount <= allowance_amt && spend_amount <= mint_amount {
                client.transfer_from(&spender, &owner, &receiver, &spend_amount);

                prop_assert_eq!(client.balance(&owner),    mint_amount   - spend_amount);
                prop_assert_eq!(client.balance(&receiver), spend_amount);
                prop_assert_eq!(client.allowance(&owner, &spender), allowance_amt - spend_amount);
            }
        }

        /// transfer_from must fail with InsufficientAllowance when spend > allowance.
        #[test]
        fn prop_transfer_from_fails_when_exceeds_allowance(
            mint_amount   in 1i128..=1_000_000i128,
            allowance_amt in 1i128..=999_999i128,
            excess        in 1i128..=1_000_000i128,
        ) {
            let env = Env::default();
            env.mock_all_auths();
            let (client, _) = setup(&env);

            let owner    = Address::generate(&env);
            let spender  = Address::generate(&env);
            let receiver = Address::generate(&env);

            // Ensure owner has enough balance so the failure is about allowance.
            let big_mint = mint_amount.saturating_add(excess).saturating_add(allowance_amt);
            client.mint(&owner, &big_mint);
            client.approve(&owner, &spender, &allowance_amt, &10_000);

            let over_spend = allowance_amt.saturating_add(excess);
            prop_assert_eq!(
                client.try_transfer_from(&spender, &owner, &receiver, &over_spend),
                Err(Ok(Error::InsufficientAllowance))
            );
        }

        /// transfer_from must fail with AllowanceExpired when ledger > expiration.
        #[test]
        fn prop_transfer_from_fails_after_expiry(
            mint_amount  in 1i128..=1_000_000i128,
            spend_amount in 1i128..=1_000_000i128,
            expiry       in 2u32..=1_000u32,
            past_offset  in 1u32..=500u32,
        ) {
            let env = Env::default();
            env.mock_all_auths();
            let (client, _) = setup(&env);

            let owner    = Address::generate(&env);
            let spender  = Address::generate(&env);
            let receiver = Address::generate(&env);

            let big_mint = mint_amount.max(spend_amount);
            client.mint(&owner, &big_mint);
            client.approve(&owner, &spender, &big_mint, &expiry);

            // Advance ledger past expiry.
            let past_ledger = expiry.saturating_add(past_offset);
            env.ledger().with_mut(|li| li.sequence_number = past_ledger);

            prop_assert_eq!(
                client.try_transfer_from(&spender, &owner, &receiver, &spend_amount),
                Err(Ok(Error::AllowanceExpired))
            );
        }
    }

    // ── mint / burn invariants ───────────────────────────────────────────────

    proptest! {
        /// Minting must increase both the recipient's balance and total supply
        /// by exactly `amount`.
        #[test]
        fn prop_mint_increases_supply(amount in 1i128..=1_000_000_000i128) {
            let env = Env::default();
            env.mock_all_auths();
            let (client, _) = setup(&env);

            let recipient = Address::generate(&env);
            let supply_before = client.total_supply();

            client.mint(&recipient, &amount);

            prop_assert_eq!(client.balance(&recipient), amount);
            prop_assert_eq!(client.total_supply(), supply_before + amount);
        }

        /// Burning must decrease both the holder's balance and total supply
        /// by exactly `amount`.
        #[test]
        fn prop_burn_decreases_supply(
            mint_amount in 1i128..=1_000_000_000i128,
            burn_amount in 1i128..=1_000_000_000i128,
        ) {
            let env = Env::default();
            env.mock_all_auths();
            let (client, _) = setup(&env);

            let holder = Address::generate(&env);
            client.mint(&holder, &mint_amount);

            if burn_amount <= mint_amount {
                let supply_before = client.total_supply();
                client.burn(&holder, &burn_amount);

                prop_assert_eq!(client.balance(&holder), mint_amount - burn_amount);
                prop_assert_eq!(client.total_supply(), supply_before - burn_amount);
            }
        }

        /// Burning more than the balance must fail with InsufficientBalance.
        #[test]
        fn prop_burn_fails_when_exceeds_balance(
            mint_amount in 0i128..=1_000_000i128,
            excess      in 1i128..=1_000_000i128,
        ) {
            let env = Env::default();
            env.mock_all_auths();
            let (client, _) = setup(&env);

            let holder = Address::generate(&env);
            if mint_amount > 0 {
                client.mint(&holder, &mint_amount);
            }

            let over_burn = mint_amount.saturating_add(excess);
            prop_assert_eq!(
                client.try_burn(&holder, &over_burn),
                Err(Ok(Error::InsufficientBalance))
            );
        }

        /// Zero and negative burn amounts must be rejected with InvalidAmount.
        #[test]
        fn prop_burn_rejects_non_positive_amount(
            mint_amount in 1i128..=1_000_000i128,
            bad_amount  in i128::MIN..=0i128,
        ) {
            let env = Env::default();
            env.mock_all_auths();
            let (client, _) = setup(&env);

            let holder = Address::generate(&env);
            client.mint(&holder, &mint_amount);

            prop_assert_eq!(
                client.try_burn(&holder, &bad_amount),
                Err(Ok(Error::InvalidAmount))
            );
        }
    }
}
