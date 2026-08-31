use crate::{errors::TreasuryError, Treasury, TreasuryClient};
use soroban_sdk::{
    testutils::Address as _,
    token::{StellarAssetClient, TokenClient},
    Address, Env, Error as SorobanError,
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

fn setup(
    env: &Env,
) -> (
    TreasuryClient<'_>,
    Address,
    Address,
    Address,
    TokenClient<'_>,
) {
    env.mock_all_auths();

    let admin = Address::generate(env);
    let user = Address::generate(env);
    let (token_address, token_client, admin_client) = create_token_contract(env, &admin);
    admin_client.mint(&user, &1_000);

    let treasury_id = env.register_contract(None, Treasury);
    let client = TreasuryClient::new(env, &treasury_id);
    client.initialize(&admin, &token_address);

    (client, admin, user, treasury_id, token_client)
}

fn assert_contract_error<T, E, I>(
    result: Result<Result<T, E>, Result<SorobanError, I>>,
    error: TreasuryError,
) {
    match result {
        Err(Ok(actual)) => {
            assert_eq!(actual, SorobanError::from_contract_error(error as u32));
        }
        _ => panic!("expected contract error {}", error as u32),
    }
}

#[test]
fn double_initialize_returns_already_initialized() {
    let env = Env::default();
    let (client, admin, _user, _treasury_id, _token_client) = setup(&env);
    let token_address = Address::generate(&env);

    assert_contract_error(
        client.try_initialize(&admin, &token_address),
        TreasuryError::AlreadyInitialized,
    );
}

#[test]
fn uninitialized_admin_setter_returns_not_initialized() {
    let env = Env::default();
    env.mock_all_auths();
    let treasury_id = env.register_contract(None, Treasury);
    let client = TreasuryClient::new(&env, &treasury_id);

    assert_contract_error(client.try_set_paused(&true), TreasuryError::NotInitialized);
}

#[test]
fn negative_min_balance_returns_error_code() {
    let env = Env::default();
    let (client, _admin, _user, _treasury_id, _token_client) = setup(&env);

    assert_contract_error(
        client.try_set_min_balance(&-1),
        TreasuryError::NegativeMinBalance,
    );
}

#[test]
fn zero_deposit_returns_invalid_amount() {
    let env = Env::default();
    let (client, _admin, user, _treasury_id, _token_client) = setup(&env);

    assert_contract_error(client.try_deposit(&user, &0), TreasuryError::InvalidAmount);
}

#[test]
fn zero_withdraw_returns_invalid_amount() {
    let env = Env::default();
    let (client, _admin, user, _treasury_id, _token_client) = setup(&env);

    assert_contract_error(client.try_withdraw(&user, &0), TreasuryError::InvalidAmount);
}

#[test]
fn paused_deposit_returns_paused() {
    let env = Env::default();
    let (client, _admin, user, _treasury_id, _token_client) = setup(&env);

    client.set_paused(&true);

    assert_contract_error(client.try_deposit(&user, &100), TreasuryError::Paused);
}

#[test]
fn insufficient_balance_returns_error_code() {
    let env = Env::default();
    let (client, _admin, user, _treasury_id, _token_client) = setup(&env);

    assert_contract_error(
        client.try_withdraw(&user, &100),
        TreasuryError::InsufficientBalance,
    );
}

#[test]
fn min_balance_violation_returns_error_code() {
    let env = Env::default();
    let (client, _admin, user, treasury_id, token_client) = setup(&env);

    client.deposit(&user, &500);
    assert_eq!(token_client.balance(&treasury_id), 500);
    client.set_min_balance(&400);

    assert_contract_error(
        client.try_withdraw(&user, &101),
        TreasuryError::MinBalanceViolation,
    );
}
