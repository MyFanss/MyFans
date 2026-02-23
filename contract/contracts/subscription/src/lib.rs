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

    pub fn is_subscriber(env: Env, fan: Address, creator: Address) -> bool {
        if let Some(sub) = env
            .storage()
            .instance()
            .get::<DataKey, Subscription>(&DataKey::Sub(fan, creator))
        {
            sub.expiry > env.ledger().timestamp()
        } else {
            false
        }
    }

    pub fn extend_subscription(
        env: Env,
        fan: Address,
        creator: Address,
        extra_time: u64,
        payment: i128,
    ) -> u64 {
        fan.require_auth();

        let key = DataKey::Sub(fan.clone(), creator.clone());
        let mut sub: Subscription = env.storage().instance().get(&key)
            .expect("subscription not active");

        if env.ledger().timestamp() > sub.expiry {
            panic!("subscription expired");
        }

        if payment == 0 {
            panic!("payment required");
        }

        let new_expiry = sub.expiry + extra_time;
        sub.expiry = new_expiry;
        env.storage().instance().set(&key, &sub);

        env.events().publish(
            (Symbol::new(&env, "sub_extended"),),
            SubscriptionExtended {
                fan,
                creator,
                new_expires_at: new_expiry,
            },
        );

        new_expiry
    }

    pub fn cancel(env: Env, fan: Address, creator: Address) {
        fan.require_auth();
        env.storage()
            .instance()
            .remove(&DataKey::Sub(fan.clone(), creator));
        env.events().publish((Symbol::new(&env, "cancelled"),), fan);
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env};

    #[test]
    fn test_is_subscriber_false_after_expiry() {
        let env = Env::default();
        env.ledger().with_mut(|li| li.timestamp = 100);
        let contract_id = env.register_contract(None, MyfansContract);
        let client = MyfansContractClient::new(&env, &contract_id);

        let fan = Address::generate(&env);
        let creator = Address::generate(&env);
        let asset = Address::generate(&env);

        client.init(&Address::generate(&env), &100, &Address::generate(&env));
        client.create_plan(&creator, &asset, &1000, &1);
        client.subscribe(&fan, &1);

        assert!(client.is_subscriber(&fan, &creator));

        env.ledger().with_mut(|li| li.timestamp = 86500);
        assert!(!client.is_subscriber(&fan, &creator));
    }

    #[test]
    fn test_extend_updates_expiry() {
        let env = Env::default();
        env.ledger().with_mut(|li| li.timestamp = 100);
        let contract_id = env.register_contract(None, MyfansContract);
        let client = MyfansContractClient::new(&env, &contract_id);

        let fan = Address::generate(&env);
        let creator = Address::generate(&env);
        let asset = Address::generate(&env);

        client.init(&Address::generate(&env), &100, &Address::generate(&env));
        client.create_plan(&creator, &asset, &1000, &1);
        client.subscribe(&fan, &1);

        let new_expiry = client.extend_subscription(&fan, &creator, &86400, &500);
        assert_eq!(new_expiry, 86400 + 86500);
    }

    #[test]
    #[should_panic(expected = "payment required")]
    fn test_extend_requires_payment() {
        let env = Env::default();
        env.ledger().with_mut(|li| li.timestamp = 100);
        let contract_id = env.register_contract(None, MyfansContract);
        let client = MyfansContractClient::new(&env, &contract_id);

        let fan = Address::generate(&env);
        let creator = Address::generate(&env);
        let asset = Address::generate(&env);

        client.init(&Address::generate(&env), &100, &Address::generate(&env));
        client.create_plan(&creator, &asset, &1000, &1);
        client.subscribe(&fan, &1);

        client.extend_subscription(&fan, &creator, &86400, &0);
    }
}
