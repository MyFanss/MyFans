#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token, xdr::ScAddress, Address, Env, TryFromVal,
};

fn setup_test() -> (
    Env,
    MyfansContractClient<'static>,
    Address,
    token::Client<'static>,
    token::StellarAssetClient<'static>,
) {
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
    client.init(&admin, &500, &fee_recipient, &token.address, &1000);

    let creator = Address::generate(&env);
    let fan = Address::generate(&env);

    // Mint tokens to fan
    token_admin.mint(&fan, &10000);

    // Create a plan: 1000 tokens for 30 days
    let plan_id = client.create_plan(&creator, &token.address, &1000, &30);
    assert_eq!(plan_id, 1);

    // Subscribe calls token transfer, so it will deduct from fan
    client.subscribe(&fan, &plan_id, &token.address);

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
    client.init(&admin, &500, &fee_recipient, &token.address, &1000);

    let creator = Address::generate(&env);
    let fan = Address::generate(&env);

    // Fan only has 500, but plan costs 1000
    token_admin.mint(&fan, &500);

    let plan_id = client.create_plan(&creator, &token.address, &1000, &30);

    // This should panic due to token transfer failure automatically mapped inside Soroban
    client.subscribe(&fan, &plan_id, &token.address);
}

#[test]
fn test_platform_fee_zero() {
    let (env, client, admin, token, token_admin) = setup_test();

    let fee_recipient = Address::generate(&env);

    // fee_bps = 0
    client.init(&admin, &0, &fee_recipient, &token.address, &1000);

    let creator = Address::generate(&env);
    let fan = Address::generate(&env);

    token_admin.mint(&fan, &10000);

    let plan_id = client.create_plan(&creator, &token.address, &1000, &30);
    client.subscribe(&fan, &plan_id, &token.address);

    // Fee is 0%. Creator gets all 1000.
    assert_eq!(token.balance(&fee_recipient), 0);
    assert_eq!(token.balance(&creator), 1000);
}

#[test]
fn test_cancel_subscription() {
    let (env, client, admin, token, token_admin) = setup_test();
    let fee_recipient = Address::generate(&env);
    client.init(&admin, &500, &fee_recipient, &token.address, &1000);

    let creator = Address::generate(&env);
    let fan = Address::generate(&env);

    token_admin.mint(&fan, &10000);
    let plan_id = client.create_plan(&creator, &token.address, &1000, &30);
    client.subscribe(&fan, &plan_id, &token.address);

    
    assert!(client.is_subscriber(&fan, &creator));

    client.cancel(&fan, &creator);
    assert!(!client.is_subscriber(&fan, &creator));
}

#[test]
fn test_create_subscription_payment_flow() {
    let (env, client, admin, token, token_admin) = setup_test();
    let fee_recipient = Address::generate(&env);
    client.init(&admin, &500, &fee_recipient, &token.address, &1000);
    let creator = Address::generate(&env);
    let fan = Address::generate(&env);
    token_admin.mint(&fan, &10000);
    env.ledger().with_mut(|li| {
        li.sequence_number = 1000;
    });
    client.create_subscription(&fan, &creator, &518400);
    assert_eq!(token.balance(&fan), 9000);
    assert_eq!(token.balance(&fee_recipient), 50);
    assert_eq!(token.balance(&creator), 950);
}

#[test]
fn test_is_subscribed_false_after_expiry() {
    let (env, client, admin, token, token_admin) = setup_test();
    let fee_recipient = Address::generate(&env);
    client.init(&admin, &0, &fee_recipient, &token.address, &1000);
    let creator = Address::generate(&env);
    let fan = Address::generate(&env);
    token_admin.mint(&fan, &10000);
    env.ledger().with_mut(|li| {
        li.sequence_number = 1000;
    });
    client.create_subscription(&fan, &creator, &518400);
    assert!(client.is_subscriber(&fan, &creator));
    env.ledger().with_mut(|li| {
        li.sequence_number += 17281;
    });
    assert!(!client.is_subscriber(&fan, &creator));
}

