//! Subscription contract: plans, subscribe/renew/cancel, protocol fee split.

#![no_std]

use soroban_sdk::{contract, contracterror, contractimpl, token, Address, Env};

mod types;

use types::{split_fee, Config, DataKey, Plan, Subscription, MAX_FEE_BPS};

/// Typed contract errors. Discriminants are appended so existing values are
/// never renumbered.
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    AlreadySubscribed = 1,
}

#[contract]
pub struct SubscriptionContract;

#[contractimpl]
impl SubscriptionContract {
    pub fn init(env: Env, admin: Address, protocol_fee_bps: u32, fee_recipient: Address) {
        admin.require_auth();
        if env.storage().instance().has(&DataKey::Config) {
            panic!("already initialized");
        }
        if protocol_fee_bps > MAX_FEE_BPS {
            panic!("fee exceeds max");
        }
        let config = Config {
            admin,
            protocol_fee_bps,
            fee_recipient,
        };
        env.storage().instance().set(&DataKey::Config, &config);
    }

    pub fn create_plan(
        env: Env,
        creator: Address,
        asset: Address,
        amount: i128,
        interval_ledgers: u32,
    ) -> u32 {
        creator.require_auth();
        if amount == 0 {
            panic!("amount must be positive");
        }
        if interval_ledgers == 0 {
            panic!("interval must be positive");
        }
        let mut next: u32 = env
            .storage()
            .instance()
            .get(&DataKey::NextPlanId)
            .unwrap_or(0);
        let plan_id = next;
        next += 1;
        env.storage().instance().set(&DataKey::NextPlanId, &next);
        let plan = Plan {
            creator: creator.clone(),
            asset,
            amount,
            interval_ledgers,
        };
        env.storage()
            .persistent()
            .set(&DataKey::Plan(plan_id), &plan);
        env.events()
            .publish(("plan", "created"), (creator, plan_id, plan.asset, amount, interval_ledgers));
        plan_id
    }

    pub fn subscribe(env: Env, fan: Address, creator: Address, plan_id: u32) -> Result<(), Error> {
        fan.require_auth();
        let plan = Self::load_plan(&env, plan_id);
        if plan.creator != creator {
            panic!("creator mismatch");
        }
        let key = DataKey::Subscription(fan.clone(), creator.clone());
        if let Some(existing) = env
            .storage()
            .persistent()
            .get::<DataKey, Subscription>(&key)
        {
            if env.ledger().sequence() < existing.end_ledger {
                return Err(Error::AlreadySubscribed);
            }
        }
        let fee = Self::charge(&env, &fan, &plan);
        let start_ledger = env.ledger().sequence();
        let end_ledger = start_ledger + plan.interval_ledgers;
        let sub = Subscription {
            fan: fan.clone(),
            creator: creator.clone(),
            plan_id,
            start_ledger,
            end_ledger,
        };
        env.storage().persistent().set(&key, &sub);
        env.events().publish(
            ("sub", "created"),
            (fan, creator, plan_id, plan.amount, fee, start_ledger, end_ledger),
        );
        Ok(())
    }

    pub fn renew(env: Env, fan: Address, creator: Address, plan_id: u32) {
        fan.require_auth();
        let plan = Self::load_plan(&env, plan_id);
        if plan.creator != creator {
            panic!("creator mismatch");
        }
        let mut sub: Subscription = env
            .storage()
            .persistent()
            .get(&DataKey::Subscription(fan.clone(), creator.clone()))
            .expect("no subscription");
        let fee = Self::charge(&env, &fan, &plan);
        sub.end_ledger = sub.end_ledger + plan.interval_ledgers;
        env.storage()
            .persistent()
            .set(&DataKey::Subscription(fan.clone(), creator.clone()), &sub);
        env.events().publish(
            ("sub", "renewed"),
            (fan, creator, plan_id, plan.amount, fee, sub.end_ledger),
        );
    }

    pub fn cancel(env: Env, fan: Address, creator: Address, _plan_id: u32) {
        fan.require_auth();
        let key = DataKey::Subscription(fan.clone(), creator.clone());
        let mut sub: Subscription = env
            .storage()
            .persistent()
            .get(&key)
            .expect("no subscription");
        sub.end_ledger = env.ledger().sequence();
        env.storage().persistent().set(&key, &sub);
        env.events().publish(
            ("sub", "cancelled"),
            (fan, creator, sub.plan_id, sub.end_ledger),
        );
    }

    pub fn is_subscriber(env: Env, fan: Address, creator: Address) -> bool {
        match env
            .storage()
            .persistent()
            .get::<DataKey, Subscription>(&DataKey::Subscription(fan, creator))
        {
            Some(sub) => env.ledger().sequence() < sub.end_ledger,
            None => false,
        }
    }

    pub fn pause(env: Env) {
        let config = Self::load_config(&env);
        config.admin.require_auth();
        env.storage().instance().set(&DataKey::Paused, &true);
        env.events().publish(("admin", "paused"), ());
    }

    pub fn unpause(env: Env) {
        let config = Self::load_config(&env);
        config.admin.require_auth();
        env.storage().instance().set(&DataKey::Paused, &false);
        env.events().publish(("admin", "unpaused"), ());
    }

    pub fn set_protocol_fee_bps(env: Env, bps: u32) {
        let mut config = Self::load_config(&env);
        config.admin.require_auth();
        if bps > MAX_FEE_BPS {
            panic!("fee exceeds max");
        }
        config.protocol_fee_bps = bps;
        env.storage().instance().set(&DataKey::Config, &config);
        env.events().publish(("admin", "fee"), (bps,));
    }

    fn load_config(env: &Env) -> Config {
        env.storage()
            .instance()
            .get(&DataKey::Config)
            .expect("not initialized")
    }

    fn load_plan(env: &Env, plan_id: u32) -> Plan {
        env.storage()
            .persistent()
            .get(&DataKey::Plan(plan_id))
            .expect("unknown plan")
    }

    /// Charges the fan `plan.amount` once, splitting the protocol fee to the
    /// treasury and paying the remainder to the creator. Returns the fee.
    fn charge(env: &Env, fan: &Address, plan: &Plan) -> i128 {
        let config = Self::load_config(env);
        if config.protocol_fee_bps > MAX_FEE_BPS {
            panic!("fee exceeds max");
        }
        let fee = split_fee(plan.amount, config.protocol_fee_bps);
        let remainder = plan.amount - fee;
        let client = token::Client::new(env, &plan.asset);
        if fee > 0 {
            client.transfer(fan, &config.fee_recipient, &fee);
        }
        client.transfer(fan, &plan.creator, &remainder);
        fee
    }
}
