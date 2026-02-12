//! Soroban contract tests. Run with: cargo test

use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env};

#[test]
fn test_init() {
    let env = Env::default();
    let contract_id = env.register_contract(None, MyfansContract);
    let client = MyfansContractClient::new(&env, &contract_id);
    client.init();
}

#[test]
fn test_is_subscriber_returns_false_by_default() {
    let env = Env::default();
    let contract_id = env.register_contract(None, MyfansContract);
    let client = MyfansContractClient::new(&env, &contract_id);
    client.init();

    let fan = Address::generate(&env);
    let creator = Address::generate(&env);
    let result = client.is_subscriber(&fan, &creator);
    assert!(!result);
}
