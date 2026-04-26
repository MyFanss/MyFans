#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, panic_with_error, token, Address, Env, Symbol,
};

const ADMIN: &str = "ADMIN";
const TOKEN: &str = "TOKEN";
const PAUSED: &str = "PAUSED";
const MIN_BALANCE: &str = "MIN_BALANCE";

/// Per-contract error codes for the **treasury** contract.
///
/// These discriminants are stable and form part of the public client API.
/// Do **not** renumber existing variants; add new ones at the end.
///
/// | Code | Variant |
/// |------|---------|
/// | 1 | `NegativeMinBalance` |
/// | 2 | `Paused` |
/// | 3 | `InsufficientBalance` |
/// | 4 | `MinBalanceViolation` |
/// | 5 | `NotInitialized` |
/// | 6 | `InvalidAmount` |
#[contracterror]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Error {
    /// Code 1 – min_balance must be ≥ 0.
    NegativeMinBalance = 1,
    /// Code 2 – contract is paused; deposits and withdrawals are rejected.
    Paused = 2,
    /// Code 3 – contract balance is less than the requested withdrawal amount.
    InsufficientBalance = 3,
    /// Code 4 – withdrawal would leave the balance below the configured minimum.
    MinBalanceViolation = 4,
    /// Code 5 – contract was never initialized.
    NotInitialized = 5,
    /// Code 6 – deposit or withdrawal amount must be strictly positive.
    InvalidAmount = 6,
}

#[contract]
pub struct Treasury;

#[contractimpl]
impl Treasury {
    pub fn initialize(env: Env, admin: Address, token_address: Address) {
        admin.require_auth();

        if env.storage().instance().has(&ADMIN) {
            panic_with_error!(&env, Error::NotInitialized);
        }

        env.storage().instance().set(&ADMIN, &admin);
        env.storage().instance().set(&TOKEN, &token_address);
        env.storage().instance().set(&PAUSED, &false);
        env.storage().instance().set(&MIN_BALANCE, &0i128);
    }

    pub fn set_paused(env: Env, paused: bool) {
        let admin: Address = env.storage().instance().get(&ADMIN).unwrap();
        admin.require_auth();
        env.storage().instance().set(&PAUSED, &paused);
    }

    pub fn set_min_balance(env: Env, amount: i128) {
        let admin: Address = env.storage().instance().get(&ADMIN).unwrap();
        admin.require_auth();
        if amount < 0 {
            panic_with_error!(&env, Error::NegativeMinBalance);
        }
        env.storage().instance().set(&MIN_BALANCE, &amount);
    }

    pub fn deposit(env: Env, from: Address, amount: i128) {
        if amount <= 0 {
            panic_with_error!(&env, Error::InvalidAmount);
        }

        if Self::is_paused(&env) {
            panic_with_error!(&env, Error::Paused);
        }

        from.require_auth();

        let token_address = Self::get_token(&env);
        let contract_address = env.current_contract_address();

        token::Client::new(&env, &token_address).transfer(&from, &contract_address, &amount);

        env.events().publish(
            (Symbol::new(&env, "deposit"),),
            (from, amount, token_address),
        );
    }

    pub fn withdraw(env: Env, to: Address, amount: i128) {
        if amount <= 0 {
            panic_with_error!(&env, Error::InvalidAmount);
        }

        if Self::is_paused(&env) {
            panic_with_error!(&env, Error::Paused);
        }

        let admin = Self::get_admin(&env);
        admin.require_auth();

        let min_balance = Self::get_min_balance(&env);
        let token_address = Self::get_token(&env);
        let token_client = token::Client::new(&env, &token_address);

        let contract_address = env.current_contract_address();
        let balance = token_client.balance(&contract_address);

        if balance < amount {
            panic_with_error!(&env, Error::InsufficientBalance);
        }

        let remaining = balance
            .checked_sub(amount)
            .unwrap_or_else(|| panic_with_error!(&env, Error::InsufficientBalance));

        if remaining < min_balance {
            panic_with_error!(&env, Error::MinBalanceViolation);
        }

        token_client.transfer(&contract_address, &to, &amount);

        env.events().publish(
            (Symbol::new(&env, "withdraw"),),
            (to, amount, token_address),
        );
    }

    // Internal helper functions
    fn get_admin(env: &Env) -> Address {
        env.storage()
            .instance()
            .get(&ADMIN)
            .unwrap_or_else(|| panic_with_error!(env, Error::NotInitialized))
    }

    fn get_token(env: &Env) -> Address {
        env.storage()
            .instance()
            .get(&TOKEN)
            .unwrap_or_else(|| panic_with_error!(env, Error::NotInitialized))
    }

    fn get_min_balance(env: &Env) -> i128 {
        env.storage().instance().get(&MIN_BALANCE).unwrap_or(0)
    }

    fn is_paused(env: &Env) -> bool {
        env.storage().instance().get(&PAUSED).unwrap_or(false)
    }
}

#[cfg(test)]
mod test;