#[test]
#[should_panic]
fn test_create_subscription_insufficient_balance() {
    let (env, client, admin, token, token_admin) = setup_test();
    let fee_recipient = Address::generate(&env);
    let creator = Address::generate(&env);
    let fan = Address::generate(&env);
    client.init(&admin, &500, &fee_recipient, &token.address, &1000);
    token_admin.mint(&fan, &500);
    let plan_id = client.create_plan(&creator, &token.address, &1000, &1);
    client.subscribe(&fan, &plan_id, &token.address);
}

#[test]
fn test_extend_updates_expiry() {
    let (env, client, admin, token, token_admin) = setup_test();
    let fee_recipient = Address::generate(&env);
    client.init(&admin, &0, &fee_recipient, &token.address, &1000);
    let creator = Address::generate(&env);
    let fan = Address::generate(&env);
    token_admin.mint(&fan, &500);
    env.ledger().with_mut(|li| {
        li.sequence_number = 1000;
    });
    client.create_subscription(&fan, &creator, &518400);
}

#[test]
fn test_create_subscription_no_fee() {
    let (env, client, admin, token, token_admin) = setup_test();
    let fee_recipient = Address::generate(&env);
    let creator = Address::generate(&env);
    let fan = Address::generate(&env);
    client.init(&admin, &0, &fee_recipient, &token.address, &1000);
    token_admin.mint(&fan, &20000);
    let plan_id = client.create_plan(&creator, &token.address, &1000, &1);
    client.subscribe(&fan, &plan_id, &token.address);

    let initial_ledger = env.ledger().sequence();
    let expected_expiry = initial_ledger + 17280;

    env.ledger().with_mut(|li| {
        li.sequence_number += 10000;
    });

    assert!(client.is_subscriber(&fan, &creator));

    client.extend_subscription(&fan, &creator, &17280, &token.address);

    env.ledger().with_mut(|li| {
        li.sequence_number = expected_expiry + 1;
    });

    assert!(client.is_subscriber(&fan, &creator));
}

#[test]
fn test_extend_requires_payment() {
    let (env, client, admin, token, token_admin) = setup_test();
    let fee_recipient = Address::generate(&env);
    let creator = Address::generate(&env);
    let fan = Address::generate(&env);
    client.init(&admin, &0, &fee_recipient, &token.address, &1000);
    token_admin.mint(&fan, &20000);
    let plan_id = client.create_plan(&creator, &token.address, &1000, &1);
    client.subscribe(&fan, &plan_id, &token.address);

    assert_eq!(token.balance(&creator), 1000);

    client.extend_subscription(&fan, &creator, &17280, &token.address);

    assert_eq!(token.balance(&creator), 2000);
    assert_eq!(token.balance(&fan), 18000);
}

#[test]
#[should_panic(expected = "subscription expired")]
fn test_extend_fails_if_expired() {
    let (env, client, admin, token, token_admin) = setup_test();
    let fee_recipient = Address::generate(&env);
    let creator = Address::generate(&env);
    let fan = Address::generate(&env);
    client.init(&admin, &0, &fee_recipient, &token.address, &1000);
    token_admin.mint(&fan, &20000);
    let plan_id = client.create_plan(&creator, &token.address, &1000, &1);
    client.subscribe(&fan, &plan_id, &token.address);
    env.ledger().with_mut(|li| {
        li.sequence_number += 17281;
    });
    client.extend_subscription(&fan, &creator, &17280, &token.address);
}

