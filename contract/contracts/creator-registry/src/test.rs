#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, testutils::Ledger, Address, Env, Error as SorobanError};

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
fn test_admin_getter_returns_initialized_admin() {
    let env = Env::default();
    let contract_id = env.register_contract(None, CreatorRegistryContract);
    let client = CreatorRegistryContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);

    client.initialize(&admin);

    let fetched_admin = client.admin();
    assert_eq!(fetched_admin, admin);
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
    let result = client.try_register_creator(&rando, &creator, &999);
    assert_eq!(
        result,
        Err(Ok(SorobanError::from_contract_error(
            Error::Unauthorized as u32,
        )))
    );
}

#[test]
fn test_duplicate_registration_reverts() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, CreatorRegistryContract);
    let client = CreatorRegistryContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let creator = Address::generate(&env);

    client.initialize(&admin);

    env.ledger().with_mut(|li| li.sequence_number = 1000);
    client.register_creator(&creator, &creator, &111);
    // Advance past rate limit window so second attempt hits "already registered"
    env.ledger().with_mut(|li| li.sequence_number = 1015);
    let result = client.try_register_creator(&creator, &creator, &222);
    assert_eq!(
        result,
        Err(Ok(SorobanError::from_contract_error(
            Error::AlreadyRegistered as u32,
        )))
    );
}

#[test]
fn test_rate_limit_same_caller_within_window_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, CreatorRegistryContract);
    let client = CreatorRegistryContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let creator1 = Address::generate(&env);
    let creator2 = Address::generate(&env);

    client.initialize(&admin);

    env.ledger().with_mut(|li| li.sequence_number = 100);
    client.register_creator(&admin, &creator1, &111);
    // Same caller (admin), different creator, but within rate limit window -> must fail
    let result = client.try_register_creator(&admin, &creator2, &222);
    assert_eq!(
        result,
        Err(Ok(SorobanError::from_contract_error(
            Error::RateLimited as u32,
        )))
    );
}

#[test]
fn test_rate_limit_after_window_succeeds() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, CreatorRegistryContract);
    let client = CreatorRegistryContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let creator1 = Address::generate(&env);
    let creator2 = Address::generate(&env);

    client.initialize(&admin);

    env.ledger().with_mut(|li| li.sequence_number = 100);
    client.register_creator(&admin, &creator1, &111);
    assert_eq!(client.get_creator_id(&creator1), Some(111));

    // Advance past rate limit window (10 ledgers)
    env.ledger().with_mut(|li| li.sequence_number = 111);
    client.register_creator(&admin, &creator2, &222);
    assert_eq!(client.get_creator_id(&creator1), Some(111));
    assert_eq!(client.get_creator_id(&creator2), Some(222));
}

#[test]
fn test_registration_ledger_key_helper_keeps_legacy_variant() {
    let env = Env::default();
    let caller = Address::generate(&env);

    assert_eq!(
        DataKey::registration_ledger(caller.clone()),
        DataKey::LastRegLedger(caller)
    );
}

#[test]
fn test_update_creator_id_authorized() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, CreatorRegistryContract);
    let client = CreatorRegistryContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let creator = Address::generate(&env);

    client.initialize(&admin);
    client.register_creator(&creator, &creator, &111);

    client.update_creator_id(&creator, &creator, &222);

    assert_eq!(client.get_creator_id(&creator), Some(222));

    let events = env.events().all();
    let found = events.iter().any(|event| {
        let topic: soroban_sdk::Symbol = event.1.get(0).unwrap().try_into_val(&env).unwrap();
        topic == soroban_sdk::Symbol::new(&env, "creator_updated")
    });
    assert!(found, "creator_updated event not emitted");
}

#[test]
fn test_update_creator_id_unauthorized_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, CreatorRegistryContract);
    let client = CreatorRegistryContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let creator = Address::generate(&env);
    let rando = Address::generate(&env);

    client.initialize(&admin);
    client.register_creator(&creator, &creator, &111);

    let result = client.try_update_creator_id(&rando, &creator, &222);
    assert_eq!(
        result,
        Err(Ok(SorobanError::from_contract_error(
            Error::Unauthorized as u32,
        )))
    );
}

#[test]
fn test_update_creator_id_not_registered_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, CreatorRegistryContract);
    let client = CreatorRegistryContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let creator = Address::generate(&env);

    client.initialize(&admin);

    let result = client.try_update_creator_id(&admin, &creator, &222);
    assert_eq!(
        result,
        Err(Ok(SorobanError::from_contract_error(
            Error::NotRegistered as u32,
        )))
    );
}
