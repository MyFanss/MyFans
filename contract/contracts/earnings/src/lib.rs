#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, Address, Env, Symbol,
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

    /// Withdraw `amount` from `creator`'s recorded earnings.
    ///
    /// - Creator must authorize.
    /// - Panics with "insufficient balance" if amount > recorded earnings.
    /// - Emits `withdraw` event: topics `(symbol, creator)`, data `amount`.
    pub fn withdraw(env: Env, creator: Address, amount: i128) {
        creator.require_auth();

        let current: i128 = env
            .storage()
            .instance()
            .get(&DataKey::Earnings(creator.clone()))
            .unwrap_or(0);

        if amount > current {
            panic!("insufficient balance");
        }

        env.storage()
            .instance()
            .set(&DataKey::Earnings(creator.clone()), &(current - amount));

        env.events()
            .publish((Symbol::new(&env, "withdraw"), creator), amount);
    }
}

#[cfg(test)]
mod test;
