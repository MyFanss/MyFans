#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, Address, Env};

#[contracttype]
enum DataKey {
    Admin,
    Creator(Address),
}

#[contract]
pub struct CreatorRegistry;

#[contractimpl]
impl CreatorRegistry {
    pub fn init(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }

        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
    }

    pub fn admin(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Admin).unwrap()
    }

    pub fn register(env: Env, creator: Address) {
        let admin = Self::admin(env.clone());
        admin.require_auth();
        env.storage().instance().set(&DataKey::Creator(creator), &true);
    }

    pub fn is_registered(env: Env, creator: Address) -> bool {
        env.storage()
            .instance()
            .get(&DataKey::Creator(creator))
            .unwrap_or(false)
    }
}
