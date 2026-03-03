#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, Address, Env};

/// Minimum number of ledgers between registrations per caller (anti-spam).
const RATE_LIMIT_LEDGERS: u32 = 10;

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Creator(Address),           // maps creator address -> creator_id (u64)
    LastRegLedger(Address),    // last ledger when this caller did a registration
}

#[contract]
pub struct CreatorRegistryContract;

#[contractimpl]
impl CreatorRegistryContract {
    /// Initialize the contract with an admin address
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
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
            .unwrap_or_else(|| panic!("not initialized"));

        caller.require_auth();

        if caller != admin && caller != creator_address {
            panic!("unauthorized: must be admin or the creator");
        }

        let current = env.ledger().sequence();
        let last_key = DataKey::LastRegLedger(caller.clone());
        if let Some(last) = env.storage().persistent().get::<DataKey, u32>(&last_key) {
            if current < last.saturating_add(RATE_LIMIT_LEDGERS) {
                panic!("rate limit: one registration per {} ledgers", RATE_LIMIT_LEDGERS);
            }
        }

        let key = DataKey::Creator(creator_address.clone());
        if env.storage().persistent().has(&key) {
            panic!("already registered");
        }

        env.storage().persistent().set(&last_key, &current);
        env.storage().persistent().set(&key, &creator_id);
    }

    /// Look up a creator_id by their registered address
    pub fn get_creator_id(env: Env, address: Address) -> Option<u64> {
        env.storage().persistent().get(&DataKey::Creator(address))
    }
}

mod test;
