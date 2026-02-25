#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, token, Address, Env, Symbol,
};

#[contracttype]
pub enum DataKey {
    Admin,
    Token,
    Balance(Address),
    AuthorizedDepositor(Address),
}

#[contracttype]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum EarningsError {
    NotInitialized = 1,
    NotAuthorized = 2,
    InsufficientBalance = 3,
}

#[contract]
pub struct CreatorEarnings;

#[contractimpl]
impl CreatorEarnings {
    /// Initialize contract with admin and accepted token
    pub fn initialize(env: Env, admin: Address, token_address: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }

        admin.require_auth();

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Token, &token_address);
    }

    /// Add authorized depositor contract (admin only)
    pub fn add_authorized(env: Env, contract: Address) {
        let admin: Address = Self::get_admin(&env);
        admin.require_auth();

        env.storage()
            .instance()
            .set(&DataKey::AuthorizedDepositor(contract), &true);
    }

    /// Deposit earnings for creator
    /// Callable by authorized contracts or admin
pub fn deposit(env: Env, from: Address, creator: Address, amount: i128) {
    if amount <= 0 {
        panic!("invalid amount");
    }

    from.require_auth();
    Self::require_authorized(&env, &from);

    let token_address: Address = Self::get_token(&env);
    let token_client = token::Client::new(&env, &token_address);

    token_client.transfer(
        &from,
        &env.current_contract_address(),
        &amount,
    );

    let balance = Self::balance(env.clone(), creator.clone());
    let new_balance = balance + amount;

    env.storage()
        .instance()
        .set(&DataKey::Balance(creator.clone()), &new_balance);
}

    /// Get creator balance
    pub fn balance(env: Env, creator: Address) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::Balance(creator))
            .unwrap_or(0)
    }

    /// Withdraw earnings
    pub fn withdraw(env: Env, creator: Address, amount: i128) {
        if amount <= 0 {
            panic!("invalid amount");
        }

        creator.require_auth();

        let current_balance = Self::balance(env.clone(), creator.clone());

        if current_balance < amount {
            panic!("insufficient balance");
        }

        let token_address: Address = Self::get_token(&env);
        let token_client = token::Client::new(&env, &token_address);

        // Transfer from contract to creator
        token_client.transfer(
            &env.current_contract_address(),
            &creator,
            &amount,
        );

        let new_balance = current_balance - amount;

        env.storage()
            .instance()
            .set(&DataKey::Balance(creator.clone()), &new_balance);

        env.events().publish(
            (Symbol::new(&env, "withdraw"),),
            (creator, amount, token_address),
        );
    }

    // -------- Internal helpers --------

    fn get_admin(env: &Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("not initialized")
    }

    fn get_token(env: &Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::Token)
            .expect("not initialized")
    }

    fn require_authorized(env: &Env, caller: &Address) {
        let admin = Self::get_admin(env);

        if caller == &admin {
            return;
        }

        if env
            .storage()
            .instance()
            .has(&DataKey::AuthorizedDepositor(caller.clone()))
        {
            return;
        }

        panic!("not authorized");
    }
}

#[cfg(test)]
mod test;