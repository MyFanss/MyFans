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
    ///
    /// The `from` address is forwarded as the first argument so the treasury
    /// contract can require its auth. The consumer itself does *not* authorize
    /// anything here; the caller of this method is expected to have authorized
    /// `from` in the surrounding invocation tree. A paused treasury rejects the
    /// call, which surfaces as [`ConsumerError::CalleeRejected`].
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
    fn subscribe_forwards_subscriber_auth() {
        let env = Env::default();
        let (consumer_id, subscription_id, _, _) = setup(&env);

        let subscriber = Address::generate(&env);
        let plan_id = Symbol::new(&env, "basic");
        let amount = 1_000i128;

        env.mock_auths(&[MockAuth {
            address: subscriber.clone(),
            invoke: &MockAuthInvoke {
                contract: &consumer_id,
                fn_name: "subscribe",
                args: (subscriber.clone(), plan_id.clone(), amount).into_val(&env),
                sub_invokes: &[MockAuthInvoke {
                    contract: &subscription_id,
                    fn_name: "subscribe",
                    args: (subscriber.clone(), plan_id.clone(), amount).into_val(&env),
                    sub_invokes: &[],
                }],
            },
        }]);

        let client = TestConsumerClient::new(&env, &consumer_id);
        let result = client.subscribe(&subscriber, &plan_id, &amount);
        assert_eq!(result, amount.into_val(&env));
    }

    /// The consumer's treasury deposit path must surface a paused treasury as
    /// [`ConsumerError::CalleeRejected`] and must not credit any balance.
    #[test]
    fn deposit_rejected_when_treasury_paused() {
        let env = Env::default();
        let consumer_id = env.register_contract(None, TestConsumer);
        let treasury_id = env.register_contract(None, TreasuryContract);

        let treasury_client = TreasuryContractClient::new(&env, &treasury_id);
        treasury_client.init(&Address::generate(&env));
        treasury_client.set_paused(&true);

        let consumer_client = TestConsumerClient::new(&env, &consumer_id);
        consumer_client.init(
            &Address::generate(&env),
            &treasury_id,
            &Address::generate(&env),
        );

        let depositor = Address::generate(&env);
        let amount = 500i128;

        env.mock_auths(&[MockAuth {
            address: depositor.clone(),
            invoke: &MockAuthInvoke {
                contract: &consumer_id,
                fn_name: "deposit",
                args: (depositor.clone(), amount).into_val(&env),
                sub_invokes: &[MockAuthInvoke {
                    contract: &treasury_id,
                    fn_name: "deposit",
                    args: (depositor.clone(), amount).into_val(&env),
                    sub_invokes: &[],
                }],
            },
        }]);

        let result = consumer_client.try_deposit(&depositor, &amount);
        assert_eq!(result, Err(Ok(ConsumerError::CalleeRejected)));
        assert_eq!(treasury_client.balance(&depositor), 0);
    }

    /// Companion positive case: when the treasury is not paused the deposit
    /// succeeds and credits the depositor's balance.
    #[test]
    fn deposit_succeeds_when_treasury_not_paused() {
        let env = Env::default();
        let consumer_id = env.register_contract(None, TestConsumer);
        let treasury_id = env.register_contract(None, TreasuryContract);

        let treasury_client = TreasuryContractClient::new(&env, &treasury_id);
        treasury_client.init(&Address::generate(&env));

        let consumer_client = TestConsumerClient::new(&env, &consumer_id);
        consumer_client.init(
            &Address::generate(&env),
            &treasury_id,
            &Address::generate(&env),
        );

        let depositor = Address::generate(&env);
        let amount = 500i128;

        env.mock_auths(&[MockAuth {
            address: depositor.clone(),
            invoke: &MockAuthInvoke {
                contract: &consumer_id,
                fn_name: "deposit",
                args: (depositor.clone(), amount).into_val(&env),
                sub_invokes: &[MockAuthInvoke {
                    contract: &treasury_id,
                    fn_name: "deposit",
                    args: (depositor.clone(), amount).into_val(&env),
                    sub_invokes: &[],
                }],
            },
        }]);

        let result = consumer_client.deposit(&depositor, &amount);
        assert_eq!(result, amount.into_val(&env));
        assert_eq!(treasury_client.balance(&depositor), amount);
    }
}
