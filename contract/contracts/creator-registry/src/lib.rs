#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, Address, Env};

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Creator(Address), // maps creator address -> creator_id (u64)
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

        let key = DataKey::Creator(creator_address.clone());
        if env.storage().persistent().has(&key) {
            panic!("already registered");
        }

        env.storage().persistent().set(&key, &creator_id);
    }

    /// Look up a creator_id by their registered address
    pub fn get_creator_id(env: Env, address: Address) -> Option<u64> {
        env.storage().persistent().get(&DataKey::Creator(address))
    }
}

mod test;
