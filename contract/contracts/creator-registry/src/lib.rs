#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, Address, Env, Symbol,
};

use soroban_sdk::token::Client;

/// Minimum number of ledgers between registrations per caller (anti-spam).
const DEFAULT_RATE_LIMIT: u32 = 10;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    Admin,
    Creator(Address), // maps creator address -> creator_id (u64)
    // Canonical storage name: `registration_ledger`.
    // Keep the legacy `LastRegLedger` variant to preserve deployed key serialization.
    LastRegLedger(Address),

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

#[contracterror]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    RateLimited = 4,
    AlreadyRegistered = 5,
    NotRegistered = 6,

    InvalidAmount = 7,
}

#[contract]
pub struct CreatorRegistryContract;

#[contractimpl]
impl CreatorRegistryContract {
    /// Initialize the contract with an admin address
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic_with_error!(&env, Error::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);

        env.storage()
            .instance()
            .set(&DataKey::RateLimit, &DEFAULT_RATE_LIMIT);
        env.storage().instance().set(&DataKey::SpamFee, &0i128);
    }
    // set the number of ledgers for rate limiting (admin only)
    pub fn set_rate_limit(env: Env, ledgers: u32) {
        let admin = Self::get_admin(&env);
        admin.require_auth();

        env.storage().instance().set(&DataKey::RateLimit, &ledgers);
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

        env.storage().persistent().set(&last_key, &current);
        env.storage().persistent().set(&key, &creator_id);

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
    }

    /// Unregister a creator (admin only).
    /// Panics if the creator is not currently registered.
    pub fn unregister_creator(env: Env, creator_address: Address) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .unwrap_or_else(|| panic!("not initialized"));

        admin.require_auth();

        let key = DataKey::Creator(creator_address);
        if !env.storage().persistent().has(&key) {
            panic!("creator not registered");
        }

        env.storage().persistent().remove(&key);
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
        env.storage().persistent().get(&DataKey::Creator(address))
    }
    // Internal helper to enforce authorization of admin or creator
    fn get_admin(env: &Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .unwrap_or_else(|| panic_with_error!(env, Error::NotInitialized))
    }
}

mod test;
