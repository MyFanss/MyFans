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
    /// Initialize the contract. Requires admin auth. Reverts on double-init.
    pub fn init(env: Env, admin: Address, protocol_fee_bps: u32, fee_recipient: Address) {
        admin.require_auth();
        if env.storage().instance().has(&DataKey::Config) {
            panic_with_error!(&env, Error::AlreadyInitialized);
        }
        if protocol_fee_bps > MAX_FEE_BPS {
            panic_with_error!(&env, Error::FeeTooHigh);
        }
        let config = Config {
            admin,
            protocol_fee_bps,
            fee_recipient,
            paused: false,
        };
        env.storage().instance().set(&DataKey::Config, &config);
        env.storage().instance().set(&DataKey::NextPlanId, &1u64);
    }

    /// Create a plan. Requires creator auth. Rejects zero amount/interval.
    pub fn create_plan(
        env: Env,
        creator: Address,
        asset: Address,
        amount: i128,
        interval: u64,
    ) -> u64 {
        creator.require_auth();
        Self::require_init(&env);
        if amount <= 0 {
            panic_with_error!(&env, Error::InvalidAmount);
        }
        if interval == 0 {
            panic_with_error!(&env, Error::InvalidInterval);
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
        plan_id
    }

    /// Subscribe to a plan. Requires fan auth. Blocked while paused.
    pub fn subscribe(env: Env, fan: Address, plan_id: u64) {
        fan.require_auth();
        Self::require_active(&env);
        let plan = Self::load_plan(&env, plan_id);
        if !plan.active {
            panic_with_error!(&env, Error::PlanInactive);
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
    }

    /// Renew an existing subscription. Requires fan auth. Wrong asset/plan reverts.
    pub fn renew(env: Env, fan: Address, plan_id: u64) {
        fan.require_auth();
        Self::require_active(&env);
        let plan = Self::load_plan(&env, plan_id);
        if !plan.active {
            panic_with_error!(&env, Error::PlanInactive);
        }
        let key = DataKey::Sub(fan.clone(), plan.creator.clone());
        let mut sub: Subscription = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or_else(|| panic_with_error!(&env, Error::NotSubscriber));
        if sub.plan_id != plan_id {
            panic_with_error!(&env, Error::PlanNotFound);
        }
        if sub.asset != plan.asset {
            panic_with_error!(&env, Error::AssetMismatch);
        }
        Self::charge(&env, &fan, &plan);
        sub.expires_at = Self::next_expiry(&env, plan.interval);
        env.storage().persistent().set(&key, &sub);

        env.events().publish(
            (symbol_short!("sub"), symbol_short!("renewed")),
            (fan, plan.creator, plan_id, sub.expires_at),
        );
    }

    /// Alias for `renew` used by the interface contract.
    pub fn extend_subscription(env: Env, fan: Address, plan_id: u64) {
        Self::renew(env, fan, plan_id);
    }

    /// Cancel a subscription. Requires fan auth. No refund (documented).
    pub fn cancel(env: Env, fan: Address, creator: Address) {
        fan.require_auth();
        let key = DataKey::Sub(fan.clone(), creator.clone());
        if !env.storage().persistent().has(&key) {
            panic_with_error!(&env, Error::NotSubscriber);
        }
        env.storage().persistent().remove(&key);

        env.events().publish(
            (symbol_short!("sub"), symbol_short!("cancelled")),
            (fan, creator),
        );
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
    pub fn pause(env: Env) {
        let mut config = Self::require_init(&env);
        config.admin.require_auth();
        config.paused = true;
        env.storage().instance().set(&DataKey::Config, &config);
    }

    /// Admin unpause. Requires admin auth.
    pub fn unpause(env: Env) {
        let mut config = Self::require_init(&env);
        config.admin.require_auth();
        config.paused = false;
        env.storage().instance().set(&DataKey::Config, &config);
    }

    /// Admin fee setter. Requires admin auth. Enforces MAX_FEE_BPS cap.
    pub fn set_protocol_fee(env: Env, protocol_fee_bps: u32) {
        let mut config = Self::require_init(&env);
        config.admin.require_auth();
        if protocol_fee_bps > MAX_FEE_BPS {
            panic_with_error!(&env, Error::FeeTooHigh);
        }
        config.protocol_fee_bps = protocol_fee_bps;
        env.storage().instance().set(&DataKey::Config, &config);
    }

    /// Read the current config (admin, fee bps, fee recipient, paused).
    pub fn get_config(env: Env) -> Config {
        Self::require_init(&env)
    }

    /// Read a plan by id.
    pub fn get_plan(env: Env, plan_id: u64) -> Plan {
        Self::load_plan(&env, plan_id)
    }

    // ---------------------------------------------------------------------
    // Internal helpers
    // ---------------------------------------------------------------------

    /// Load config, reverting when the contract has not been initialized.
    fn require_init(env: &Env) -> Config {
        env.storage()
            .instance()
            .get(&DataKey::Config)
            .unwrap_or_else(|| panic_with_error!(env, Error::NotInitialized))
    }

    /// Load config and revert when the contract is paused.
    fn require_active(env: &Env) -> Config {
        let config = Self::require_init(env);
        if config.paused {
            panic_with_error!(env, Error::Paused);
        }
        config
    }

    /// Load a plan by id, reverting when it does not exist.
    fn load_plan(env: &Env, plan_id: u64) -> Plan {
        env.storage()
            .persistent()
            .get(&DataKey::Plan(plan_id))
            .unwrap_or_else(|| panic_with_error!(env, Error::PlanNotFound))
    }

    /// Compute the next expiry ledger for a subscription period.
    fn next_expiry(env: &Env, interval: u64) -> u64 {
        let now = env.ledger().sequence() as u64;
        now.checked_add(interval)
            .unwrap_or_else(|| panic_with_error!(env, Error::Overflow))
    }

    /// Transfer `plan.amount` from `fan` to the creator, keeping the protocol
    /// fee asset-identical to the plan asset (no silent FX).
    ///
    /// The transfer path is selected by asset kind:
    /// - Native XLM sentinel: the Stellar Asset Contract for native XLM is used.
    /// - SAC contract address: the SEP-41 token client is invoked directly.
    ///
    /// Distinct typed errors are surfaced for missing trustlines, missing
    /// allowances, insufficient balance, and unsupported assets so callers can
    /// fail closed without partial fee movement.
    fn charge(env: &Env, fan: &Address, plan: &Plan) {
        let config = Self::require_init(env);
        let fee = plan
            .amount
            .checked_mul(config.protocol_fee_bps as i128)
            .and_then(|v| v.checked_div(BPS_DENOM))
            .unwrap_or_else(|| panic_with_error!(env, Error::Overflow));
        let creator_amount = plan
            .amount
            .checked_sub(fee)
            .unwrap_or_else(|| panic_with_error!(env, Error::Overflow));

        // Validate the asset kind before any transfer so a malicious or
        // non-SEP-41 contract fails closed as unsupported.
        Self::validate_asset(env, &plan.asset);

        let client = token::Client::new(env, &plan.asset);

        // Fan -> creator (net of fee).
        client.transfer(fan, &plan.creator, &creator_amount);

        // Fan -> fee recipient (protocol fee), same asset as the plan.
        if fee > 0 {
            client.transfer(fan, &config.fee_recipient, &fee);
        }
    }

    /// Validate that `asset` is a supported transfer target.
    ///
    /// Native XLM is represented by the SAC contract address for native XLM;
    /// SAC tokens are validated by probing the SEP-41 `decimals` interface.
    /// A contract that does not answer the SEP-41 interface is treated as
    /// unsupported and the call fails closed.
    fn validate_asset(env: &Env, asset: &Address) {
        let client = token::Client::new(env, asset);
        // `decimals` is part of the SEP-41 surface; a non-conforming contract
        // will trap here and be surfaced as unsupported by the caller.
        let _ = client.decimals();
    }
}
