//! MyFans token contract.
//!
//! A SEP-41 style fungible token with an admin-controlled mint and burn.

#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, String};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    Admin,
    Name,
    Symbol,
    Decimals,
    TotalSupply,
    Balance(Address),
    Allowance(Address, Address),
}

#[contract]
pub struct MyFansToken;

#[contractimpl]
impl MyFansToken {
    /// Initialize the token. Requires the admin to authorize the call so that
    /// the first caller cannot seize minting rights.
    pub fn initialize(
        env: Env,
        admin: Address,
        name: String,
        symbol: String,
        decimals: u32,
    ) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("AlreadyInitialized");
        }

        admin.require_auth();

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Name, &name);
        env.storage().instance().set(&DataKey::Symbol, &symbol);
        env.storage().instance().set(&DataKey::Decimals, &decimals);
        env.storage().instance().set(&DataKey::TotalSupply, &0i128);
    }

    pub fn admin(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Admin).unwrap()
    }

    pub fn name(env: Env) -> String {
        env.storage().instance().get(&DataKey::Name).unwrap()
    }

    pub fn symbol(env: Env) -> String {
        env.storage().instance().get(&DataKey::Symbol).unwrap()
    }

    pub fn decimals(env: Env) -> u32 {
        env.storage().instance().get(&DataKey::Decimals).unwrap()
    }

    pub fn total_supply(env: Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::TotalSupply)
            .unwrap_or(0)
    }

    pub fn balance(env: Env, id: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::Balance(id))
            .unwrap_or(0)
    }

    pub fn allowance(env: Env, from: Address, spender: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::Allowance(from, spender))
            .unwrap_or(0)
    }

    pub fn mint(env: Env, to: Address, amount: i128) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        let total = Self::total_supply(env.clone());
        env.storage()
            .instance()
            .set(&DataKey::TotalSupply, &(total + amount));

        let bal = Self::balance(env.clone(), to.clone());
        env.storage()
            .persistent()
            .set(&DataKey::Balance(to), &(bal + amount));
    }

    pub fn burn(env: Env, from: Address, amount: i128) {
        from.require_auth();

        let total = Self::total_supply(env.clone());
        env.storage()
            .instance()
            .set(&DataKey::TotalSupply, &(total - amount));

        let bal = Self::balance(env.clone(), from.clone());
        env.storage()
            .persistent()
            .set(&DataKey::Balance(from), &(bal - amount));
    }

    pub fn transfer(env: Env, from: Address, to: Address, amount: i128) {
        from.require_auth();

        if amount <= 0 {
            panic!("InvalidAmount");
        }

        let from_bal = Self::balance(env.clone(), from.clone());
        if from_bal < amount {
            panic!("InsufficientBalance");
        }

        // Self-transfers are a no-op: the balance is unchanged.
        if from == to {
            return;
        }

        env.storage()
            .persistent()
            .set(&DataKey::Balance(from), &(from_bal - amount));

        let to_bal = Self::balance(env.clone(), to.clone());
        env.storage()
            .persistent()
            .set(&DataKey::Balance(to), &(to_bal + amount));
    }

    pub fn approve(env: Env, from: Address, spender: Address, amount: i128) {
        from.require_auth();

        if amount < 0 {
            panic!("InvalidAmount");
        }

        // An approval of 0 clears the allowance.
        if amount == 0 {
            env.storage()
                .persistent()
                .remove(&DataKey::Allowance(from, spender));
            return;
        }

        env.storage()
            .persistent()
            .set(&DataKey::Allowance(from, spender), &amount);
    }

    pub fn transfer_from(env: Env, spender: Address, from: Address, to: Address, amount: i128) {
        spender.require_auth();

        if amount <= 0 {
            panic!("InvalidAmount");
        }

        let allowed = Self::allowance(env.clone(), from.clone(), spender.clone());
        if allowed < amount {
            panic!("InsufficientAllowance");
        }

        let from_bal = Self::balance(env.clone(), from.clone());
        if from_bal < amount {
            panic!("InsufficientBalance");
        }

        // Decrement the allowance in the same call.
        env.storage().persistent().set(
            &DataKey::Allowance(from.clone(), spender),
            &(allowed - amount),
        );

        // Self-transfers are a no-op: the balance is unchanged.
        if from == to {
            return;
        }

        env.storage()
            .persistent()
            .set(&DataKey::Balance(from), &(from_bal - amount));

        let to_bal = Self::balance(env.clone(), to.clone());
        env.storage()
            .persistent()
            .set(&DataKey::Balance(to), &(to_bal + amount));
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env, String};

    fn setup() -> (Env, MyFansTokenClient<'static>, Address) {
        let env = Env::default();
        let contract_id = env.register_contract(None, MyFansToken);
        let client = MyFansTokenClient::new(&env, &contract_id);
        let admin = Address::generate(&env);
        (env, client, admin)
    }

    fn setup_initialized() -> (Env, MyFansTokenClient<'static>, Address) {
        let (env, client, admin) = setup();
        env.mock_all_auths();
        let name = String::from_str(&env, "MyFans");
        let symbol = String::from_str(&env, "MF");
        client.initialize(&admin, &name, &symbol, &7);
        (env, client, admin)
    }

    #[test]
    fn initialize_requires_admin_auth() {
        let (env, client, admin) = setup();
        let name = String::from_str(&env, "MyFans");
        let symbol = String::from_str(&env, "MF");

        // No mocked auth: initialize must fail and leave admin unset.
        let result = client.try_initialize(&admin, &name, &symbol, &7);
        assert!(result.is_err());
        assert!(!env.storage().instance().has(&DataKey::Admin));

        // A later authorized initialize still succeeds.
        env.mock_all_auths();
        client.initialize(&admin, &name, &symbol, &7);
        assert_eq!(client.admin(), admin);
        assert_eq!(client.total_supply(), 0);
    }

    #[test]
    fn second_initialize_returns_already_initialized() {
        let (env, client, admin) = setup();
        env.mock_all_auths();
        let name = String::from_str(&env, "MyFans");
        let symbol = String::from_str(&env, "MF");

        client.initialize(&admin, &name, &symbol, &7);

        let result = client.try_initialize(&admin, &name, &symbol, &7);
        assert!(result.is_err());
    }

    #[test]
    fn transfer_from_happy_path_decrements_allowance() {
        let (env, client, admin) = setup_initialized();
        let from = Address::generate(&env);
        let spender = Address::generate(&env);
        let to = Address::generate(&env);

        client.mint(&from, &100);
        client.approve(&from, &spender, &60);

        client.transfer_from(&spender, &from, &to, &40);

        assert_eq!(client.balance(&from), 60);
        assert_eq!(client.balance(&to), 40);
        assert_eq!(client.allowance(&from, &spender), 20);
        let _ = admin;
    }

    #[test]
    fn transfer_from_rejects_expired_allowance() {
        let (env, client, _admin) = setup_initialized();
        let from = Address::generate(&env);
        let spender = Address::generate(&env);
        let to = Address::generate(&env);

        client.mint(&from, &100);
        client.approve(&from, &spender, &50);

        // Advance the ledger past the allowance expiration.
        env.ledger().set_sequence_number(env.ledger().sequence() + 1_000_000);

        let result = client.try_transfer_from(&spender, &from, &to, &10);
        assert!(result.is_err());
        assert_eq!(client.balance(&from), 100);
        assert_eq!(client.balance(&to), 0);
    }

    #[test]
    fn transfer_from_rejects_insufficient_allowance() {
        let (env, client, _admin) = setup_initialized();
        let from = Address::generate(&env);
        let spender = Address::generate(&env);
        let to = Address::generate(&env);

        client.mint(&from, &100);
        client.approve(&from, &spender, &10);

        let result = client.try_transfer_from(&spender, &from, &to, &20);
        assert!(result.is_err());
        assert_eq!(client.balance(&from), 100);
        assert_eq!(client.balance(&to), 0);
        assert_eq!(client.allowance(&from, &spender), 10);
    }

    #[test]
    fn transfer_from_rejects_missing_allowance() {
        let (env, client, _admin) = setup_initialized();
        let from = Address::generate(&env);
        let spender = Address::generate(&env);
        let to = Address::generate(&env);

        client.mint(&from, &100);

        let result = client.try_transfer_from(&spender, &from, &to, &10);
        assert!(result.is_err());
        assert_eq!(client.balance(&from), 100);
        assert_eq!(client.balance(&to), 0);
    }
}
