#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, token, Address, Env, Symbol};

#[contracttype]
pub struct Plan {
    pub creator: Address,
    pub asset: Address,
    pub amount: i128,
    pub interval_days: u32,
}

#[contracttype]
pub struct Subscription {
    pub fan: Address,
    pub plan_id: u32,
    pub expiry: u64,
}

#[contracttype]
pub enum DataKey {
    Admin,
    FeeBps,
    FeeRecipient,
    PlanCount,
    Plan(u32),
    Sub(Address, Address),
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SubscriptionExtended {
    pub fan: Address,
    pub creator: Address,
    pub new_expires_at: u64,
}

#[contract]
pub struct MyfansContract;

#[contractimpl]
impl MyfansContract {
    pub fn init(env: Env, admin: Address, fee_bps: u32, fee_recipient: Address) {
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::FeeBps, &fee_bps);
        env.storage()
            .instance()
            .set(&DataKey::FeeRecipient, &fee_recipient);
        env.storage().instance().set(&DataKey::PlanCount, &0u32);
    }

    pub fn create_plan(
        env: Env,
        creator: Address,
        asset: Address,
        amount: i128,
        interval_days: u32,
    ) -> u32 {
        creator.require_auth();
        let count: u32 = env
            .storage()
            .instance()
            .get(&DataKey::PlanCount)
            .unwrap_or(0);
        let plan_id = count + 1;
        let plan = Plan {
            creator: creator.clone(),
            asset,
            amount,
            interval_days,
        };
        env.storage().instance().set(&DataKey::Plan(plan_id), &plan);
        env.storage().instance().set(&DataKey::PlanCount, &plan_id);
        env.events()
            .publish((Symbol::new(&env, "plan_created"), plan_id), creator);
        plan_id
    }

    pub fn subscribe(env: Env, fan: Address, plan_id: u32) {
        fan.require_auth();
        let plan: Plan = env
            .storage()
            .instance()
            .get(&DataKey::Plan(plan_id))
            .unwrap();
        let fee_bps: u32 = env.storage().instance().get(&DataKey::FeeBps).unwrap_or(0);
        let fee_recipient: Address = env
            .storage()
            .instance()
            .get(&DataKey::FeeRecipient)
            .unwrap();

        let fee = (plan.amount * fee_bps as i128) / 10000;
        let creator_amount = plan.amount - fee;

        let token_client = token::Client::new(&env, &plan.asset);
        token_client.transfer(&fan, &plan.creator, &creator_amount);
        if fee > 0 {
            token_client.transfer(&fan, &fee_recipient, &fee);
        }

        let expiry = env.ledger().timestamp() + (plan.interval_days as u64 * 86400);
        let sub = Subscription {
            fan: fan.clone(),
            plan_id,
            expiry,
        };
        env.storage()
            .instance()
            .set(&DataKey::Sub(fan.clone(), plan.creator.clone()), &sub);
        env.events()
            .publish((Symbol::new(&env, "subscribed"), plan_id), fan);
    }

<<<<<<< HEAD
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
=======
    pub fn is_subscriber(env: Env, fan: Address, creator: Address) -> bool {
        if let Some(sub) = env
            .storage()
            .instance()
            .get::<DataKey, Subscription>(&DataKey::Sub(fan, creator))
        {
            sub.expiry > env.ledger().timestamp()
>>>>>>> 849ddd3781414dec643b9237efa65a3380a8cd79
        } else {
            false
        }
    }

<<<<<<< HEAD
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
=======
    pub fn cancel(env: Env, fan: Address, creator: Address) {
        fan.require_auth();
        env.storage()
            .instance()
            .remove(&DataKey::Sub(fan.clone(), creator));
        env.events().publish((Symbol::new(&env, "cancelled"),), fan);
>>>>>>> 849ddd3781414dec643b9237efa65a3380a8cd79
    }
}
