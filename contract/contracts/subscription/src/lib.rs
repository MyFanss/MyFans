#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, Address, Env, Vec};
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

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SubscriptionExtended {
    pub fan: Address,
    pub creator: Address,
    pub new_expires_at: u64,
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

    pub fn cancel_subscription(env: Env, fan: Address, creator: Address) {
        let key = (fan.clone(), creator.clone());
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

    pub fn get_expiry(env: Env, fan: Address, creator: Address) -> Option<u64> {
        let key = (fan, creator);
        env.storage().instance().get(&key)
    }

    pub fn is_subscribed(env: Env, fan: Address, creator: Address) -> bool {
        let key = (fan, creator);
        if let Some(expires_at) = env.storage().instance().get::<_, u64>(&key) {
            env.ledger().sequence() <= expires_at
        } else {
            false
        }
    }

    pub fn extend_subscription(
        env: Env,
        fan: Address,
        creator: Address,
        extra_ledgers: u64,
        payment: u64,
    ) -> u64 {
        fan.require_auth();

        let key = (fan.clone(), creator.clone());
        let expires_at = env.storage().instance().get::<_, u64>(&key)
            .expect("subscription not active");

        if env.ledger().sequence() > expires_at {
            panic!("subscription expired");
        }

        if payment == 0 {
            panic!("payment required");
        }

        let new_expires_at = expires_at + extra_ledgers;
        env.storage().instance().set(&key, &new_expires_at);

        env.events().publish(
            (symbol_short!("sub_ext"),),
            SubscriptionExtended {
                fan,
                creator,
                new_expires_at,
            },
        );

        new_expires_at
    }

    pub fn is_subscribed_batch(env: Env, fan: Address, creators: Vec<Address>) -> Vec<bool> {
        let mut results = Vec::new(&env);
        for creator in creators.iter() {
            results.push_back(Self::is_subscribed(env.clone(), fan.clone(), creator));
        }
        results
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env};

    #[test]
    fn test_create_subscription_emits_event() {
        let env = Env::default();
        let contract_id = env.register_contract(None, SubscriptionContract);
        let client = SubscriptionContractClient::new(&env, &contract_id);

        let fan = Address::generate(&env);
        let creator = Address::generate(&env);
        let expires_at = 1000;

        let status = client.create_subscription(&fan, &creator, &expires_at);
        assert_eq!(status, SubscriptionStatus::Active);

        let events = env.events().all();
        assert_eq!(events.len(), 1);

        let event = events.get(0).unwrap();
        assert_eq!(
            event.topics,
            (symbol_short!("sub_new"),)
        );
    }

    #[test]
    fn test_cancel_subscription_emits_event() {
        let env = Env::default();
        let contract_id = env.register_contract(None, SubscriptionContract);
        let client = SubscriptionContractClient::new(&env, &contract_id);

        let fan = Address::generate(&env);
        let creator = Address::generate(&env);
        let expires_at = 1000;

        client.create_subscription(&fan, &creator, &expires_at);
        client.cancel_subscription(&fan, &creator);

        let events = env.events().all();
        assert_eq!(events.len(), 2);

        let cancel_event = events.get(1).unwrap();
        assert_eq!(
            cancel_event.topics,
            (symbol_short!("sub_cncl"),)
        );
    }

    #[test]
    fn test_expire_subscription_emits_event() {
        let env = Env::default();
        let contract_id = env.register_contract(None, SubscriptionContract);
        let client = SubscriptionContractClient::new(&env, &contract_id);

        let fan = Address::generate(&env);
        let creator = Address::generate(&env);
        let expires_at = 1000;

        client.create_subscription(&fan, &creator, &expires_at);
        client.expire_subscription(&fan, &creator);

        let events = env.events().all();
        assert_eq!(events.len(), 2);

        let expire_event = events.get(1).unwrap();
        assert_eq!(
            expire_event.topics,
            (symbol_short!("sub_exp"),)
        );
    }

    #[test]
    fn test_subscription_lifecycle() {
        let env = Env::default();
        let contract_id = env.register_contract(None, SubscriptionContract);
        let client = SubscriptionContractClient::new(&env, &contract_id);

        let fan = Address::generate(&env);
        let creator = Address::generate(&env);
        let expires_at = 1000;

        client.create_subscription(&fan, &creator, &expires_at);
        
        let expiry = client.get_expiry(&fan, &creator);
        assert_eq!(expiry, Some(expires_at));

        client.cancel_subscription(&fan, &creator);
        
        let expiry_after_cancel = client.get_expiry(&fan, &creator);
        assert_eq!(expiry_after_cancel, None);
    }

    #[test]
    fn test_is_subscribed() {
        let env = Env::default();
        env.ledger().with_mut(|li| li.sequence_number = 500);
        let contract_id = env.register_contract(None, SubscriptionContract);
        let client = SubscriptionContractClient::new(&env, &contract_id);

        let fan = Address::generate(&env);
        let creator = Address::generate(&env);

        assert!(!client.is_subscribed(&fan, &creator));

        client.create_subscription(&fan, &creator, &1000);
        assert!(client.is_subscribed(&fan, &creator));

        env.ledger().with_mut(|li| li.sequence_number = 1001);
        assert!(!client.is_subscribed(&fan, &creator));
    }

    #[test]
    fn test_is_subscribed_false_after_expiry() {
        let env = Env::default();
        env.ledger().with_mut(|li| li.sequence_number = 100);
        let contract_id = env.register_contract(None, SubscriptionContract);
        let client = SubscriptionContractClient::new(&env, &contract_id);

        let fan = Address::generate(&env);
        let creator = Address::generate(&env);

        client.create_subscription(&fan, &creator, &200);
        assert!(client.is_subscribed(&fan, &creator));

        env.ledger().with_mut(|li| li.sequence_number = 201);
        assert!(!client.is_subscribed(&fan, &creator));
    }

    #[test]
    fn test_extend_updates_expiry() {
        let env = Env::default();
        env.ledger().with_mut(|li| li.sequence_number = 100);
        let contract_id = env.register_contract(None, SubscriptionContract);
        let client = SubscriptionContractClient::new(&env, &contract_id);

        let fan = Address::generate(&env);
        let creator = Address::generate(&env);

        client.create_subscription(&fan, &creator, &200);
        
        let new_expiry = client.extend_subscription(&fan, &creator, &100, &50);
        assert_eq!(new_expiry, 300);
        assert_eq!(client.get_expiry(&fan, &creator), Some(300));
    }

    #[test]
    #[should_panic(expected = "payment required")]
    fn test_extend_requires_payment() {
        let env = Env::default();
        env.ledger().with_mut(|li| li.sequence_number = 100);
        let contract_id = env.register_contract(None, SubscriptionContract);
        let client = SubscriptionContractClient::new(&env, &contract_id);

        let fan = Address::generate(&env);
        let creator = Address::generate(&env);

        client.create_subscription(&fan, &creator, &200);
        client.extend_subscription(&fan, &creator, &100, &0);
    }

    #[test]
    fn test_is_subscribed_batch_mixed() {
        let env = Env::default();
        env.ledger().with_mut(|li| li.sequence_number = 500);
        let contract_id = env.register_contract(None, SubscriptionContract);
        let client = SubscriptionContractClient::new(&env, &contract_id);

        let fan = Address::generate(&env);
        let creator1 = Address::generate(&env);
        let creator2 = Address::generate(&env);
        let creator3 = Address::generate(&env);

        client.create_subscription(&fan, &creator1, &1000);
        client.create_subscription(&fan, &creator3, &1000);

        let mut creators = Vec::new(&env);
        creators.push_back(creator1.clone());
        creators.push_back(creator2.clone());
        creators.push_back(creator3.clone());

        let results = client.is_subscribed_batch(&fan, &creators);
        assert_eq!(results.len(), 3);
        assert_eq!(results.get(0).unwrap(), true);
        assert_eq!(results.get(1).unwrap(), false);
        assert_eq!(results.get(2).unwrap(), true);
    }

    #[test]
    fn test_is_subscribed_batch_all_unsubscribed() {
        let env = Env::default();
        let contract_id = env.register_contract(None, SubscriptionContract);
        let client = SubscriptionContractClient::new(&env, &contract_id);

        let fan = Address::generate(&env);
        let creator1 = Address::generate(&env);
        let creator2 = Address::generate(&env);

        let mut creators = Vec::new(&env);
        creators.push_back(creator1);
        creators.push_back(creator2);

        let results = client.is_subscribed_batch(&fan, &creators);
        assert_eq!(results.len(), 2);
        assert_eq!(results.get(0).unwrap(), false);
        assert_eq!(results.get(1).unwrap(), false);
    }

    #[test]
    fn test_is_subscribed_batch_empty() {
        let env = Env::default();
        let contract_id = env.register_contract(None, SubscriptionContract);
        let client = SubscriptionContractClient::new(&env, &contract_id);

        let fan = Address::generate(&env);
        let creators = Vec::new(&env);

        let results = client.is_subscribed_batch(&fan, &creators);
        assert_eq!(results.len(), 0);
    }
}
