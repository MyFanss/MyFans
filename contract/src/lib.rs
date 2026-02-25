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

/// Creator information stored in the registry
#[contracttype]
pub struct CreatorInfo {
    pub creator_id: u32,
    pub is_verified: bool,
}

#[contracttype]
pub enum DataKey {
    Admin,
    FeeBps,
    FeeRecipient,
    PlanCount,
    Plan(u32),
    Sub(Address, Address),
    /// Creator counter for generating unique IDs
    CreatorCount,
    /// Creator info by address: (creator_id, is_verified)
    Creator(Address),
    /// Contract pause status
    Paused,
}

pub mod treasury;

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
        env.storage().instance().set(&DataKey::CreatorCount, &0u32);
    }

    /// Register a new creator in the registry
    /// Returns the creator_id assigned to the creator
    pub fn register_creator(env: Env, creator: Address) -> u32 {
        creator.require_auth();

        // Check if creator is already registered
        if env
            .storage()
            .instance()
            .has(&DataKey::Creator(creator.clone()))
        {
            panic!("creator already registered");
        }

        // Get and increment creator count
        let count: u32 = env
            .storage()
            .instance()
            .get(&DataKey::CreatorCount)
            .unwrap_or(0);
        let creator_id = count + 1;

        // Store creator info with is_verified = false by default
        let creator_info = CreatorInfo {
            creator_id,
            is_verified: false,
        };
        env.storage()
            .instance()
            .set(&DataKey::Creator(creator.clone()), &creator_info);
        env.storage()
            .instance()
            .set(&DataKey::CreatorCount, &creator_id);

        env.events().publish(
            (Symbol::new(&env, "creator_registered"), creator_id),
            creator,
        );

        creator_id
    }

    /// Set verification status for a creator (admin only)
    /// Creator must be registered before verification
    pub fn set_verified(env: Env, creator_address: Address, verified: bool) {
        // Require admin authorization
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("not initialized");
        admin.require_auth();

        // Check if creator is registered
        let mut creator_info: CreatorInfo = env
            .storage()
            .instance()
            .get(&DataKey::Creator(creator_address.clone()))
            .expect("creator not registered");

        // Update verification status
        creator_info.is_verified = verified;
        env.storage()
            .instance()
            .set(&DataKey::Creator(creator_address.clone()), &creator_info);

        env.events().publish(
            (
                Symbol::new(&env, "verification_updated"),
                creator_info.creator_id,
            ),
            creator_address,
        );
    }

    /// Get creator information by address
    /// Returns (creator_id, is_verified) or None if not registered
    pub fn get_creator(env: Env, address: Address) -> Option<CreatorInfo> {
        env.storage().instance().get(&DataKey::Creator(address))
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

    pub fn subscribe(env: Env, fan: Address, plan_id: u32) {
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

    /// Alias matching the issue spec naming. Delegates to `is_subscriber`.
    pub fn is_subscribed(env: Env, fan: Address, creator: Address) -> bool {
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

    /// Returns Some(expiry) if subscription exists, None otherwise.
    pub fn get_subscription_expiry(env: Env, fan: Address, creator: Address) -> Option<u64> {
        env.storage()
            .instance()
            .get::<DataKey, Subscription>(&DataKey::Sub(fan, creator))
            .map(|sub| sub.expiry)
    }

    /// Cancel a subscription. Only the fan can cancel. Panics if no subscription exists.
    pub fn cancel(env: Env, fan: Address, creator: Address) {
        fan.require_auth();
        let paused: bool = env.storage().instance().get(&DataKey::Paused).unwrap_or(false);
        assert!(!paused, "contract is paused");
        
        if !env
            .storage()
            .instance()
            .has(&DataKey::Sub(fan.clone(), creator.clone()))
        {
            panic!("subscription does not exist");
        }
        env.storage()
            .instance()
            .remove(&DataKey::Sub(fan.clone(), creator));
        env.events().publish((Symbol::new(&env, "cancelled"),), fan);
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
mod test;

#[cfg(test)]
mod treasury_test;
