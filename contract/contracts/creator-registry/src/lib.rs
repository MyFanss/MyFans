#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, Address, Env, Symbol,
};

use soroban_sdk::token::Client;

/// Minimum number of ledgers between registrations per caller (anti-spam).
const DEFAULT_RATE_LIMIT: u32 = 10;

/// TTL policy for persistent Creator registry keys (`DataKey::Creator` and
/// `DataKey::CreatorIdOwner`): once a key's remaining TTL drops below this
/// many ledgers, it is refreshed back up to `CREATOR_TTL_EXTEND_TO`. Applied
/// on every write (registration) and successful read (lookup) so long-lived
/// registrations are never evicted by archival.
const CREATOR_TTL_THRESHOLD: u32 = 10_000;
/// See [`CREATOR_TTL_THRESHOLD`].
const CREATOR_TTL_EXTEND_TO: u32 = 100_000;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    Admin,
    Creator(Address), // maps creator address -> creator_id (u64)
    // Canonical storage name: `registration_ledger`.
    // Keep the legacy `LastRegLedger` variant to preserve deployed key serialization.
    LastRegLedger(Address),
    // Reverse mapping: maps creator_id -> owner address, enforcing a globally
    // unique creator_id across all registered addresses.
    CreatorIdOwner(u64),

    RateLimit,
    SpamFee,
    FeeToken,
}

impl DataKey {
    /// Canonical registration ledger storage key; serializes as [`DataKey::LastRegLedger`].
    #[inline]
    pub fn registration_ledger(caller: Address) -> Self {
        DataKey::LastRegLedger(caller)
    }
}

/// Per-contract error codes for the **creator-registry** contract.
///
/// These discriminants are stable and form part of the public client API.
/// Do **not** renumber existing variants; add new ones at the end.
///
/// | Code | Variant |
/// |------|---------|
/// | 1 | `AlreadyInitialized` |
/// | 2 | `NotInitialized` |
/// | 3 | `Unauthorized` |
/// | 4 | `RateLimited` |
/// | 5 | `AlreadyRegistered` |
/// | 6 | `NotRegistered` |
/// | 7 | `InvalidAmount` |
/// | 8 | `CreatorIdTaken` |
#[contracterror]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Error {
    /// Code 1 – contract was already initialized.
    AlreadyInitialized = 1,
    /// Code 2 – contract was never initialized.
    NotInitialized = 2,
    /// Code 3 – caller is neither admin nor the creator being registered.
    Unauthorized = 3,
    /// Code 4 – caller registered too recently; wait for the rate-limit window.
    RateLimited = 4,
    /// Code 5 – creator address is already registered.
    AlreadyRegistered = 5,
    /// Code 6 – creator address is not registered.
    NotRegistered = 6,
    /// Code 7 – spam fee amount is negative.
    InvalidAmount = 7,
    /// Code 8 – creator_id is already owned by a different creator address.
    CreatorIdTaken = 8,
}

