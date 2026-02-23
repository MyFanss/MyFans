#![cfg(test)]

use crate::treasury::{Treasury, TreasuryClient};
use soroban_sdk::{
    testutils::Address as _,
    token::{StellarAssetClient, TokenClient},
    xdr::SorobanAuthorizationEntry,
    Address, Env,
};

fn create_token_contract<'a>(
    env: &Env,
    admin: &Address,
) -> (Address, TokenClient<'a>, StellarAssetClient<'a>) {
    let contract_address = env
        .register_stellar_asset_contract_v2(admin.clone())
        .address();
    let token_client = TokenClient::new(env, &contract_address);
    let admin_client = StellarAssetClient::new(env, &contract_address);
    (contract_address, token_client, admin_client)
}

#[test]
fn test_deposit_and_withdraw() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    let (token_address, token_client, admin_client) = create_token_contract(&env, &admin);
    admin_client.mint(&user, &1000);

    let treasury_id = env.register_contract(None, Treasury);
    let treasury_client = TreasuryClient::new(&env, &treasury_id);

    treasury_client.initialize(&admin, &token_address);
    treasury_client.deposit(&user, &500);

    assert_eq!(token_client.balance(&treasury_id), 500);
    assert_eq!(token_client.balance(&user), 500);

    treasury_client.withdraw(&user, &200);
    assert_eq!(token_client.balance(&treasury_id), 300);
    assert_eq!(token_client.balance(&user), 700);
}

#[test]
#[should_panic(expected = "insufficient balance")]
fn test_withdraw_insufficient_balance() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    let (token_address, _token_client, admin_client) = create_token_contract(&env, &admin);
    admin_client.mint(&user, &1000);

    let treasury_id = env.register_contract(None, Treasury);
    let treasury_client = TreasuryClient::new(&env, &treasury_id);

    treasury_client.initialize(&admin, &token_address);
    treasury_client.deposit(&user, &100);

    treasury_client.withdraw(&user, &500);
}

#[test]
fn test_unauthorized_withdraw_reverts() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let unauthorized = Address::generate(&env);

    let (token_address, _token_client, admin_client) = create_token_contract(&env, &admin);
    admin_client.mint(&user, &1000);

    let treasury_id = env.register_contract(None, Treasury);
    let treasury_client = TreasuryClient::new(&env, &treasury_id);

    treasury_client.initialize(&admin, &token_address);
    treasury_client.deposit(&user, &500);

    // Disable auth mocking so the next call is checked for real. Unauthorized is not admin.
    let empty: &[SorobanAuthorizationEntry] = &[];
    env.set_auths(empty);

    let result = treasury_client.try_withdraw(&unauthorized, &100);
    assert!(result.is_err());
}
