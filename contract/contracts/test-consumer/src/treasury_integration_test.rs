//! Integration test: exercises the treasury contract from an external caller,
//! mirroring how any other Soroban contract would interact with it.

use soroban_sdk::{
    testutils::Address as _,
    token::{StellarAssetClient, TokenClient},
    Address, Env,
};
use treasury::TreasuryClient;

fn setup(env: &Env) -> (Address, Address, Address, Address, Address) {
    env.mock_all_auths();
    let admin = Address::generate(env);
    let user = Address::generate(env);
    let recipient = Address::generate(env);
    let token_addr = env
        .register_stellar_asset_contract_v2(admin.clone())
        .address();
    StellarAssetClient::new(env, &token_addr).mint(&user, &10_000);
    let treasury_id = env.register_contract(None, treasury::Treasury);
    TreasuryClient::new(env, &treasury_id).initialize(&admin, &token_addr);
    (admin, user, recipient, token_addr, treasury_id)
}

#[test]
fn integration_deposit_then_withdraw() {
    let env = Env::default();
    let (_admin, user, recipient, token_addr, treasury_id) = setup(&env);
    let token = TokenClient::new(&env, &token_addr);
    let client = TreasuryClient::new(&env, &treasury_id);

    client.deposit(&user, &3_000);
    assert_eq!(token.balance(&treasury_id), 3_000);
    assert_eq!(token.balance(&user), 7_000);

    client.withdraw(&recipient, &1_000);
    assert_eq!(token.balance(&treasury_id), 2_000);
    assert_eq!(token.balance(&recipient), 1_000);
}

#[test]
fn integration_pause_blocks_deposit_and_withdraw() {
    let env = Env::default();
    let (_admin, user, recipient, _token_addr, treasury_id) = setup(&env);
    let client = TreasuryClient::new(&env, &treasury_id);

    client.deposit(&user, &500);
    client.set_paused(&true);

    assert!(client.try_deposit(&user, &100).is_err());
    assert!(client.try_withdraw(&recipient, &100).is_err());
}

#[test]
fn integration_unpause_restores_operation() {
    let env = Env::default();
    let (_admin, user, recipient, token_addr, treasury_id) = setup(&env);
    let token = TokenClient::new(&env, &token_addr);
    let client = TreasuryClient::new(&env, &treasury_id);

    client.deposit(&user, &2_000);
    client.set_paused(&true);
    client.set_paused(&false);
    client.deposit(&user, &500);
    assert_eq!(token.balance(&treasury_id), 2_500);

    client.withdraw(&recipient, &1_000);
    assert_eq!(token.balance(&treasury_id), 1_500);
}

#[test]
fn integration_min_balance_enforced_on_withdraw() {
    let env = Env::default();
    let (_admin, user, recipient, token_addr, treasury_id) = setup(&env);
    let token = TokenClient::new(&env, &token_addr);
    let client = TreasuryClient::new(&env, &treasury_id);

    client.deposit(&user, &5_000);
    client.set_min_balance(&2_000);

    client.withdraw(&recipient, &3_000);
    assert_eq!(token.balance(&treasury_id), 2_000);

    assert!(client.try_withdraw(&recipient, &1).is_err());
}

#[test]
fn integration_zero_amount_deposit_rejected() {
    let env = Env::default();
    let (_admin, user, _recipient, token_addr, treasury_id) = setup(&env);
    let token = TokenClient::new(&env, &token_addr);
    let client = TreasuryClient::new(&env, &treasury_id);

    assert!(client.try_deposit(&user, &0).is_err());
    assert_eq!(token.balance(&treasury_id), 0);
}

#[test]
fn integration_withdraw_exceeds_balance_rejected() {
    let env = Env::default();
    let (_admin, user, recipient, _token_addr, treasury_id) = setup(&env);
    let client = TreasuryClient::new(&env, &treasury_id);

    client.deposit(&user, &100);
    assert!(client.try_withdraw(&recipient, &101).is_err());
}

#[test]
fn integration_multiple_depositors_additive() {
    let env = Env::default();
    let (_admin, user, recipient, token_addr, treasury_id) = setup(&env);
    let token = TokenClient::new(&env, &token_addr);
    let client = TreasuryClient::new(&env, &treasury_id);

    let user2 = Address::generate(&env);
    StellarAssetClient::new(&env, &token_addr).mint(&user2, &5_000);

    client.deposit(&user, &2_000);
    client.deposit(&user2, &3_000);
    assert_eq!(token.balance(&treasury_id), 5_000);

    client.withdraw(&recipient, &5_000);
    assert_eq!(token.balance(&treasury_id), 0);
}
