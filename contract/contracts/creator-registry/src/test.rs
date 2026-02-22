#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env};

#[test]
fn test_initialize() {
    let env = Env::default();
    let contract_id = env.register_contract(None, CreatorRegistryContract);
    let client = CreatorRegistryContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);

    client.initialize(&admin);

    // Should panic if initialized again
    // In soroban tests, panics can be caught using `try_initialize` but standard interface is fine.
}

#[test]
fn test_register_and_lookup_self() {
    let env = Env::default();
    env.mock_all_auths();
    
    let contract_id = env.register_contract(None, CreatorRegistryContract);
    let client = CreatorRegistryContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let creator = Address::generate(&env);

    client.initialize(&admin);
    
    // Register by creator themselves (caller = creator, address = creator)
    client.register_creator(&creator, &creator, &12345);

    let fetched_id = client.get_creator_id(&creator);
    assert_eq!(fetched_id, Some(12345));
}

#[test]
fn test_register_and_lookup_admin() {
    let env = Env::default();
    env.mock_all_auths();
    
    let contract_id = env.register_contract(None, CreatorRegistryContract);
    let client = CreatorRegistryContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let creator = Address::generate(&env);

    client.initialize(&admin);
    
    // Register by admin (caller = admin, address = creator)
    client.register_creator(&admin, &creator, &54321);

    let fetched_id = client.get_creator_id(&creator);
    assert_eq!(fetched_id, Some(54321));
}

#[test]
#[should_panic(expected = "unauthorized: must be admin or the creator")]
fn test_unauthorized_registration() {
    let env = Env::default();
    env.mock_all_auths();
    
    let contract_id = env.register_contract(None, CreatorRegistryContract);
    let client = CreatorRegistryContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let creator = Address::generate(&env);
    let rando = Address::generate(&env);

    client.initialize(&admin);
    
    // Rando tries to register creator
    client.register_creator(&rando, &creator, &999);
}

#[test]
#[should_panic(expected = "already registered")]
fn test_duplicate_registration_reverts() {
    let env = Env::default();
    env.mock_all_auths();
    
    let contract_id = env.register_contract(None, CreatorRegistryContract);
    let client = CreatorRegistryContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let creator = Address::generate(&env);

    client.initialize(&admin);
    
    client.register_creator(&creator, &creator, &111);
    // Should panic here
    client.register_creator(&creator, &creator, &222);
}
