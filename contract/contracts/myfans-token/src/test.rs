use super::*;
use soroban_sdk::testutils::{Address as _, Ledger};
use soroban_sdk::{Address, Env};

#[test]
fn test_transfer() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, MyFansToken);
    let client = MyFansTokenClient::new(&env, &contract_id);

    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);

    client.mint(&user1, &1000);
    assert_eq!(client.balance(&user1), 1000);

    client.transfer(&user1, &user2, &600);
    assert_eq!(client.balance(&user1), 400);
    assert_eq!(client.balance(&user2), 600);
}

#[test]
#[should_panic(expected = "Error(Contract, #1)")]
fn test_transfer_insufficient_balance() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, MyFansToken);
    let client = MyFansTokenClient::new(&env, &contract_id);

    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);

    client.mint(&user1, &100);
    client.transfer(&user1, &user2, &101);
}

#[test]
fn test_approve_and_transfer_from() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, MyFansToken);
    let client = MyFansTokenClient::new(&env, &contract_id);

    let owner = Address::generate(&env);
    let spender = Address::generate(&env);
    let receiver = Address::generate(&env);

    client.mint(&owner, &1000);
    
    // Approve 500 tokens with expiration at ledger 100
    client.approve(&owner, &spender, &500, &100);
    assert_eq!(client.allowance(&owner, &spender), 500);

    // Transfer 200 tokens
    client.transfer_from(&spender, &owner, &receiver, &200);
    assert_eq!(client.balance(&owner), 800);
    assert_eq!(client.balance(&receiver), 200);
    assert_eq!(client.allowance(&owner, &spender), 300);
}

#[test]
#[should_panic(expected = "Error(Contract, #2)")]
fn test_transfer_from_insufficient_allowance() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, MyFansToken);
    let client = MyFansTokenClient::new(&env, &contract_id);

    let owner = Address::generate(&env);
    let spender = Address::generate(&env);
    let receiver = Address::generate(&env);

    client.mint(&owner, &1000);
    client.approve(&owner, &spender, &100, &100);
    client.transfer_from(&spender, &owner, &receiver, &101);
}

#[test]
#[should_panic(expected = "Error(Contract, #3)")]
fn test_transfer_from_expired_allowance() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, MyFansToken);
    let client = MyFansTokenClient::new(&env, &contract_id);

    let owner = Address::generate(&env);
    let spender = Address::generate(&env);
    let receiver = Address::generate(&env);

    client.mint(&owner, &1000);
    
    // Set ledger sequence to 10
    env.ledger().with_mut(|li| li.sequence_number = 10);
    
    // Approve 500 tokens with expiration at ledger 20
    client.approve(&owner, &spender, &500, &20);
    
    // Advance ledger sequence to 21
    env.ledger().with_mut(|li| li.sequence_number = 21);
    
    client.transfer_from(&spender, &owner, &receiver, &100);
}

#[test]
fn test_allowance_view_expired() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, MyFansToken);
    let client = MyFansTokenClient::new(&env, &contract_id);

    let owner = Address::generate(&env);
    let spender = Address::generate(&env);

    env.ledger().with_mut(|li| li.sequence_number = 10);
    client.approve(&owner, &spender, &500, &20);
    
    assert_eq!(client.allowance(&owner, &spender), 500);
    
    env.ledger().with_mut(|li| li.sequence_number = 21);
    assert_eq!(client.allowance(&owner, &spender), 0);
}
