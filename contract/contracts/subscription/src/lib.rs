#![no_std]
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, token, Address, Env,
    String, Symbol,
};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Plan {
    pub creator: Address,
    pub asset: Address,
    pub amount: i128,
    pub interval_days: u32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Subscription {
    pub fan: Address,
    pub plan_id: u32,
    pub expiry: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    Admin,
    FeeBps,
    FeeRecipient,
    PlanCount,
    Plan(u32),
    // Canonical storage name: `subscription`.
    // Keep the legacy `Sub` variant to preserve deployed key serialization.
    Sub(Address, Address),
    CreatorSubscriptionCount(Address),
    AcceptedToken(Address),
    Token,
    Price,
    Paused,
}

impl DataKey {
    #[inline]
    pub fn subscription(fan: Address, creator: Address) -> Self {
        DataKey::Sub(fan, creator)
    }

    /// Canonical token address storage key; serializes as [`DataKey::Token`].
    #[inline]
    pub fn token_address() -> Self {
        DataKey::Token
    }
}

/// Per-contract error codes for the **subscription** contract.
///
/// These discriminants are stable and form part of the public client API.
/// Do **not** renumber existing variants; add new ones at the end.
///
/// | Code | Variant |
/// |------|---------|
/// | 1 | `AlreadyInitialized` |
/// | 2 | `Paused` |
/// | 3 | `SubscriptionNotFound` |
/// | 4 | `SubscriptionExpired` |
/// | 5 | `AdminNotInitialized` |
/// | 6 | `InvalidFeeRecipient` |
/// | 7 | `InvalidFeeBps` |
/// | 8 | `InvalidTokenAddress` |
/// | 9 | `InvalidPrice` |
#[contracterror]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Error {
    /// Code 1 – contract was already initialized.
    AlreadyInitialized = 1,
    /// Code 2 – contract is paused; state-changing calls are rejected.
    Paused = 2,
    /// Code 3 – no subscription record found for (fan, creator).
    SubscriptionNotFound = 3,
    /// Code 4 – subscription exists but its expiry ledger has passed.
    SubscriptionExpired = 4,
    /// Code 5 – admin key not present; contract was never initialized.
    AdminNotInitialized = 5,
    /// Code 6 – fee recipient is the Stellar null/burn address.
    InvalidFeeRecipient = 6,
    /// Code 7 – fee basis points exceed 10 000 (100 %).
    InvalidFeeBps = 7,
    /// Code 8 – token address is the Stellar null/burn address.
    InvalidTokenAddress = 8,
    /// Code 9 – subscription price must be strictly positive.
    InvalidPrice = 9,
}

/// Stellar "null" account (GAAA...WHF) — not a valid fee recipient.
fn null_account_address(env: &Env) -> Address {
    Address::from_string(&String::from_str(
        env,
        "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
    ))
}

fn require_valid_fee_recipient(env: &Env, addr: &Address) {
    if addr == &null_account_address(env) {
        panic_with_error!(env, Error::InvalidFeeRecipient);
    }
}

/// Protocol fee in basis points must not exceed 100% (10_000 bps).
fn require_valid_fee_bps(env: &Env, fee_bps: u32) {
    if fee_bps > 10_000 {
        panic_with_error!(env, Error::InvalidFeeBps);
    }
}

fn require_valid_token_address(env: &Env, token: &Address) {
    if token == &null_account_address(env) {
        panic_with_error!(env, Error::InvalidTokenAddress);
    }
}

#[contract]
pub struct MyfansContract;

