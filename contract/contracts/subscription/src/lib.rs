#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, symbol_short, token,
    Address, Env, IntoVal, Symbol, Vec,
};

/// Maximum protocol fee in basis points (10%).
const MAX_FEE_BPS: u32 = 1000;
const BPS_DENOM: i128 = 10_000;

/// Ledger sequence bump applied to the current ledger when a subscription is
/// created or renewed. Kept well below u64::MAX to avoid overflow on extend.
const PERIOD_LEDGERS: u64 = 17_280; // ~1 day at 5s ledgers

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
    InvalidFeeRecipient = 17,
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
            return Err(Error::AlreadyInitialized);
        }
        if protocol_fee_bps > MAX_FEE_BPS {
            return Err(Error::FeeTooHigh);
        }
        if fee_recipient == admin {
            return Err(Error::InvalidFeeRecipient);
        }
        let config = Config {
            admin,
            protocol_fee_bps,
            fee_recipient,
            paused: false,
        };
        env.storage().instance().set(&DataKey::Config, &config);
        env.storage().instance().set(&DataKey::NextPlanId, &1u64);
        Ok(())
    }

    /// Create a plan. Requires creator auth. Rejects zero amount/interval.
    pub fn create_plan(
        env: Env,
        creator: Address,
        asset: Address,
        amount: i128,
        interval: u64,
    ) -> Result<u64, Error> {
        creator.require_auth();
        Self::require_init(&env);
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        if interval == 0 {
            return Err(Error::InvalidInterval);
        }
        let plan_id: u64 = env
            .storage()
            .instance()
            .get(&DataKey::NextPlanId)
            .unwrap_or(1);
        let plan = Plan {
            creator: creator.clone(),
            asset: asset.clone(),
            amount,
            interval,
            active: true,
        };
        env.storage().persistent().set(&DataKey::Plan(plan_id), &plan);
        env.storage()
            .instance()
            .set(&DataKey::NextPlanId, &(plan_id + 1));

        env.events().publish(
            (symbol_short!("plan"), symbol_short!("created")),
            (plan_id, creator, asset, amount, interval),
        );
        Ok(plan_id)
    }

    /// Subscribe to a plan. Requires fan auth. Blocked while paused. The
    /// `asset` argument must match the plan's asset or the call returns
    /// `Error::AssetMismatch` before any charge or subscription write.
    pub fn subscribe(env: Env, fan: Address, plan_id: u64, asset: Address) -> Result<(), Error> {
        fan.require_auth();
        Self::require_active(&env)?;
        let plan = Self::load_plan(&env, plan_id)?;
        if !plan.active {
            return Err(Error::PlanInactive);
        }
        if asset != plan.asset {
            return Err(Error::AssetMismatch);
        }
        Self::charge(&env, &fan, &plan);
        let expires_at = Self::next_expiry(&env, plan.interval);
        let sub = Subscription {
            fan: fan.clone(),
            creator: plan.creator.clone(),
            plan_id,
            asset: plan.asset.clone(),
            expires_at,
        };
        env.storage()
            .persistent()
            .set(&DataKey::Sub(fan.clone(), plan.creator.clone()), &sub);

        env.events().publish(
            (symbol_short!("sub"), symbol_short!("created")),
            (fan, plan.creator, plan_id, expires_at),
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
        let key = DataKey::Sub(fan.clone(), plan.creator.clone());
        let mut sub: Subscription = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(Error::NotSubscriber)?;
        if sub.plan_id != plan_id {
            return Err(Error::PlanNotFound);
        }
        if sub.asset != plan.asset {
            return Err(Error::AssetMismatch);
        }
        Self::charge(&env, &fan, &plan);
        sub.expires_at = Self::next_expiry(&env, plan.interval);
        env.storage().persistent().set(&key, &sub);

        env.events().publish(
            (symbol_short!("sub"), symbol_short!("renewed")),
            (fan, plan.creator, plan_id, sub.expires_at),
        );
        Ok(())
    }

    /// Alias for `renew` used by the interface contract.
    pub fn extend_subscription(env: Env, fan: Address, plan_id: u64) -> Result<(), Error> {
        Self::renew(env, fan, plan_id)
    }

    /// Cancel a subscription. Requires fan auth. No refund (documented).
    pub fn cancel(env: Env, fan: Address, creator: Address) -> Result<(), Error> {
        fan.require_auth();
        let key = DataKey::Sub(fan.clone(), creator.clone());
        if !env.storage().persistent().has(&key) {
            return Err(Error::NotSubscriber);
        }
        env.storage().persistent().remove(&key);

        env.events().publish(
            (symbol_short!("sub"), symbol_short!("cancelled")),
            (fan, creator),
        );
        Ok(())
    }

    /// Returns true when `fan` has an active (non-expired) subscription to `creator`.
    pub fn is_subscriber(env: Env, fan: Address, creator: Address) -> bool {
        let key = DataKey::Sub(fan, creator);
        match env.storage().persistent().get::<DataKey, Subscription>(&key) {
            Some(sub) => sub.expires_at > env.ledger().sequence() as u64,
            None => false,
        }
    }

    /// Admin pause. Requires admin auth. Storage unchanged on unauthorized call.
    pub fn pause(env: Env) -> Result<(), Error> {
        let mut config = Self::require_init(&env)?;
        config.admin.require_auth();
        config.paused = true;
        env.storage().instance().set(&DataKey::Config, &config);
        Ok(())
    }

    /// Admin unpause. Requires admin auth.
    pub fn unpause(env: Env) -> Result<(), Error> {
        let mut config = Self::require_init(&env)?;
        config.admin.require_auth();
        config.paused = false;
        env.storage().instance().set(&DataKey::Config, &config);
        Ok(())
    }

    /// Admin fee setter. Requires admin auth. Enforces MAX_FEE_BPS cap.
    pub fn set_protocol_fee(env: Env, protocol_fee_bps: u32) -> Result<(), Error> {
        let mut config = Self::require_init(&env)?;
        config.admin.require_auth();
        if protocol_fee_bps > MAX_FEE_BPS {
            return Err(Error::FeeTooHigh);
        }
        config.protocol_fee_bps = protocol_fee_bps;
        env.storage().instance().set(&DataKey::Config, &config);
        env.events().publish(
            (symbol_short!("fee"), symbol_short!("updated")),
            (protocol_fee_bps, config.fee_recipient.clone()),
        );
        Ok(())
    }

    /// Admin fee recipient setter. Requires admin auth. Rejects a recipient
    /// equal to the admin with `Error::InvalidFeeRecipient`. Emits the
    /// fee-updated event so indexers observe the new destination.
    pub fn set_fee_recipient(env: Env, recipient: Address) -> Result<(), Error> {
        let mut config = Self::require_init(&env)?;
        config.admin.require_auth();
        if recipient == config.admin {
            return Err(Error::InvalidFeeRecipient);
        }
        config.fee_recipient = recipient.clone();
        env.storage().instance().set(&DataKey::Config, &config);
        env.events().publish(
            (symbol_short!("fee"), symbol_short!("updated")),
            (config.protocol_fee_bps, recipient),
        );
        Ok(())
    }

    /// Returns the current config (admin, fee, recipient, paused).
    pub fn get_config(env: Env) -> Result<Config, Error> {
        Self::require_init(&env)
    }

    /// Loads the config or returns `Error::NotInitialized`.
    fn require_init(env: &Env) -> Result<Config, Error> {
        env.storage()
            .instance()
            .get(&DataKey::Config)
            .ok_or(Error::NotInitialized)
    }

    /// Loads the config and rejects calls while paused.
    fn require_active(env: &Env) -> Result<Config, Error> {
        let config = Self::require_init(env)?;
        if config.paused {
            return Err(Error::Paused);
        }
        Ok(config)
    }

    /// Loads a plan or returns `Error::PlanNotFound`.
    fn load_plan(env: &Env, plan_id: u64) -> Result<Plan, Error> {
        env.storage()
            .persistent()
            .get(&DataKey::Plan(plan_id))
            .ok_or(Error::PlanNotFound)
    }

    /// Computes the next expiry ledger sequence for a plan interval.
    fn next_expiry(env: &Env, interval: u64) -> u64 {
        env.ledger().sequence() as u64 + interval + PERIOD_LEDGERS
    }

    /// Charges the fan for a plan: transfers the plan amount to the creator and
    /// the protocol fee to the stored fee recipient. The recipient is always
    /// read from `Config`, never from a caller-supplied argument.
    fn charge(env: &Env, fan: &Address, plan: &Plan) {
        let config = Self::require_init(env).unwrap_or_else(|e| panic_with_error!(env, e));
        let token_client = token::Client::new(env, &plan.asset);
        token_client.transfer(fan, &plan.creator, &plan.amount);
        let fee = plan.amount * config.protocol_fee_bps as i128 / BPS_DENOM;
        if fee > 0 {
            token_client.transfer(fan, &config.fee_recipient, &fee);
        }
    }
}
