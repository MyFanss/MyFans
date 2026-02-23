#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::Address as _,
    Address, Env,
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