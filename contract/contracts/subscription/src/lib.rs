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
}
