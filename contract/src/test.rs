#![cfg(test)]
use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env};

#[test]
fn test_subscription_flow() {
    let env = Env::default();
    env.mock_all_auths();
    
    let contract_id = env.register_contract(None, MyfansContract);
    let client = MyfansContractClient::new(&env, &contract_id);
    
    let admin = Address::generate(&env);
    let creator = Address::generate(&env);
    let fan = Address::generate(&env);
    let fee_recipient = Address::generate(&env);
    let asset = Address::generate(&env);
    
    client.init(&admin, &250, &fee_recipient);
    let plan_id = client.create_plan(&creator, &asset, &1000, &30);
    assert_eq!(plan_id, 1);
    
    assert!(!client.is_subscriber(&fan, &creator));
}
