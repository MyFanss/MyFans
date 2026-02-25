//! Treasury contract for holding platform funds

use soroban_sdk::{contract, contractimpl, token, Address, Env};

const ADMIN: &str = "ADMIN";
const TOKEN: &str = "TOKEN";

#[contract]
pub struct Treasury;

#[contractimpl]
impl Treasury {
    pub fn initialize(env: Env, admin: Address, token_address: Address) {
        admin.require_auth();
        env.storage().instance().set(&ADMIN, &admin);
        env.storage().instance().set(&TOKEN, &token_address);
    }

    pub fn deposit(env: Env, from: Address, amount: i128) {
        from.require_auth();
        let token_address: Address = env.storage().instance().get(&TOKEN).unwrap();
        let contract_address = env.current_contract_address();
        token::Client::new(&env, &token_address).transfer(&from, &contract_address, &amount);
    }

    pub fn withdraw(env: Env, to: Address, amount: i128) {
        let admin: Address = env.storage().instance().get(&ADMIN).unwrap();
        admin.require_auth();

        let token_address: Address = env.storage().instance().get(&TOKEN).unwrap();
        let token_client = token::Client::new(&env, &token_address);
        let contract_address = env.current_contract_address();
        let balance = token_client.balance(&contract_address);

        if balance < amount {
            panic!("insufficient balance");
        }

        token_client.transfer(&contract_address, &to, &amount);
    }
}
