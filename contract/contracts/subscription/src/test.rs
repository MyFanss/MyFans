#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env};

#[test]
fn test_init_and_admin() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, MyfansContract);
    let client = MyfansContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let fee_recipient = Address::generate(&env);

    client.init(&admin, &250, &fee_recipient);

    assert_eq!(client.admin(), admin);
}

#[test]
fn test_is_subscriber_false_without_subscription() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, MyfansContract);
    let client = MyfansContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let fee_recipient = Address::generate(&env);
    let fan = Address::generate(&env);
    let creator = Address::generate(&env);

    client.init(&admin, &0, &fee_recipient);

    assert!(!client.is_subscriber(&fan, &creator));
}
