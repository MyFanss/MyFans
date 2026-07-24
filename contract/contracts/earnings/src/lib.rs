#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, Address, Env, Symbol,
};

#[contracttype]
enum DataKey {
    Admin,
    Earnings(Address),
}

/// Per-contract error codes for the **earnings** contract.
///
/// Numbering scheme: error codes must be non-zero u32 values, and each variant
/// must have a unique discriminant. These discriminants are stable and form part
/// of the public client API. Do **not** renumber existing variants; add new ones
/// at the end with the next available code.
///
/// | Code | Variant |
/// |------|---------|
/// | 1 | `AlreadyInitialized` |
/// | 2 | `NotInitialized` |
#[contracterror]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Error {
    /// Code 1 – contract was already initialized.
    AlreadyInitialized = 1,
    /// Code 2 – admin key not present; contract was never initialized.
    NotInitialized = 2,
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
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .unwrap_or_else(|| panic_with_error!(&env, Error::NotInitialized))
    }

    pub fn record(env: Env, creator: Address, amount: i128) {
        let admin = Self::admin(env.clone());
        admin.require_auth();

        // GAS: Cache the DataKey to minimize cloning of creator address.
        let earnings_key = DataKey::Earnings(creator.clone());
        let current: i128 = env.storage().instance().get(&earnings_key).unwrap_or(0);
        let updated = current
            .checked_add(amount)
            .unwrap_or_else(|| panic_with_error!(&env, Error::Overflow));
        env.storage().instance().set(&earnings_key, &updated);
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

        // GAS: Cache the DataKey to avoid cloning creator twice.
        let earnings_key = DataKey::Earnings(creator.clone());
        let current: i128 = env.storage().instance().get(&earnings_key).unwrap_or(0);

        if amount > current {
            panic!("insufficient balance");
        }

        env.storage()
            .instance()
            .set(&earnings_key, &(current - amount));

        env.events()
            .publish((Symbol::new(&env, "withdraw"), creator), amount);
    }
}

#[cfg(test)]
mod property_tests;
#[cfg(test)]
mod test;