#[contractimpl]
impl MyfansContract {
    /// Initialize the subscription contract once.
    ///
    /// Validates:
    /// * `fee_bps` must be ≤ 10000 (100%).
    /// * `token` must be a valid non-null address.
    /// * `price` must be strictly positive.
    pub fn init(
        env: Env,
        admin: Address,
        fee_bps: u32,
        fee_recipient: Address,
        token: Address,
        price: i128,
    ) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic_with_error!(&env, Error::AlreadyInitialized);
        }
        require_valid_fee_recipient(&env, &fee_recipient);
        require_valid_fee_bps(&env, fee_bps);
        require_valid_token_address(&env, &token);
        if price <= 0 {
            panic_with_error!(&env, Error::InvalidPrice);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::FeeBps, &fee_bps);
        env.storage()
            .instance()
            .set(&DataKey::FeeRecipient, &fee_recipient);
        env.storage().instance().set(&DataKey::PlanCount, &0u32);
        env.storage()
            .instance()
            .set(&DataKey::token_address(), &token);
        env.storage().instance().set(&DataKey::Price, &price);
    }

    pub fn create_plan(
        env: Env,
        creator: Address,
        asset: Address,
        amount: i128,
        interval_days: u32,
    ) -> u32 {
        creator.require_auth();
        let paused: bool = env
            .storage()
            .instance()
            .get(&DataKey::Paused)
            .unwrap_or(false);
        if paused {
            panic_with_error!(&env, Error::Paused);
        }

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
        // topics: (name, creator)  data: plan_id
        env.events()
            .publish((Symbol::new(&env, "plan_created"), creator), plan_id);
        plan_id
    }

    pub fn subscribe(env: Env, fan: Address, plan_id: u32, _token: Address) {
        fan.require_auth();
        let paused: bool = env
            .storage()
            .instance()
            .get(&DataKey::Paused)
            .unwrap_or(false);
        if paused {
            panic_with_error!(&env, Error::Paused);
        }

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

        let expiry = env.ledger().sequence() + (plan.interval_days * 17280);
        let sub = Subscription {
            fan: fan.clone(),
            plan_id,
            expiry: expiry as u64,
        };
        env.storage().instance().set(
            &DataKey::subscription(fan.clone(), plan.creator.clone()),
            &sub,
        );
        // topics: (name, fan, creator)  data: plan_id
        env.events().publish(
            (
                Symbol::new(&env, "subscribed"),
                fan.clone(),
                plan.creator.clone(),
            ),
            plan_id,
        );
    }

    pub fn admin(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .unwrap_or_else(|| panic_with_error!(&env, Error::AdminNotInitialized))
    }

    pub fn is_subscriber(env: Env, fan: Address, creator: Address) -> bool {
        if let Some(sub) = env
            .storage()
            .instance()
            .get::<DataKey, Subscription>(&DataKey::subscription(fan, creator))
        {
            env.ledger().sequence() <= sub.expiry as u32
        } else {
            false
        }
    }

    pub fn extend_subscription(
        env: Env,
        fan: Address,
        creator: Address,
        extra_ledgers: u32,
        token: Address,
    ) {
        fan.require_auth();
        let paused: bool = env
            .storage()
            .instance()
            .get(&DataKey::Paused)
            .unwrap_or(false);
        assert!(!paused, "contract is paused");

        let sub: Subscription = env
            .storage()
            .instance()
            .get(&DataKey::Sub(fan.clone(), creator.clone()))
            .unwrap_or_else(|| panic_with_error!(&env, Error::SubscriptionNotFound));

        if env.ledger().sequence() > sub.expiry as u32 {
            panic_with_error!(&env, Error::SubscriptionExpired);
        }

        let plan: Plan = env
            .storage()
            .instance()
            .get(&DataKey::Plan(sub.plan_id))
            .unwrap();

        let fee_bps: u32 = env.storage().instance().get(&DataKey::FeeBps).unwrap_or(0);
        let fee_recipient: Address = env
            .storage()
            .instance()
            .get(&DataKey::FeeRecipient)
            .unwrap();

        let fee = (plan.amount * fee_bps as i128) / 10000;
        let creator_amount = plan.amount - fee;

        let token_client = token::Client::new(&env, &token);
        token_client.transfer(&fan, &creator, &creator_amount);
        if fee > 0 {
            token_client.transfer(&fan, &fee_recipient, &fee);
        }

        let new_expiry = sub.expiry + extra_ledgers as u64;
        let updated_sub = Subscription {
            fan: fan.clone(),
            plan_id: sub.plan_id,
            expiry: new_expiry,
        };

        env.storage().instance().set(
            &DataKey::subscription(fan.clone(), creator.clone()),
            &updated_sub,
        );

        // topics: (name, fan, creator)  data: plan_id
        env.events().publish(
            (Symbol::new(&env, "extended"), fan.clone(), creator),
            sub.plan_id,
        );
    }

    /// Cancel a subscription.
    ///
    /// # Arguments
    /// * `fan` - The subscriber address (must authorize)
    /// * `creator` - The creator address
    /// * `reason` - Reason code for cancellation (e.g. 0 = user-initiated,
    ///   1 = too expensive, 2 = content quality, 3 = switching creator, 4 = other)
    ///
    /// Event: `cancelled` — topics: `(name, fan, creator)` data: `(true, reason)`
    /// Backward-compatible: topics unchanged; data is now a tuple instead of bare `true`.
    pub fn cancel(env: Env, fan: Address, creator: Address, reason: u32) {
        fan.require_auth();
        let paused: bool = env
            .storage()
            .instance()
            .get(&DataKey::Paused)
            .unwrap_or(false);
        if paused {
            panic_with_error!(&env, Error::Paused);
        }

        env.storage()
            .instance()
            .remove(&DataKey::subscription(fan.clone(), creator.clone()));
        // topics: (name, fan, creator)  data: (true, reason)
        env.events().publish(
            (Symbol::new(&env, "cancelled"), fan.clone(), creator),
            (true, reason),
        );
    }

    pub fn create_subscription(env: Env, fan: Address, creator: Address, duration_ledgers: u32) {
        fan.require_auth();
        let paused: bool = env
            .storage()
            .instance()
            .get(&DataKey::Paused)
            .unwrap_or(false);
        assert!(!paused, "contract is paused");

        let token: Address = env
            .storage()
            .instance()
            .get(&DataKey::token_address())
            .unwrap();
        let price: i128 = env.storage().instance().get(&DataKey::Price).unwrap();
        let fee_bps: u32 = env.storage().instance().get(&DataKey::FeeBps).unwrap_or(0);
        let fee_recipient: Address = env
            .storage()
            .instance()
            .get(&DataKey::FeeRecipient)
            .unwrap();

        let fee = (price * fee_bps as i128) / 10000;
        let creator_amount = price - fee;

        let token_client = token::Client::new(&env, &token);
        token_client.transfer(&fan, &creator, &creator_amount);
        if fee > 0 {
            token_client.transfer(&fan, &fee_recipient, &fee);
        }

        let expires_at_ledger = env.ledger().sequence() + duration_ledgers;

        let sub = Subscription {
            fan: fan.clone(),
            plan_id: 0,
            expiry: expires_at_ledger as u64,
        };

        env.storage()
            .instance()
            .set(&DataKey::subscription(fan.clone(), creator.clone()), &sub);

        let mut current_count: u32 = env
            .storage()
            .instance()
            .get(&DataKey::CreatorSubscriptionCount(creator.clone()))
            .unwrap_or(0);

        current_count += 1;
        env.storage().instance().set(
            &DataKey::CreatorSubscriptionCount(creator.clone()),
            &current_count,
        );

        // topics: (name, fan, creator)  data: 0u32 (direct sub — no plan)
        env.events().publish(
            (Symbol::new(&env, "subscribed"), fan.clone(), creator),
            0u32,
        );
    }

    /// Pause the contract (admin only)
    /// Prevents all state-changing operations: create_plan, subscribe, cancel
    pub fn pause(env: Env) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .unwrap_or_else(|| panic_with_error!(&env, Error::AdminNotInitialized));
        admin.require_auth();

        env.storage().instance().set(&DataKey::Paused, &true);
        env.events().publish((Symbol::new(&env, "paused"),), admin);
    }

    /// Unpause the contract (admin only)
    /// Allows state-changing operations to resume
    pub fn unpause(env: Env) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .unwrap_or_else(|| panic_with_error!(&env, Error::AdminNotInitialized));
        admin.require_auth();

        env.storage().instance().set(&DataKey::Paused, &false);
        env.events()
            .publish((Symbol::new(&env, "unpaused"),), admin);
    }

    /// Rotate the protocol fee recipient (admin only).
    ///
    /// Rejects the Stellar null / burn strkey (`GAAA...WHF`). On success, emits
    /// `fee_recipient_updated` (on-chain symbol; product docs: fee-recipient-updated)
    /// with topics `(fee_recipient_updated, old_recipient, new_recipient)`.
    pub fn set_fee_recipient(env: Env, new_fee_recipient: Address) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .unwrap_or_else(|| panic_with_error!(&env, Error::AdminNotInitialized));
        admin.require_auth();

        require_valid_fee_recipient(&env, &new_fee_recipient);

        let old: Address = env
            .storage()
            .instance()
            .get(&DataKey::FeeRecipient)
            .unwrap();

        env.storage()
            .instance()
            .set(&DataKey::FeeRecipient, &new_fee_recipient);

        env.events().publish(
            (
                Symbol::new(&env, "fee_recipient_updated"),
                old,
                new_fee_recipient,
            ),
            (),
        );
    }

    /// Update protocol fee basis points (admin only). `new_fee_bps` must be <= 10_000.
    ///
    /// Emits `fee_updated` (on-chain symbol; product docs: fee-updated) with data `(old_bps, new_bps)`.
    pub fn set_fee_bps(env: Env, new_fee_bps: u32) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .unwrap_or_else(|| panic_with_error!(&env, Error::AdminNotInitialized));
        admin.require_auth();

        require_valid_fee_bps(&env, new_fee_bps);

        let old: u32 = env.storage().instance().get(&DataKey::FeeBps).unwrap_or(0);

        env.storage().instance().set(&DataKey::FeeBps, &new_fee_bps);

        env.events()
            .publish((Symbol::new(&env, "fee_updated"),), (old, new_fee_bps));
    }

    /// Check if the contract is paused (view function)
    pub fn is_paused(env: Env) -> bool {
        env.storage()
            .instance()
            .get(&DataKey::Paused)
            .unwrap_or(false)
    }

    /// Returns (expiry_ledger_seq, expiry_unix_timestamp) for the subscription.
    ///
    /// `expiry_unix_timestamp` is derived from the ledger close time at the
    /// moment of the call, anchored to the current ledger sequence and timestamp.
    /// This lets callers avoid ledger-sequence vs wall-clock skew by using the
    /// on-chain timestamp directly.
    ///
    /// Returns (0, 0) if no subscription exists.
    pub fn get_expiry_unix(env: Env, fan: Address, creator: Address) -> (u64, u64) {
        let sub = match env
            .storage()
            .instance()
            .get::<DataKey, Subscription>(&DataKey::subscription(fan, creator))
        {
            Some(s) => s,
            None => return (0, 0),
        };

        let expiry_seq = sub.expiry;
        let current_seq = env.ledger().sequence() as u64;
        let current_ts = env.ledger().timestamp(); // Unix seconds at current ledger

        // Stellar nominal close time is 5 seconds per ledger.
        const SECONDS_PER_LEDGER: u64 = 5;

        let expiry_unix = if expiry_seq >= current_seq {
            current_ts + (expiry_seq - current_seq) * SECONDS_PER_LEDGER
        } else {
            // Already expired: subtract elapsed ledgers
            let elapsed = current_seq - expiry_seq;
            current_ts.saturating_sub(elapsed * SECONDS_PER_LEDGER)
        };

        (expiry_seq, expiry_unix)
    }
}

/// Dummy seed data for snapshot/restore tests.
#[cfg(test)]
pub mod dummy_data;

#[cfg(test)]
mod test;