/// Verify subscription state consistency across snapshot restore.
/// Saves state after subscribe with env.to_snapshot(), restores with Env::from_snapshot(), then asserts plan, expiry, and fan (subscription data).
#[test]
fn test_subscription_state_after_snapshot_restore() {
    let (env, client, admin, token, token_admin) = setup_test();
    let fee_recipient = Address::generate(&env);
    client.init(&admin, &500, &fee_recipient, &token.address, &1000);

    let creator = Address::generate(&env);
    let fan = Address::generate(&env);
    token_admin.mint(&fan, &10000);

    let plan_id = client.create_plan(&creator, &token.address, &1000, &30);
    assert_eq!(plan_id, 1);
    client.subscribe(&fan, &plan_id, &token.address);

    let contract_id = client.address.clone();
    let expected_expiry = env.ledger().sequence() + (30 * 17280);
    let sc_fan: ScAddress = fan.clone().try_into().unwrap();
    let sc_creator: ScAddress = creator.clone().try_into().unwrap();
    let sc_contract: ScAddress = contract_id.clone().try_into().unwrap();

    let snapshot = env.to_snapshot();
    let env2 = Env::from_snapshot(snapshot);
    env2.mock_all_auths();

    let contract_id2: Address = Address::try_from_val(&env2, &sc_contract).unwrap();
    let fan2: Address = Address::try_from_val(&env2, &sc_fan).unwrap();
    let creator2: Address = Address::try_from_val(&env2, &sc_creator).unwrap();

    env2.register_contract(Some(&contract_id2), MyfansContract);
    let client2 = MyfansContractClient::new(&env2, &contract_id2);

    assert!(
        client2.is_subscriber(&fan2, &creator2),
        "state after restore: fan should be subscriber"
    );

    let sub = env2.as_contract(&contract_id2, || {
        env2.storage()
            .instance()
            .get::<DataKey, Subscription>(&DataKey::Sub(fan2.clone(), creator2.clone()))
            .unwrap()
    });
    assert_eq!(sub.fan, fan2);
    assert_eq!(sub.plan_id, plan_id);
    assert_eq!(sub.expiry, expected_expiry as u64);

    let plan = env2.as_contract(&contract_id2, || {
        env2.storage()
            .instance()
            .get::<DataKey, Plan>(&DataKey::Plan(plan_id))
            .unwrap()
    });
    assert_eq!(plan.creator, creator2);
    assert_eq!(plan.amount, 1000);
    assert_eq!(plan.interval_days, 30);

    let plan_count: u32 = env2.as_contract(&contract_id2, || {
        env2.storage()
            .instance()
            .get::<DataKey, u32>(&DataKey::PlanCount)
            .unwrap_or(0)
    });
    assert_eq!(plan_count, 1, "plan count matches after restore");
}

/// Cancel after snapshot restore and assert subscription state is cleared.
#[test]
fn test_cancel_after_snapshot_restore() {
    let (env, client, admin, token, token_admin) = setup_test();
    let fee_recipient = Address::generate(&env);
    client.init(&admin, &500, &fee_recipient, &token.address, &1000);

    let creator = Address::generate(&env);
    let fan = Address::generate(&env);
    token_admin.mint(&fan, &10000);

    let plan_id = client.create_plan(&creator, &token.address, &1000, &30);
    client.subscribe(&fan, &plan_id, &token.address);
    assert!(client.is_subscriber(&fan, &creator));

    let contract_id = client.address.clone();
    let sc_fan: ScAddress = fan.clone().try_into().unwrap();
    let sc_creator: ScAddress = creator.clone().try_into().unwrap();
    let sc_contract: ScAddress = contract_id.clone().try_into().unwrap();

    let snapshot = env.to_snapshot();
    let env2 = Env::from_snapshot(snapshot);
    env2.mock_all_auths();

    let contract_id2: Address = Address::try_from_val(&env2, &sc_contract).unwrap();
    let fan2: Address = Address::try_from_val(&env2, &sc_fan).unwrap();
    let creator2: Address = Address::try_from_val(&env2, &sc_creator).unwrap();

    env2.register_contract(Some(&contract_id2), MyfansContract);
    let client2 = MyfansContractClient::new(&env2, &contract_id2);
    assert!(client2.is_subscriber(&fan2, &creator2), "state matches after restore");

    client2.cancel(&fan2, &creator2);
    assert!(
        !client2.is_subscriber(&fan2, &creator2),
        "cancel after restore: subscription should be removed"
    );
}
