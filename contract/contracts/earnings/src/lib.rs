#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, Address, Env,
};

#[contracttype]
enum DataKey {
    Admin,
    Earnings(Address),
}

#[contracterror]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Error {
    AlreadyInitialized = 1,
}

#[contract]
pub struct Earnings;

#[contractimpl]
impl Earnings {
    pub fn init(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic_with_error!(&env, Error::AlreadyInitialized);
        }

        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
    }

    pub fn admin(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Admin).unwrap()
    }

    pub fn record(env: Env, creator: Address, amount: i128) {
        let admin = Self::admin(env.clone());
        admin.require_auth();

        let current: i128 = env
            .storage()
            .instance()
            .get(&DataKey::Earnings(creator.clone()))
            .unwrap_or(0);
        env.storage()
            .instance()
            .set(&DataKey::Earnings(creator), &(current + amount));
    }

    pub fn get_earnings(env: Env, creator: Address) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::Earnings(creator))
            .unwrap_or(0)
    }
}

mod test;
