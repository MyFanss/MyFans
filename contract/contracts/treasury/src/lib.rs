#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, panic_with_error, token, Address, Env, Symbol,
};

const ADMIN: &str = "ADMIN";
const TOKEN: &str = "TOKEN";
const PAUSED: &str = "PAUSED";
const MIN_BALANCE: &str = "MIN_BALANCE";

#[contracterror]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Error {
    NegativeMinBalance = 1,
    Paused = 2,
    InsufficientBalance = 3,
    MinBalanceViolation = 4,
}

#[contract]
pub struct Treasury;

#[contractimpl]
impl Treasury {
    pub fn initialize(env: Env, admin: Address, token_address: Address) {
        admin.require_auth();
        env.storage().instance().set(&ADMIN, &admin);
        env.storage().instance().set(&TOKEN, &token_address);
        env.storage().instance().set(&PAUSED, &false);
        env.storage().instance().set(&MIN_BALANCE, &0i128);
    }

    /// Admin-only: set pause flag. When true, deposit and withdraw are blocked.
    pub fn set_paused(env: Env, paused: bool) {
        let admin: Address = env.storage().instance().get(&ADMIN).unwrap();
        admin.require_auth();
        env.storage().instance().set(&PAUSED, &paused);
    }

    /// Admin-only: set minimum balance. Withdraws that would leave balance below this are blocked.
    pub fn set_min_balance(env: Env, amount: i128) {
        let admin: Address = env.storage().instance().get(&ADMIN).unwrap();
        admin.require_auth();
        if amount < 0 {
            panic_with_error!(&env, Error::NegativeMinBalance);
        }
        env.storage().instance().set(&MIN_BALANCE, &amount);
    }

    pub fn deposit(env: Env, from: Address, amount: i128) {
        let paused: bool = env.storage().instance().get(&PAUSED).unwrap_or(false);
        if paused {
            panic_with_error!(&env, Error::Paused);
        }
        from.require_auth();
        let token_address: Address = env.storage().instance().get(&TOKEN).unwrap();
        let contract_address = env.current_contract_address();
        token::Client::new(&env, &token_address).transfer(&from, &contract_address, &amount);

        env.events().publish(
            (Symbol::new(&env, "deposit"),),
            (from, amount, token_address),
        );
    }

    pub fn withdraw(env: Env, to: Address, amount: i128) {
        let paused: bool = env.storage().instance().get(&PAUSED).unwrap_or(false);
        if paused {
            panic_with_error!(&env, Error::Paused);
        }
        let admin: Address = env.storage().instance().get(&ADMIN).unwrap();
        admin.require_auth();

        let min_balance: i128 = env.storage().instance().get(&MIN_BALANCE).unwrap_or(0);
        let token_address: Address = env.storage().instance().get(&TOKEN).unwrap();
        let token_client = token::Client::new(&env, &token_address);
        let contract_address = env.current_contract_address();
        let balance = token_client.balance(&contract_address);

        if balance < amount {
            panic_with_error!(&env, Error::InsufficientBalance);
        }
        if balance - amount < min_balance {
            panic_with_error!(&env, Error::MinBalanceViolation);
        }

        token_client.transfer(&contract_address, &to, &amount);
    }
}

#[cfg(test)]
mod test;
