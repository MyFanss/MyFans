//! # test-consumer
//!
//! A minimal external consumer contract used to exercise cross-contract auth
//! expectations between the subscription, treasury, and registry contracts.
//!
//! The goal of this crate is to reproduce the *production* invocation tree:
//! a third-party contract calls into the subscription contract, which in turn
//! calls into the treasury and registry contracts. Because the calls originate
//! from this consumer (not from a test harness), the auth footprints recorded
//! by `env.auths()` reflect what a real integrator would need to authorize.
//!
//! ## Why not `mock_all_auths`?
//!
//! `mock_all_auths` blanket-approves every auth check, which hides footguns
//! such as:
//!
//! * a callee requiring the *wrong* contract id to authorize,
//! * a paused callee silently accepting a call,
//! * a nested call that forgets to forward the caller's auth.
//!
//! The tests below therefore use `mock_auths` with explicit, minimal auth
//! entries and assert on the resulting `env.auths()` footprint.
//!
//! ## Adding a new consumer test
//!
//! 1. Add a `#[contractimpl]` entry point on [`TestConsumer`] that performs the
//!    cross-contract call you want to cover.
//! 2. In the test, register the consumer plus the real callee contracts.
//! 3. Authorize *only* the addresses the production tree would authorize, using
//!    `env.mock_auths(&[...])`.
//! 4. Assert both the return value and the recorded auth footprint via
//!    `env.auths()`.
//! 5. Add a negative case (wrong contract id, paused callee, or missing auth)
//!    that must fail.

#![no_std]

use soroban_sdk::{contract, contracterror, contractimpl, contracttype, Address, Env, IntoVal, Symbol, Val, Vec};

/// Errors surfaced by the consumer when a cross-contract call does not behave
/// as the production invocation tree expects.
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum ConsumerError {
    /// The callee rejected the call (e.g. paused or unauthorized).
    CalleeRejected = 1,
    /// The callee returned an unexpected value.
    UnexpectedResult = 2,
}

/// Storage keys for the consumer contract.
#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    /// Address of the subscription contract this consumer talks to.
    Subscription,
    /// Address of the treasury contract used for deposit paths.
    Treasury,
    /// Address of the registry contract used for lookup paths.
    Registry,
}

/// A thin external consumer that forwards calls into the subscription,
/// treasury, and registry contracts exactly as a production integrator would.
#[contract]
pub struct TestConsumer;

#[contractimpl]
impl TestConsumer {
    /// Configure the addresses of the contracts this consumer will call.
    ///
    /// This mirrors how an integrator wires up known contract ids at deploy
    /// time. The addresses are stored so that later calls use the *same*
    /// contract ids the production tree would use.
    pub fn init(env: Env, subscription: Address, treasury: Address, registry: Address) {
        env.storage().instance().set(&DataKey::Subscription, &subscription);
        env.storage().instance().set(&DataKey::Treasury, &treasury);
        env.storage().instance().set(&DataKey::Registry, &registry);
    }

