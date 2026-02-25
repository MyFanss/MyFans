#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Events},
    xdr::SorobanAuthorizationEntry,
    Address, Env, Symbol, TryIntoVal,
};
use soroban_sdk::token::{Client as TokenClient, StellarAssetClient};

fn setup<'a>(
    env: &'a Env,
) -> (
    Address,                     // admin
    Address,                     // creator
    Address,                     // depositor
    CreatorEarningsClient<'a>,
    TokenClient<'a>,
    StellarAssetClient<'a>,
) {
    env.mock_all_auths();

    let admin = Address::generate(env);
    let creator = Address::generate(env);
    let depositor = Address::generate(env);

    // Deploy Stellar Asset
    let token_admin = Address::generate(env);
    #[allow(deprecated)]
    let token_id = env.register_stellar_asset_contract(token_admin.clone());

    let token_client = TokenClient::new(env, &token_id);
    let token_admin_client = StellarAssetClient::new(env, &token_id);

    // Mint initial balance to depositor
    token_admin_client.mint(&depositor, &1_000);

    // Deploy earnings contract
    let contract_id = env.register_contract(None, CreatorEarnings);
    let client = CreatorEarningsClient::new(env, &contract_id);

    client.initialize(&admin, &token_id);
    client.add_authorized(&depositor);

    (
        admin,
        creator,
        depositor,
        client,
        token_client,
        token_admin_client,
    )
}

#[test]
fn deposit_increases_balance() {
    let env = Env::default();

    let (_admin, creator, depositor, client, token_client, _) =
        setup(&env);

    client.deposit(&depositor, &creator, &500);

    assert_eq!(client.balance(&creator), 500);

    // Contract custody verification
    let contract_balance =
        token_client.balance(&client.address);
    assert_eq!(contract_balance, 500);
}

#[test]
fn withdraw_reduces_balance_and_transfers_tokens() {
    let env = Env::default();

    let (_admin, creator, depositor, client, token_client, _) =
        setup(&env);

    client.deposit(&depositor, &creator, &500);

    client.withdraw(&creator, &200);

    assert_eq!(client.balance(&creator), 300);

    // Creator should receive withdrawn tokens
    assert_eq!(token_client.balance(&creator), 200);
}

#[test]
#[should_panic(expected = "insufficient balance")]
fn withdraw_insufficient_balance_reverts() {
    let env = Env::default();

    let (_admin, creator, _depositor, client, _, _) =
        setup(&env);

    client.withdraw(&creator, &100);
}

#[test]
#[should_panic(expected = "not authorized")]
fn unauthorized_deposit_reverts() {
    let env = Env::default();

    let (_admin, creator, _depositor, client, _, token_admin_client) =
        setup(&env);

    let unauthorized = Address::generate(&env);

    // Mint tokens to unauthorized user
    token_admin_client.mint(&unauthorized, &500);

    // Unauthorized address not added via add_authorized
    client.deposit(&unauthorized, &creator, &100);
}

/// Only the creator (or admin) can withdraw. Non-creator cannot withdraw; balance (stake) unchanged.
/// Setup: init and set creator balance via storage + mint to contract; do not mock auth for withdraw (set_auths(empty)).
/// Reference: treasury test_unauthorized_withdraw_reverts.
#[test]
fn test_unauthorized_withdraw_reverts() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let creator = Address::generate(&env);
    let non_creator = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let token_id = env.register_stellar_asset_contract_v2(token_admin.clone()).address();
    let token_client = TokenClient::new(&env, &token_id);
    let token_admin_client = StellarAssetClient::new(&env, &token_id);

    let contract_id = env.register_contract(None, CreatorEarnings);
    let client = CreatorEarningsClient::new(&env, &contract_id);

    client.initialize(&admin, &token_id);
    token_admin_client.mint(&contract_id, &500);

    env.as_contract(&contract_id, || {
        env.storage()
            .instance()
            .set(&DataKey::Balance(creator.clone()), &500_i128);
    });

    assert_eq!(client.balance(&creator), 500);
    assert_eq!(token_client.balance(&client.address), 500);

    // Do not mock auth for withdraw: only creator may withdraw
    let empty: &[SorobanAuthorizationEntry] = &[];
    env.set_auths(empty);

    let result = client.try_withdraw(&non_creator, &100);
    assert!(result.is_err());

    // Stake unchanged
    assert_eq!(client.balance(&creator), 500);
    assert_eq!(token_client.balance(&client.address), 500);
}

#[test]
fn withdraw_emits_event() {
    let env = Env::default();

    let (_admin, creator, depositor, client, _token_client, _) = setup(&env);

    // Get the token address from storage
    let token_address: Address = env.as_contract(&client.address, || {
        env.storage()
            .instance()
            .get(&DataKey::Token)
            .expect("token not set")
    });

    client.deposit(&depositor, &creator, &500);
    client.withdraw(&creator, &200);

    // events().all() returns Vec<(contract_addr, topics: Vec<Val>, data: Val)>
    let events = env.events().all();
    let withdraw_event = events.iter().find(|e| {
        // e.1 = topics, e.2 = data
        e.1.first().map_or(false, |t| {
            t.try_into_val(&env).ok() == Some(Symbol::new(&env, "withdraw"))
        })
    });

    assert!(withdraw_event.is_some(), "withdraw event not emitted");

    let event = withdraw_event.unwrap();

    // Assert topics: single symbol "withdraw"
    assert_eq!(event.1.len(), 1);
    let topic_symbol: Symbol = event.1.first().unwrap().try_into_val(&env).unwrap();
    assert_eq!(topic_symbol, Symbol::new(&env, "withdraw"));

    // Assert data: (creator, amount, token)
    let (event_creator, event_amount, event_token): (Address, i128, Address) =
        event.2.try_into_val(&env).unwrap();
    assert_eq!(event_creator, creator);
    assert_eq!(event_amount, 200);
    assert_eq!(event_token, token_address);
}