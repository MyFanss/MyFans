#![cfg(test)]

use crate::treasury::{Treasury, TreasuryClient};
use soroban_sdk::{
    testutils::{Address as _, MockAuth, MockAuthInvoke},
    token::{StellarAssetClient, TokenClient},
    xdr::SorobanAuthorizationEntry,
    vec, Address, Env, IntoVal,
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

/// Asserts exact auth requirements: initialize requires admin, deposit requires from, withdraw requires admin.
/// Uses mock_auths with specific MockAuth entries only (no mock_all_auths). Unauthorized withdraw fails.
#[test]
fn test_treasury_auth_requirements_mock_auths() {
    let env = Env::default();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let unauthorized = Address::generate(&env);

    let (token_address, token_client, admin_client) = create_token_contract(&env, &admin);
    let treasury_id = env.register_contract(None, Treasury);
    let treasury_client = TreasuryClient::new(&env, &treasury_id);

    // Token mint: requires admin auth
    let mint_invoke = MockAuthInvoke {
        contract: &token_address,
        fn_name: "mint",
        args: vec![&env, user.clone().into_val(&env), 1000_i128.into_val(&env)],
        sub_invokes: &[],
    };
    let mint_auth = MockAuth {
        address: &admin,
        invoke: &mint_invoke,
    };
    env.mock_auths(&[mint_auth]);
    admin_client.mint(&user, &1000);

    // Initialize: requires admin auth
    let init_invoke = MockAuthInvoke {
        contract: &treasury_id,
        fn_name: "initialize",
        args: vec![&env, admin.clone().into_val(&env), token_address.clone().into_val(&env)],
        sub_invokes: &[],
    };
    let init_auth = MockAuth {
        address: &admin,
        invoke: &init_invoke,
    };
    env.mock_auths(&[init_auth]);
    treasury_client.initialize(&admin, &token_address);

    // Deposit: requires from (user) auth; treasury calls token transfer which also requires user auth
    let deposit_amount = 500_i128;
    let transfer_invoke = MockAuthInvoke {
        contract: &token_address,
        fn_name: "transfer",
        args: vec![&env, user.clone().into_val(&env), treasury_id.clone().into_val(&env), deposit_amount.into_val(&env)],
        sub_invokes: &[],
    };
    let deposit_invoke = MockAuthInvoke {
        contract: &treasury_id,
        fn_name: "deposit",
        args: vec![&env, user.clone().into_val(&env), deposit_amount.into_val(&env)],
        sub_invokes: &[transfer_invoke],
    };
    let deposit_auth = MockAuth {
        address: &user,
        invoke: &deposit_invoke,
    };
    env.mock_auths(&[deposit_auth]);
    treasury_client.deposit(&user, &deposit_amount);

    assert_eq!(token_client.balance(&treasury_id), 500);
    assert_eq!(token_client.balance(&user), 500);

    // No mock_auths for withdraw: unauthorized has no auth, so withdraw must fail
    let empty: &[SorobanAuthorizationEntry] = &[];
    env.set_auths(empty);

    let result = treasury_client.try_withdraw(&unauthorized, &100);
    assert!(result.is_err());
}
