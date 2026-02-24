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
    CreatorSubscriptionCount(Address),
    AcceptedToken(Address),
    /// Contract pause status
    Paused,
}

#[contract]
pub struct MyfansContract;

#[contractimpl]
impl MyfansContract {
    pub fn init(env: Env, admin: Address, fee_bps: u32, fee_recipient: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::FeeBps, &fee_bps);
        env.storage()
            .instance()
            .set(&DataKey::FeeRecipient, &fee_recipient);
        env.storage().instance().set(&DataKey::PlanCount, &0u32);
        env.storage().instance().set(&DataKey::Paused, &false);
    }

    pub fn create_plan(
        env: Env,
        creator: Address,
        asset: Address,
        amount: i128,
        interval_days: u32,
    ) -> u32 {
        creator.require_auth();
        let paused: bool = env.storage().instance().get(&DataKey::Paused).unwrap_or(false);
        assert!(!paused, "contract is paused");
        
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

    pub fn subscribe(env: Env, fan: Address, plan_id: u32, token: Address) {
        fan.require_auth();
        let paused: bool = env.storage().instance().get(&DataKey::Paused).unwrap_or(false);
        assert!(!paused, "contract is paused");
        
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

    pub fn cancel(env: Env, fan: Address, creator: Address) {
        fan.require_auth();
        let paused: bool = env.storage().instance().get(&DataKey::Paused).unwrap_or(false);
        assert!(!paused, "contract is paused");
        
        env.storage()
            .instance()
            .remove(&DataKey::Sub(fan.clone(), creator));
        env.events().publish((Symbol::new(&env, "cancelled"),), fan);
    }

    pub fn create_subscription(
        env: Env,
        fan: Address,
        creator: Address,
        duration_ledgers: u32,
    ) {
        fan.require_auth();

        let expires_at_ledger = env.ledger().sequence() + duration_ledgers;
        
        let sub = Subscription { 
            fan: fan.clone(), 
            plan_id: 0, // Mock id, just entity persistence
            expiry: expires_at_ledger as u64 
        };
        
        env.storage().instance().set(&DataKey::Sub(fan.clone(), creator.clone()), &sub);

        let mut current_count: u32 = env
            .storage()
            .instance()
            .get(&DataKey::CreatorSubscriptionCount(creator.clone()))
            .unwrap_or(0);
        
        current_count += 1;
        env.storage().instance().set(&DataKey::CreatorSubscriptionCount(creator), &current_count);
    }

    /// Pause the contract (admin only)
    /// Prevents all state-changing operations: create_plan, subscribe, cancel
    pub fn pause(env: Env) {
        let admin: Address = env.storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("admin not initialized");
        admin.require_auth();
        
        env.storage().instance().set(&DataKey::Paused, &true);
        env.events().publish((Symbol::new(&env, "paused"),), admin);
    }

    /// Unpause the contract (admin only)
    /// Allows state-changing operations to resume
    pub fn unpause(env: Env) {
        let admin: Address = env.storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("admin not initialized");
        admin.require_auth();
        
        env.storage().instance().set(&DataKey::Paused, &false);
        env.events().publish((Symbol::new(&env, "unpaused"),), admin);
    }

    /// Check if the contract is paused (view function)
    pub fn is_paused(env: Env) -> bool {
        env.storage().instance().get(&DataKey::Paused).unwrap_or(false)
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::{Address as _, Ledger}, Address, Env};

    #[test]
    fn test_subscription_entity_create() {
        let env = Env::default();
        env.mock_all_auths();
        
        let contract_id = env.register_contract(None, MyfansContract);
        let client = MyfansContractClient::new(&env, &contract_id);
        
        let fan = Address::generate(&env);
        let creator = Address::generate(&env);

        let fee_recipient = Address::generate(&env);
        client.init(&creator, &0, &fee_recipient); // mock admin init

        env.ledger().with_mut(|li| {
            li.sequence_number = 1000;
        });

        // Add 30 days of ledgers
        let duration_ledgers = 518400;

        client.create_subscription(&fan, &creator, &duration_ledgers);
    }
}

mod test;
