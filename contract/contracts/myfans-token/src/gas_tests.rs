//! Issue #886 – Gas usage review for hot paths.
//!
//! These tests verify that the hot-path operations (transfer, transfer_from,
//! mint, burn) produce correct results after the TTL-threshold optimisation
//! applied to `write_balance`.  Correctness is the observable proxy for the
//! optimisation: if the threshold logic were broken the balances would be
//! wrong or the TTL extension would panic.

#[cfg(test)]
mod cases {
    use crate::{MyFansToken, MyFansTokenClient};
    use soroban_sdk::{testutils::Address as _, Address, Env, String};

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

    /// Repeated transfers must keep balances consistent (TTL threshold must not
    /// cause a missed write on subsequent calls).
    #[test]
    fn repeated_transfers_stay_consistent() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, _) = setup(&env);

        let alice = Address::generate(&env);
        let bob = Address::generate(&env);
        client.mint(&alice, &1_000);

        // 10 sequential transfers of 10 each
        for _ in 0..10 {
            client.transfer(&alice, &bob, &10);
        }

        assert_eq!(client.balance(&alice), 900);
        assert_eq!(client.balance(&bob), 100);
        assert_eq!(client.total_supply(), 1_000);
    }

    /// Repeated transfer_from calls must decrement allowance and balances
    /// correctly after the TTL-threshold optimisation.
    #[test]
    fn repeated_transfer_from_stays_consistent() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, _) = setup(&env);

        let owner = Address::generate(&env);
        let spender = Address::generate(&env);
        let receiver = Address::generate(&env);
        client.mint(&owner, &1_000);
        client.approve(&owner, &spender, &500, &10_000);

        for _ in 0..5 {
            client.transfer_from(&spender, &owner, &receiver, &50);
        }

        assert_eq!(client.balance(&owner), 750);
        assert_eq!(client.balance(&receiver), 250);
        assert_eq!(client.allowance(&owner, &spender), 250);
    }

    /// Mint followed by burn must leave total supply unchanged.
    #[test]
    fn mint_then_burn_supply_invariant() {
        let env = Env::default();
        env.mock_all_auths();
        let (client, _) = setup(&env);

        let user = Address::generate(&env);
        client.mint(&user, &500);
        client.burn(&user, &200);

        assert_eq!(client.balance(&user), 300);
        assert_eq!(client.total_supply(), 300);
    }
}
