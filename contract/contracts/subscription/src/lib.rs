#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, Address, Env};
use myfans_lib::SubscriptionStatus;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SubscriptionCreated {
    pub fan: Address,
    pub creator: Address,
    pub expires_at: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SubscriptionCancelled {
    pub fan: Address,
    pub creator: Address,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SubscriptionExpired {
    pub fan: Address,
    pub creator: Address,
}

#[contract]
pub struct SubscriptionContract;

#[contractimpl]
impl SubscriptionContract {
    pub fn create_subscription(
        env: Env,
        fan: Address,
        creator: Address,
        expires_at: u64,
    ) -> SubscriptionStatus {
        let key = (fan.clone(), creator.clone());
        env.storage().instance().set(&key, &expires_at);

        env.events().publish(
            (symbol_short!("sub_new"),),
            SubscriptionCreated {
                fan,
                creator,
                expires_at,
            },
        );

        SubscriptionStatus::Active
    }

    /// Cancel a subscription. Only the fan can cancel (fan must authorize).
    /// Panics if no subscription exists for this fan-creator pair.
    pub fn cancel_subscription(env: Env, fan: Address, creator: Address) {
        fan.require_auth();

        let key = (fan.clone(), creator.clone());

        if !env.storage().instance().has(&key) {
            panic!("subscription does not exist");
        }

        env.storage().instance().remove(&key);

        env.events().publish(
            (symbol_short!("sub_cncl"),),
            SubscriptionCancelled { fan, creator },
        );
    }

    pub fn expire_subscription(env: Env, fan: Address, creator: Address) {
        let key = (fan.clone(), creator.clone());
        env.storage().instance().remove(&key);

        env.events().publish(
            (symbol_short!("sub_exp"),),
            SubscriptionExpired { fan, creator },
        );
    }

    /// Returns true if a subscription exists AND has not yet expired
    /// (i.e. expires_at > current ledger timestamp). Returns false otherwise.
    pub fn is_subscribed(env: Env, fan: Address, creator: Address) -> bool {
        let key = (fan, creator);
        if let Some(expires_at) = env.storage().instance().get::<_, u64>(&key) {
            expires_at > env.ledger().timestamp()
        } else {
            false
        }
    }

    /// Returns Some(expires_at) if a subscription record exists, None otherwise.
    pub fn get_subscription_expiry(env: Env, fan: Address, creator: Address) -> Option<u64> {
        let key = (fan, creator);
        env.storage().instance().get(&key)
    }

    /// Legacy alias kept for backward compatibility.
    pub fn get_expiry(env: Env, fan: Address, creator: Address) -> Option<u64> {
        let key = (fan, creator);
        env.storage().instance().get(&key)
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::Address as _, testutils::Ledger, Env};

    fn setup() -> (Env, SubscriptionContractClient<'static>, Address, Address) {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, SubscriptionContract);
        let client = SubscriptionContractClient::new(&env, &contract_id);
        let fan = Address::generate(&env);
        let creator = Address::generate(&env);
        (env, client, fan, creator)
    }

    // ── existing tests ──────────────────────────────────────────────

    #[test]
    fn test_create_subscription_emits_event() {
        let (env, client, fan, creator) = setup();
        let expires_at = 1000u64;

        let status = client.create_subscription(&fan, &creator, &expires_at);
        assert_eq!(status, SubscriptionStatus::Active);

        let events = env.events().all();
        assert_eq!(events.len(), 1);
    }

    #[test]
    fn test_cancel_subscription_emits_event() {
        let (env, client, fan, creator) = setup();
        let expires_at = 1000u64;

        client.create_subscription(&fan, &creator, &expires_at);
        client.cancel_subscription(&fan, &creator);

        let events = env.events().all();
        assert_eq!(events.len(), 2);
    }

    #[test]
    fn test_expire_subscription_emits_event() {
        let (env, client, fan, creator) = setup();
        let expires_at = 1000u64;

        client.create_subscription(&fan, &creator, &expires_at);
        client.expire_subscription(&fan, &creator);

        let events = env.events().all();
        assert_eq!(events.len(), 2);
    }

    #[test]
    fn test_subscription_lifecycle() {
        let (_env, client, fan, creator) = setup();
        let expires_at = 1000u64;

        client.create_subscription(&fan, &creator, &expires_at);

        let expiry = client.get_expiry(&fan, &creator);
        assert_eq!(expiry, Some(expires_at));

        client.cancel_subscription(&fan, &creator);

        let expiry_after_cancel = client.get_expiry(&fan, &creator);
        assert_eq!(expiry_after_cancel, None);
    }

    // ── new tests ───────────────────────────────────────────────────

    #[test]
    fn test_cancel_removes_subscription() {
        let (_env, client, fan, creator) = setup();

        client.create_subscription(&fan, &creator, &2000u64);
        assert_eq!(client.get_expiry(&fan, &creator), Some(2000u64));

        client.cancel_subscription(&fan, &creator);
        assert_eq!(client.get_expiry(&fan, &creator), None);
        assert_eq!(client.get_subscription_expiry(&fan, &creator), None);
    }

    #[test]
    fn test_is_subscribed_before_and_after_cancel() {
        let (env, client, fan, creator) = setup();

        // Set ledger timestamp to 100 so subscription (expires_at=2000) is active
        env.ledger().with_mut(|li| {
            li.timestamp = 100;
        });

        client.create_subscription(&fan, &creator, &2000u64);
        assert!(client.is_subscribed(&fan, &creator));

        client.cancel_subscription(&fan, &creator);
        assert!(!client.is_subscribed(&fan, &creator));
    }

    #[test]
    fn test_get_subscription_expiry_returns_correct_value() {
        let (_env, client, fan, creator) = setup();

        client.create_subscription(&fan, &creator, &5000u64);
        assert_eq!(client.get_subscription_expiry(&fan, &creator), Some(5000u64));
    }

    #[test]
    #[should_panic(expected = "subscription does not exist")]
    fn test_cancel_nonexistent_panics() {
        let (_env, client, fan, creator) = setup();
        // No subscription created — should panic
        client.cancel_subscription(&fan, &creator);
    }

    #[test]
    fn test_is_subscribed_returns_false_when_expired() {
        let (env, client, fan, creator) = setup();

        // Create subscription that expires at timestamp 500
        client.create_subscription(&fan, &creator, &500u64);

        // Advance ledger timestamp past expiry
        env.ledger().with_mut(|li| {
            li.timestamp = 600;
        });

        // Subscription exists but is expired
        assert!(!client.is_subscribed(&fan, &creator));
        // get_subscription_expiry still returns the stored value
        assert_eq!(client.get_subscription_expiry(&fan, &creator), Some(500u64));
    }

    #[test]
    fn test_is_subscribed_returns_false_when_no_subscription() {
        let (_env, client, fan, creator) = setup();
        assert!(!client.is_subscribed(&fan, &creator));
    }

    #[test]
    fn test_get_subscription_expiry_returns_none_when_no_subscription() {
        let (_env, client, fan, creator) = setup();
        assert_eq!(client.get_subscription_expiry(&fan, &creator), None);
    }
}
