#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, Address, Env,
};

/// Minimum number of ledgers between registrations per caller (anti-spam).
const RATE_LIMIT_LEDGERS: u32 = 10;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    Admin,
    Creator(Address), // maps creator address -> creator_id (u64)
    // Canonical storage name: `registration_ledger`.
    // Keep the legacy `LastRegLedger` variant to preserve deployed key serialization.
    LastRegLedger(Address), // last ledger when this caller did a registration
}

#[contracterror]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    RateLimited = 4,
    AlreadyRegistered = 5,
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
            if current < last.saturating_add(RATE_LIMIT_LEDGERS) {
                panic_with_error!(&env, Error::RateLimited);
            }
        }

        let key = DataKey::Creator(creator_address.clone());
        if env.storage().persistent().has(&key) {
            panic_with_error!(&env, Error::AlreadyRegistered);
        }

        env.storage().persistent().set(&last_key, &current);
        env.storage().persistent().set(&key, &creator_id);
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

    /// Look up a creator_id by their registered address
    pub fn get_creator_id(env: Env, address: Address) -> Option<u64> {
        env.storage().persistent().get(&DataKey::Creator(address))
    }
}

mod test;