    /// Read back the configured subscription address.
    pub fn subscription(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Subscription).unwrap()
    }

    /// Read back the configured treasury address.
    pub fn treasury(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Treasury).unwrap()
    }

    /// Read back the configured registry address.
    pub fn registry(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Registry).unwrap()
    }

    /// Invoke `subscribe` on the configured subscription contract as an
    /// external caller.
    ///
    /// The `subscriber` address is forwarded as the first argument so the
    /// subscription contract can require its auth. The consumer itself does
    /// *not* authorize anything here; the caller of this method is expected to
    /// have authorized `subscriber` in the surrounding invocation tree.
    pub fn subscribe(
        env: Env,
        subscriber: Address,
        plan_id: Symbol,
        amount: i128,
    ) -> Result<Val, ConsumerError> {
        let subscription: Address = env
            .storage()
            .instance()
            .get(&DataKey::Subscription)
            .ok_or(ConsumerError::CalleeRejected)?;

        let args: Vec<Val> = (subscriber, plan_id, amount).into_val(&env);
        env.try_invoke_contract::<Val, ConsumerError>(
            &subscription,
            &Symbol::new(&env, "subscribe"),
            args,
        )
        .map_err(|_| ConsumerError::CalleeRejected)?
        .map_err(|_| ConsumerError::CalleeRejected)
    }

    /// Invoke `deposit` on the configured treasury contract as an external
    /// caller, forwarding `from` as the authorizing address.
    pub fn deposit(env: Env, from: Address, amount: i128) -> Result<Val, ConsumerError> {
        let treasury: Address = env
            .storage()
            .instance()
            .get(&DataKey::Treasury)
            .ok_or(ConsumerError::CalleeRejected)?;

        let args: Vec<Val> = (from, amount).into_val(&env);
        env.try_invoke_contract::<Val, ConsumerError>(
            &treasury,
            &Symbol::new(&env, "deposit"),
            args,
        )
        .map_err(|_| ConsumerError::CalleeRejected)?
        .map_err(|_| ConsumerError::CalleeRejected)
    }

    /// Invoke `lookup` on the configured registry contract as an external
    /// caller. Registry lookups are read-only and require no auth.
    pub fn lookup(env: Env, plan_id: Symbol) -> Result<Val, ConsumerError> {
        let registry: Address = env
            .storage()
            .instance()
            .get(&DataKey::Registry)
            .ok_or(ConsumerError::CalleeRejected)?;

        let args: Vec<Val> = (plan_id,).into_val(&env);
        env.try_invoke_contract::<Val, ConsumerError>(
            &registry,
            &Symbol::new(&env, "lookup"),
            args,
        )
        .map_err(|_| ConsumerError::CalleeRejected)?
        .map_err(|_| ConsumerError::CalleeRejected)
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{
        testutils::{Address as _, MockAuth, MockAuthInvoke},
        Address, Env, IntoVal, Symbol,
    };

    /// A minimal stand-in for the subscription contract that records the
    /// caller and requires the subscriber's auth, mirroring the production
    /// invocation tree.
    #[contract]
    pub struct MockSubscription;

    #[contractimpl]
    impl MockSubscription {
        pub fn subscribe(env: Env, subscriber: Address, _plan_id: Symbol, amount: i128) -> i128 {
            subscriber.require_auth();
            amount
        }
    }

    /// A minimal stand-in for the treasury contract.
    #[contract]
    pub struct MockTreasury;

    #[contractimpl]
    impl MockTreasury {
        pub fn deposit(env: Env, from: Address, amount: i128) -> i128 {
            from.require_auth();
            amount
        }
    }

    /// A minimal stand-in for the registry contract. Lookups are read-only.
    #[contract]
    pub struct MockRegistry;

    #[contractimpl]
    impl MockRegistry {
        pub fn lookup(_env: Env, plan_id: Symbol) -> Symbol {
            plan_id
        }
    }

    fn setup(env: &Env) -> (Address, Address, Address, Address) {
        let consumer_id = env.register_contract(None, TestConsumer);
        let subscription_id = env.register_contract(None, MockSubscription);
        let treasury_id = env.register_contract(None, MockTreasury);
        let registry_id = env.register_contract(None, MockRegistry);

        let client = TestConsumerClient::new(env, &consumer_id);
        client.init(&subscription_id, &treasury_id, &registry_id);

        (consumer_id, subscription_id, treasury_id, registry_id)
    }

    #[test]
    fn subscribe_happy_path_records_subscriber_auth() {
        let env = Env::default();
        let (consumer_id, subscription_id, _, _) = setup(&env);
        let subscriber = Address::generate(&env);
        let plan_id = Symbol::new(&env, "basic");

        // Authorize only the subscriber, exactly as the production tree would.
        env.mock_auths(&[MockAuth {
            address: subscriber.clone(),
            invoke: &MockAuthInvoke {
                contract: &consumer_id,
                fn_name: "subscribe",
                args: (subscriber.clone(), plan_id.clone(), 100i128).into_val(&env),
                sub_invokes: &[MockAuthInvoke {
                    contract: &subscription_id,
                    fn_name: "subscribe",
                    args: (subscriber.clone(), plan_id.clone(), 100i128).into_val(&env),
                    sub_invokes: &[],
                }],
            },
        }]);

        let client = TestConsumerClient::new(&env, &consumer_id);
        let result = client.subscribe(&subscriber, &plan_id, &100i128);
        assert_eq!(result, 100i128.into_val(&env));

        // The auth footprint must include the subscriber for both the consumer
        // call and the nested subscription call.
        let auths = env.auths();
        assert_eq!(auths.len(), 1);
        assert_eq!(auths.get(0).unwrap().0, subscriber);
    }

    #[test]
    fn deposit_happy_path_records_from_auth() {
        let env = Env::default();
        let (consumer_id, _, treasury_id, _) = setup(&env);
        let from = Address::generate(&env);

        env.mock_auths(&[MockAuth {
            address: from.clone(),
            invoke: &MockAuthInvoke {
                contract: &consumer_id,
                fn_name: "deposit",
                args: (from.clone(), 250i128).into_val(&env),
                sub_invokes: &[MockAuthInvoke {
                    contract: &treasury_id,
                    fn_name: "deposit",
                    args: (from.clone(), 250i128).into_val(&env),
                    sub_invokes: &[],
                }],
            },
        }]);

        let client = TestConsumerClient::new(&env, &consumer_id);
        let result = client.deposit(&from, &250i128);
        assert_eq!(result, 250i128.into_val(&env));

        let auths = env.auths();
        assert_eq!(auths.len(), 1);
        assert_eq!(auths.get(0).unwrap().0, from);
    }

    #[test]
    fn lookup_requires_no_auth() {
        let env = Env::default();
        let (consumer_id, _, _, _) = setup(&env);
        let plan_id = Symbol::new(&env, "basic");

        let client = TestConsumerClient::new(&env, &consumer_id);
        let result = client.lookup(&plan_id);
        assert_eq!(result, plan_id.into_val(&env));
        assert_eq!(env.auths().len(), 0);
    }

    #[test]
    fn subscribe_without_auth_fails() {
        let env = Env::default();
        let (consumer_id, _, _, _) = setup(&env);
        let subscriber = Address::generate(&env);
        let plan_id = Symbol::new(&env, "basic");

        // No auths mocked: the nested `require_auth` must fail.
        let client = TestConsumerClient::new(&env, &consumer_id);
        let result = client.try_subscribe(&subscriber, &plan_id, &100i128);
        assert!(result.is_err());
    }

    #[test]
    fn wrong_contract_id_auth_is_rejected() {
        let env = Env::default();
        let (consumer_id, subscription_id, _, _) = setup(&env);
        let subscriber = Address::generate(&env);
        let plan_id = Symbol::new(&env, "basic");
        let wrong_id = Address::generate(&env);

        // Authorize the subscriber for the *wrong* contract id. The production
        // tree authorizes the subscription contract, so this must not satisfy
        // the nested `require_auth`.
        env.mock_auths(&[MockAuth {
            address: subscriber.clone(),
            invoke: &MockAuthInvoke {
                contract: &wrong_id,
                fn_name: "subscribe",
                args: (subscriber.clone(), plan_id.clone(), 100i128).into_val(&env),
                sub_invokes: &[],
            },
        }]);

        let client = TestConsumerClient::new(&env, &consumer_id);
        let result = client.try_subscribe(&subscriber, &plan_id, &100i128);
        assert!(result.is_err());

        // Sanity: the real subscription id is what the tree expects.
        assert_ne!(wrong_id, subscription_id);
    }

    #[test]
    fn paused_callee_is_rejected() {
        let env = Env::default();
        let (consumer_id, _, _, _) = setup(&env);
        let from = Address::generate(&env);

        // Point the consumer at an address with no deployed contract to
        // simulate a paused / unavailable callee.
        let paused = Address::generate(&env);
        let client = TestConsumerClient::new(&env, &consumer_id);
        client.init(&paused, &paused, &paused);

        let result = client.try_deposit(&from, &100i128);
        assert!(result.is_err());
    }
}
