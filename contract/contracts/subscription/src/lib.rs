//! Subscription contract: plans, subscribe/renew/cancel, protocol fee split.

#![no_std]

use soroban_sdk::{contract, contracterror, contractimpl, token, Address, Env};

mod types;

    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    Paused = 4,
    FeeTooHigh = 5,
    InvalidAmount = 6,
    InvalidInterval = 7,
    PlanNotFound = 8,
    PlanInactive = 9,
    AssetMismatch = 10,
    NotSubscriber = 11,
    Overflow = 12,
    InsufficientBalance = 13,
    TrustlineMissing = 14,
    AlreadySubscribed = 15,
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    Paused = 4,
    FeeTooHigh = 5,
    InvalidAmount = 6,
    InvalidInterval = 7,
    PlanNotFound = 8,
    PlanInactive = 9,
    AssetMismatch = 10,
    NotSubscriber = 11,
    Overflow = 12,
    InsufficientBalance = 13,
    TrustlineMissing = 14,
    AllowanceMissing = 15,
    UnsupportedAsset = 16,
    WrongPlan = 17,
    AlreadySubscribed = 18,
    InvalidFeeRecipient = 19,
    SelfSubscription = 20,
}

#[contracttype]
#[derive(Clone)]
pub struct Plan {
    pub creator: Address,
    pub asset: Address,
    pub amount: i128,
    pub interval: u64,
    pub active: bool,
}

#[contracttype]
#[derive(Clone)]
pub struct Subscription {
    pub fan: Address,
    pub creator: Address,
    pub plan_id: u64,
    pub asset: Address,
    pub expires_at: u64,
    pub cancelled_at: Option<u64>,
}

#[contracttype]
#[derive(Clone)]
pub struct Config {
    pub admin: Address,
    pub protocol_fee_bps: u32,
    pub fee_recipient: Address,
    pub paused: bool,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Config,
    NextPlanId,
    Plan(u64),
    Sub(Address, Address),
}

#[contract]
pub struct SubscriptionContract;

#[contractimpl]
impl SubscriptionContract {
    /// Initialize the contract. Requires admin auth. Returns an error on double-init.
    /// The `fee_recipient` must be a non-empty address distinct from the admin;
    /// otherwise `Error::InvalidFeeRecipient` is returned and storage is left
    /// uninitialized.
    pub fn init(
        env: Env,
        admin: Address,
        protocol_fee_bps: u32,
        fee_recipient: Address,
    ) -> Result<(), Error> {
        admin.require_auth();
        if env.storage().instance().has(&DataKey::Config) {
            panic!("already initialized");
        }
        if protocol_fee_bps > MAX_FEE_BPS {
            panic!("fee exceeds max");
        }
        if fee_recipient == admin {
            return Err(Error::InvalidFeeRecipient);
        }
        let config = Config {
            admin,
            protocol_fee_bps,
            fee_recipient,
        };
        env.storage().instance().set(&DataKey::Config, &config);
    }

        Self::require_active(&env)?;
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
    pub fn create_plan(
        env: Env,
        creator: Address,
        asset: Address,
        amount: i128,
        interval_ledgers: u32,
    ) -> u32 {
        creator.require_auth();
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        }
        if interval_ledgers == 0 {
            panic!("interval must be positive");
        }
        let mut next: u32 = env
            .storage()
            .instance()
            .get(&DataKey::NextPlanId)
            .unwrap_or(1);
        let plan_id = next;
        let next_id = match plan_id.checked_add(1) {
            Some(next) => next,
            None => return Err(Error::Overflow),
        };
        env.storage().instance().set(&DataKey::NextPlanId, &next_id);
        let plan = Plan {
            creator: creator.clone(),
            asset,
            amount,
            interval,
            active: true,
        };
        env.storage().persistent().set(&DataKey::Plan(plan_id), &plan);
        env.storage()
            .instance()
            .set(&DataKey::NextPlanId, &next_id);