/// -------- Events --------

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct InitializedEvent {
    pub admin: Address,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CreatorRegisteredEvent {
    pub caller: Address,
    pub creator: Address,
    pub creator_id: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CreatorUnregisteredEvent {
    pub creator: Address,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RateLimitSetEvent {
    pub ledgers: u32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SpamFeeSetEvent {
    pub token: Address,
    pub amount: i128,
}

const INITIALIZED_EVENT: &str = "initialized";
const CREATOR_REGISTERED_EVENT: &str = "creator_registered";
const CREATOR_UNREGISTERED_EVENT: &str = "creator_unregistered";
const RATE_LIMIT_SET_EVENT: &str = "rate_limit_set";
const SPAM_FEE_SET_EVENT: &str = "spam_fee_set";

#[contract]
pub struct CreatorRegistryContract;

#[contractimpl]
impl CreatorRegistryContract {
    /// Initialize the contract with an admin address
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic_with_error!(&env, Error::AlreadyInitialized);
        }

        admin.require_auth();

        env.storage().instance().set(&DataKey::Admin, &admin);

        env.storage()
            .instance()
            .set(&DataKey::RateLimit, &DEFAULT_RATE_LIMIT);
        env.storage().instance().set(&DataKey::SpamFee, &0i128);

        env.events().publish(
            (Symbol::new(&env, INITIALIZED_EVENT),),
            InitializedEvent {
                admin,
            },
        );
    }
    // set the number of ledgers for rate limiting (admin only)
    pub fn set_rate_limit(env: Env, ledgers: u32) {
        let admin = Self::get_admin(&env);
        admin.require_auth();

        env.storage().instance().set(&DataKey::RateLimit, &ledgers);

        env.events().publish(
            (Symbol::new(&env, RATE_LIMIT_SET_EVENT),),
            RateLimitSetEvent { ledgers },
        );
    }

    // set the fee for spamming registrations (admin only)
    pub fn set_spam_fee(env: Env, token: Address, amount: i128) {
        let admin = Self::get_admin(&env);
        admin.require_auth();

        if amount < 0 {
            panic_with_error!(&env, Error::InvalidAmount);
        }

        env.storage().instance().set(&DataKey::SpamFee, &amount);
        env.storage().instance().set(&DataKey::FeeToken, &token);

        env.events().publish(
            (Symbol::new(&env, SPAM_FEE_SET_EVENT),),
            SpamFeeSetEvent {
                token,
                amount,
            },
        );
    }

    /// Register a creator with a specific creator_id
    /// Can only be called by the admin or the creator itself.
    /// Rate limited: same caller can only register once per RATE_LIMIT_LEDGERS ledgers.
    pub fn register_creator(env: Env, caller: Address, creator_address: Address, creator_id: u64) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .unwrap_or_else(|| panic_with_error!(&env, Error::NotInitialized));

        caller.require_auth();

        if caller != admin && caller != creator_address {
            panic_with_error!(&env, Error::Unauthorized);
        }

        let current = env.ledger().sequence();
        let last_key = DataKey::registration_ledger(caller.clone());
        if let Some(last) = env.storage().persistent().get::<DataKey, u32>(&last_key) {
            if current < last.saturating_add(DEFAULT_RATE_LIMIT) {
                panic_with_error!(&env, Error::RateLimited);
            }
        }

        let key = DataKey::Creator(creator_address.clone());
        if env.storage().persistent().has(&key) {
            panic_with_error!(&env, Error::AlreadyRegistered);
        }

        // creator_address is not yet registered (checked above), so any existing
        // owner of creator_id here is necessarily a different address.
        let id_owner_key = DataKey::CreatorIdOwner(creator_id);
        if env.storage().persistent().has(&id_owner_key) {
            panic_with_error!(&env, Error::CreatorIdTaken);
        }

        // Charge the spam fee before persisting registration so a failed
        // transfer never leaves a registered-but-unpaid creator.
        let fee: i128 = env.storage().instance().get(&DataKey::SpamFee).unwrap_or(0);

        if fee > 0 {
            let token_address: Address = env
                .storage()
                .instance()
                .get(&DataKey::FeeToken)
                .unwrap_or_else(|| panic_with_error!(&env, Error::NotInitialized));

            let token_client = Client::new(&env, &token_address);

            // transfer fee from caller to contract if fee is set
            token_client.transfer(&caller, &env.current_contract_address(), &fee);
        }

        env.storage().persistent().set(&last_key, &current);
        env.storage().persistent().set(&key, &creator_id);
        env.storage()
            .persistent()
            .set(&id_owner_key, &creator_address);

        extend_creator_ttl(&env, &key);
        extend_creator_ttl(&env, &id_owner_key);

        env.events().publish(
            (Symbol::new(&env, CREATOR_REGISTERED_EVENT),),
            CreatorRegisteredEvent {
                caller: caller.clone(),
                creator: creator_address.clone(),
                creator_id,
            },
        );
    }

    /// Unregister a creator (admin only).
    /// Panics if the creator is not currently registered.
    pub fn unregister_creator(env: Env, creator_address: Address) {
        let admin = Self::get_admin(&env);
        admin.require_auth();

        let key = DataKey::Creator(creator_address.clone());
        let creator_id: u64 = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or_else(|| panic_with_error!(&env, Error::NotRegistered));

        env.storage().persistent().remove(&key);
        env.storage()
            .persistent()
            .remove(&DataKey::CreatorIdOwner(creator_id));

        env.events().publish(
            (Symbol::new(&env, CREATOR_UNREGISTERED_EVENT),),
            CreatorUnregisteredEvent {
                creator: creator_address,
            },
        );
    }

    /// Read-only getter for the configured admin address.
    ///
    /// Any caller may invoke this view function. It panics with
    /// `Error::NotInitialized` if the contract was never initialized.
    pub fn admin(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .unwrap_or_else(|| panic_with_error!(&env, Error::NotInitialized))
    }

    /// Look up a creator_id by their registered address
    pub fn get_creator_id(env: Env, address: Address) -> Option<u64> {
        let key = DataKey::Creator(address);
        let creator_id = env.storage().persistent().get(&key);
        if creator_id.is_some() {
            extend_creator_ttl(&env, &key);
        }
        creator_id
    }
    // Internal helper to enforce authorization of admin or creator
    fn get_admin(env: &Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .unwrap_or_else(|| panic_with_error!(env, Error::NotInitialized))
    }
}

/// Refresh a persistent Creator-registry key's TTL. See [`CREATOR_TTL_THRESHOLD`].
fn extend_creator_ttl(env: &Env, key: &DataKey) {
    env.storage()
        .persistent()
        .extend_ttl(key, CREATOR_TTL_THRESHOLD, CREATOR_TTL_EXTEND_TO);
}

#[cfg(test)]
mod test;

#[cfg(test)]
mod property_tests;
