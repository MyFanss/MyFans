#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token, Address, Env,
};

fn setup_test() -> (Env, MyfansContractClient<'static>, Address, token::Client<'static>, token::StellarAssetClient<'static>) {
    let env = Env::default();
    env.mock_all_auths();

    // Create a mock token
    let admin = Address::generate(&env);
    let token_address = env.register_stellar_asset_contract_v2(admin.clone());
    let token_client = token::Client::new(&env, &token_address.address());
    let token_admin_client = token::StellarAssetClient::new(&env, &token_address.address());

    // Register contract
    let contract_id = env.register_contract(None, MyfansContract);
    let client = MyfansContractClient::new(&env, &contract_id);

    (env, client, admin, token_client, token_admin_client)
}

#[test]
fn test_subscribe_full_flow() {
    let (env, client, admin, token, token_admin) = setup_test();

    let fee_recipient = Address::generate(&env);
    
    // fee_bps = 500 (5%)
    client.init(&admin, &500, &fee_recipient);

    let creator = Address::generate(&env);
    let fan = Address::generate(&env);

    // Mint tokens to fan
    token_admin.mint(&fan, &10000);

    // Create a plan: 1000 tokens for 30 days
    let plan_id = client.create_plan(&creator, &token.address, &1000, &30);
    assert_eq!(plan_id, 1);

    // Subscribe calls token transfer, so it will deduct from fan
    client.subscribe(&fan, &plan_id);

    // Check balances
    // Fan paid 1000, should have 9000
    assert_eq!(token.balance(&fan), 9000);

    // Fee is 5% of 1000 = 50. Creator gets 950.
    assert_eq!(token.balance(&fee_recipient), 50);
    assert_eq!(token.balance(&creator), 950);

    // Verify subscription status
    assert!(client.is_subscriber(&fan, &creator));
}

#[test]
#[should_panic]
fn test_subscribe_insufficient_balance_reverts() {
    let (env, client, admin, token, token_admin) = setup_test();

    let fee_recipient = Address::generate(&env);
    client.init(&admin, &500, &fee_recipient);

    let creator = Address::generate(&env);
    let fan = Address::generate(&env);

    // Fan only has 500, but plan costs 1000
    token_admin.mint(&fan, &500);

    let plan_id = client.create_plan(&creator, &token.address, &1000, &30);

    // This should panic due to token transfer failure automatically mapped inside Soroban
    client.subscribe(&fan, &plan_id);
}

#[test]
fn test_platform_fee_zero() {
    let (env, client, admin, token, token_admin) = setup_test();

    let fee_recipient = Address::generate(&env);
    
    // fee_bps = 0
    client.init(&admin, &0, &fee_recipient);

    let creator = Address::generate(&env);
    let fan = Address::generate(&env);

    token_admin.mint(&fan, &10000);

    let plan_id = client.create_plan(&creator, &token.address, &1000, &30);
    client.subscribe(&fan, &plan_id);

    // Fee is 0%. Creator gets all 1000.
    assert_eq!(token.balance(&fee_recipient), 0);
    assert_eq!(token.balance(&creator), 1000);
}

#[test]
fn test_cancel_subscription() {
    let (env, client, admin, token, token_admin) = setup_test();
    let fee_recipient = Address::generate(&env);
    client.init(&admin, &500, &fee_recipient);

    let creator = Address::generate(&env);
    let fan = Address::generate(&env);

    token_admin.mint(&fan, &10000);
    let plan_id = client.create_plan(&creator, &token.address, &1000, &30);
    client.subscribe(&fan, &plan_id);
    
    assert!(client.is_subscriber(&fan, &creator));

    client.cancel(&fan, &creator);
    assert!(!client.is_subscriber(&fan, &creator));
}