        env.events().publish(
            (symbol_short!("plan_crt"),),
            (plan_id, creator, asset, amount, interval),
        );
        Ok(plan_id)
    }

    /// Subscribe to a plan. Requires fan auth. Blocked while paused. The
    /// `asset` argument must match the plan's asset or the call returns
    /// `Error::AssetMismatch` before any charge or subscription write. A
    /// creator cannot subscribe to their own plan: `fan == plan.creator`
    /// returns `Error::SelfSubscription` before any charge or write.
    pub fn subscribe(env: Env, fan: Address, plan_id: u64, asset: Address) -> Result<(), Error> {
        fan.require_auth();
        Self::require_active(&env)?;
        let plan = Self::load_plan(&env, plan_id)?;
        if !plan.active {
            return Err(Error::PlanInactive);
        }
        if fan == plan.creator {
            return Err(Error::SelfSubscription);
        }
        if asset != plan.asset {
            return Err(Error::AssetMismatch);
        }
        let fee = Self::charge(&env, &fan, &plan);
        let expires_at = Self::next_expiry(&env, plan.interval);
        let sub = Subscription {
            fan: fan.clone(),
            creator: plan.creator.clone(),
            plan_id,
            asset: plan.asset.clone(),
            expires_at,
            cancelled_at: None,
        };
        env.storage()
            .persistent()
            .set(&DataKey::Sub(fan.clone(), plan.creator.clone()), &sub);

        env.events().publish(
            (symbol_short!("subscr"),),
            (fan, plan.creator, plan_id, plan.amount, fee, expires_at),
        );
        Ok(())
    }

    /// Renew an existing subscription. Requires fan auth. Wrong asset/plan returns an error.
    pub fn renew(env: Env, fan: Address, plan_id: u64) -> Result<(), Error> {
        fan.require_auth();
        Self::require_active(&env)?;
        let plan = Self::load_plan(&env, plan_id)?;
        if !plan.active {
            return Err(Error::PlanInactive);
        }
        let key = DataKey::Subscription(fan.clone(), plan.creator.clone());
        if let Some(existing) = env
            .storage()
            .persistent()
            .get::<DataKey, Subscription>(&key)
        {
            if env.ledger().sequence() < existing.end_ledger {
                return Err(Error::AlreadySubscribed);
            }
        }
        let start_ledger = env.ledger().sequence();
        let end_ledger = start_ledger
            .checked_add(plan.interval_ledge
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
        let start_ledger = env.ledger().sequence();
        let end_ledger = start_ledger
            .checked_add(plan.interval_ledgers)
            .ok_or(Error::Overflow)?;
        let fee = Self::charge(&env, &fan, &plan);
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

    pub fn renew(env: Env, fan: Address, creator: Address, plan_id: u32) -> Result<(), Error> {
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
        let base = if env.ledger().sequence() > sub.end_ledger {
            env.ledger().sequence()
        } else {
            sub.end_ledger
        };
        let new_end = base
            .checked_add(plan.interval_ledgers)
            .ok_or(Error::Overflow)?;
        let fee = Self::charge(&env, &fan, &plan);
        sub.end_ledger = new_end;
        env.storage()
            .persistent()
            .set(&DataKey::Subscription(fan.clone(), creator.clone()), &sub);
        env.events().publish(
            ("sub", "renewed"),
            (fan, creator, plan_id, plan.amount, fee, sub.end_ledger),
        );
        Ok(())
    }

    pub fn cancel(env: Env, fan: Address, creator: Address, _plan_id: u32) {
        fan.require_auth();
        let key = DataKey::Subscription(fan.clone(), creator.clone());
        let mut sub: Subscription = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(Error::NotSubscriber)?;
        if sub.plan_id != plan_id {
            return Err(Error::WrongPlan);
        }
        if sub.asset != plan.asset {
            return Err(Error::AssetMismatch);
        }
        let fee = Self::charge(&env, &fan, &plan);
        sub.expires_at = Self::next_expiry(&env, plan.interval);
        sub.cancelled_at = None;
        sub.end_ledger = env.ledger().sequence();
        env.storage().persistent().set(&key, &sub);
        env.events().publish(
            (symbol_short!("renew"),),
            (fan, plan.creator, plan_id, plan.amount, fee, sub.expires_at),
        );
        Ok(())
    }

    /// Alias for `renew` used by the interface contract.
    pub fn extend_subscription(env: Env, fan: Address, plan_id: u64) -> Result<(), Error> {
        Self::renew(env, fan, plan_id)
    }

    /// Cancel a subscription. Requires fan auth. Blocked while paused. Records
    /// `cancelled_at` at the current ledger and keeps the row until `expires_at`
    /// so the fan retains access they already paid for. No refund, no token
    /// movement. Cancelling a missing subscription reverts with `NotSubscriber`.
    pub fn cancel(env: Env, fan: Address, creator: Address) {

        fan.require_auth();
        Self::require_active(&env);
        let key = DataKey::Sub(fan.clone(), creator.clone());
        let mut sub: Subscription = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or_else(|| panic_with_error!(&env, Error::NotSubscriber));
     
        fan.require_auth();
        Self::require_active(&env);
        let key = DataKey::Sub(fan.clone(), creator.clone());
        let mut sub: Subscription = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or_else(|| panic_with_error!(&env, Error::NotSubscriber));
        sub.cancelled_at = Some(env.ledger().sequence() as u64);
        env.storage().persistent().set(&key, &sub);

        env.events().publish(
            (symbol_short!("cancel"),),
            (fan, creator),
        );
        Ok(())
    }

    /// Returns true when `fan` has an active (non-expired) subscription to `creator`.
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

    /// Admin pause. Requires admin auth. Storage unchanged on unauthorized call.
    /// Emits `("admin", "paused")` after the storage write. A pause when already
    /// paused is a no-op and emits no second event.
    pub fn pause(env: Env) {
        let config = Self::load_config(&env);

        config.admin.require_auth();
        if config.paused {
            return;
        }
        config.paused = true;
        env.storage().instance().set(&DataKey::Config, &config);
        env.events().publish((symbol
        config.admin.require_auth();
        if config.paused {
            return;
        }
        config.paused = true;
        env.storage().instance().set(&DataKey::Config, &config);
        Ok(())
    }

    /// Admin pause. Requires admin auth. Emits `("admin", "paused")` after the
    /// storage write. A pause when already paused is a no-op and emits no
    /// second event.
    pub fn pause(env: Env) {
        let config = Self::load_config(&env);
        config.admin.require_auth();
        if config.paused {
            return;
        }
        config.paused = true;
        env.storage().instance().set(&DataKey::Config, &config);
        env.events().publish(
            (symbol_short!("admin"), symbol_short!("paused")),
            (),
        );
    }

    /// Admin unpause. Requires admin auth. Emits `("admin", "unpaused")` after
    /// the storage write. An unpause when already unpaused is a no-op and emits
    /// no second event.
    pub fn unpause(env: Env) {
        let config = Self::load_config(&env);
        config.admin.require_auth();
        if !config.paused {
            return;
        }
        config.paused = false;
        env.storage().instance().set(&DataKey::Config, &config);
        env.events().publish(
            (symbol_short!("admin"), symbol_short!("unpaused")),
            (),
        );
    }

    /// Admin fee setter. Requires admin auth. Enforces MAX_FEE_BPS cap.
    /// Returns `Error::FeeTooHigh` (emitting nothing) when the rate exceeds the
    /// cap. On success, writes the new rate and emits a `FeeUpdatedEvent` with
    /// the new basis points and the current
    pub fn set_protocol_fee(env: Env, protocol_fee_bps: u32) {
        let mut config = Self::require_init(&env);
        config.admin.require_auth();
        if protocol_fee_bps > MAX_FEE_BPS {
            panic!("fee exceeds max");
        }
        config.protocol_fee_bps = protocol_fee_bps;
        env.storage().instance().set(&DataKey::Config, &config);
        env.events()
            .publish((symbol_short!("fee"),), (protocol_fee_bps,));
    }

    // ---------------------------------------------------------------------
    // Internal helpers
    // ---------------------------------------------------------------------

    fn require_init(env: &Env) -> Config {
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

    fn next_expiry(env: &Env, interval: u64) -> u64 {
        env.ledger().sequence() as u64 + interval.max(PERIOD_LEDGERS)
    }

    /// Charges the fan `plan.amount` once, splitting the protocol fee to the
    /// treasury and paying the remainder to the creator. Returns the fee.
    fn charge(env: &Env, fan: &Address, plan: &Plan) -> i128 {
        let config = Self::require_init(env);
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
