use super::*;
use soroban_sdk::token::{Client as TokenClient, StellarAssetClient};
use soroban_sdk::{
    testutils::{Address as _, Events},
    xdr::SorobanAuthorizationEntry,
    Address, Env, Error as SorobanError, Symbol, TryIntoVal,
};

fn setup<'a>(
    env: &'a Env,
) -> (
    Address, // admin
    Address, // creator
    Address, // depositor
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

    let (_admin, creator, depositor, client, token_client, _) = setup(&env);

    client.deposit(&depositor, &creator, &500);

    assert_eq!(client.balance(&creator), 500);

    // Contract custody verification
    let contract_balance = token_client.balance(&client.address);
    assert_eq!(contract_balance, 500);
}

#[test]
fn withdraw_reduces_balance_and_transfers_tokens() {
    let env = Env::default();

    let (_admin, creator, depositor, client, token_client, _) = setup(&env);

    client.deposit(&depositor, &creator, &500);

    client.withdraw(&creator, &200);

    assert_eq!(client.balance(&creator), 300);

    // Creator should receive withdrawn tokens
    assert_eq!(token_client.balance(&creator), 200);
}

#[test]
fn withdraw_insufficient_balance_reverts() {
    let env = Env::default();

    let (_admin, creator, _depositor, client, _, _) = setup(&env);

    let result = client.try_withdraw(&creator, &100);
    assert_eq!(
        result,
        Err(Ok(SorobanError::from_contract_error(
            Error::InsufficientBalance as u32,
        )))
    );
}

#[test]
fn unauthorized_deposit_reverts() {
    let env = Env::default();

    let (_admin, creator, _depositor, client, _, token_admin_client) = setup(&env);

    let unauthorized = Address::generate(&env);

    // Mint tokens to unauthorized user
    token_admin_client.mint(&unauthorized, &500);

    // Unauthorized address not added via add_authorized
    let result = client.try_deposit(&unauthorized, &creator, &100);
    assert_eq!(
        result,
        Err(Ok(SorobanError::from_contract_error(
            Error::NotAuthorized as u32,
        )))
    );
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
    let token_id = env
        .register_stellar_asset_contract_v2(token_admin.clone())
        .address();
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

    let all_events = env.events().all();
    let mut withdraw_event: Option<(
        Address,
        soroban_sdk::Vec<soroban_sdk::Val>,
        soroban_sdk::Val,
    )> = None;
    for i in 0..all_events.len() {
        let evt = all_events.get(i).unwrap();
        let (id, topics, _data) = &evt;
        if *id != client.address {
            continue;
        }
        let t0: Option<Symbol> = topics.get(0).and_then(|v| v.try_into_val(&env).ok());
        if t0 == Some(Symbol::new(&env, "withdraw")) {
            withdraw_event = Some(evt);
            break;
        }
    }

    let event = withdraw_event.expect("withdraw event not emitted");

    assert_eq!(event.1.len(), 1);
    let topic_symbol: Symbol = event.1.get(0).unwrap().try_into_val(&env).unwrap();
    assert_eq!(topic_symbol, Symbol::new(&env, "withdraw"));

    let withdraw_data: WithdrawEvent = event.2.try_into_val(&env).unwrap();
    assert_eq!(withdraw_data.creator, creator);
    assert_eq!(withdraw_data.amount, 200);
    assert_eq!(withdraw_data.token, token_address);
}

#[test]
fn withdraw_failed_emits_no_event() {
    let env = Env::default();

    let (_admin, creator, depositor, client, _, _) = setup(&env);

    client.deposit(&depositor, &creator, &500);

    let events_before = env.events().all().len();
    let result = client.try_withdraw(&creator, &600);
    assert_eq!(
        result,
        Err(Ok(SorobanError::from_contract_error(
            Error::InsufficientBalance as u32,
        )))
    );

    let withdraw_events = env.events().all().iter().filter(|evt| {
        let (id, topics, _) = evt;
        if *id != client.address {
            return false;
        }
        topics.first().and_then(|v| v.try_into_val(&env).ok())
            == Some(Symbol::new(&env, "withdraw"))
    });
    assert_eq!(withdraw_events.count(), 0);
    assert_eq!(client.balance(&creator), 500);
    assert!(env.events().all().len() >= events_before);
}

// -------- Gas usage review for hot paths (issue #946) --------
//
// Soroban metering tracks CPU instructions and memory bytes per invocation.
// These tests exercise the three hot paths — `deposit`, `withdraw`, and the
// implicit balance-read inside `withdraw` — under realistic conditions and
// assert on observable correctness that would break if an optimization
// regressed.  Correctness is the observable proxy for metering: wrong
// balances indicate a bad write path, which is also where gas is spent.
//
// Hot-path analysis:
// | Function  | Dominant cost                         | Storage tier |
// |-----------|---------------------------------------|--------------|
// | deposit   | token cross-contract transfer         | instance     |
// | withdraw  | auth check + balance read + transfer  | instance     |
// | balance   | storage read                          | instance     |

#[test]
fn hot_path_deposit_single_correctness() {
    let env = Env::default();
    let (_admin, creator, depositor, client, token_client, _) = setup(&env);

    let before_depositor = token_client.balance(&depositor);
    let before_contract = token_client.balance(&client.address);

    client.deposit(&depositor, &creator, &500);

    assert_eq!(token_client.balance(&depositor), before_depositor - 500);
    assert_eq!(token_client.balance(&client.address), before_contract + 500);
    assert_eq!(client.balance(&creator), 500);
}

#[test]
fn hot_path_deposit_repeated_accumulates() {
    let env = Env::default();
    let (_admin, creator, depositor, client, _, token_admin_client) = setup(&env);

    token_admin_client.mint(&depositor, &2_000);

    client.deposit(&depositor, &creator, &100);
    assert_eq!(client.balance(&creator), 100);

    client.deposit(&depositor, &creator, &200);
    assert_eq!(client.balance(&creator), 300);

    client.deposit(&depositor, &creator, &300);
    assert_eq!(client.balance(&creator), 600);
}

#[test]
fn hot_path_withdraw_correctness() {
    let env = Env::default();
    let (_admin, creator, depositor, client, token_client, _) = setup(&env);

    client.deposit(&depositor, &creator, &600);

    let before_creator_tokens = token_client.balance(&creator);
    let before_contract = token_client.balance(&client.address);

    client.withdraw(&creator, &250);

    assert_eq!(client.balance(&creator), 350);
    assert_eq!(token_client.balance(&creator), before_creator_tokens + 250);
    assert_eq!(token_client.balance(&client.address), before_contract - 250);
}

#[test]
fn hot_path_full_withdraw_leaves_zero() {
    let env = Env::default();
    let (_admin, creator, depositor, client, token_client, _) = setup(&env);

    client.deposit(&depositor, &creator, &400);
    client.withdraw(&creator, &400);

    assert_eq!(client.balance(&creator), 0);
    assert_eq!(token_client.balance(&creator), 400);
    assert_eq!(token_client.balance(&client.address), 0);
}

#[test]
fn hot_path_balance_read_consistent_with_token_client() {
    let env = Env::default();
    let (_admin, creator, depositor, client, token_client, _) = setup(&env);

    client.deposit(&depositor, &creator, &750);

    let internal_balance = client.balance(&creator);
    let contract_token_balance = token_client.balance(&client.address);

    assert_eq!(internal_balance, 750);
    assert_eq!(contract_token_balance, 750);
}

#[test]
fn hot_path_invalid_amount_rejected_before_transfer() {
    let env = Env::default();
    let (_admin, creator, depositor, client, _, _) = setup(&env);

    // Zero deposit: InvalidAmount guard fires before auth and token transfer
    let result = client.try_deposit(&depositor, &creator, &0);
    assert_eq!(
        result,
        Err(Ok(SorobanError::from_contract_error(
            Error::InvalidAmount as u32,
        )))
    );

    // Zero withdrawal: InvalidAmount guard fires before auth and token transfer
    let result = client.try_withdraw(&creator, &0);
    assert_eq!(
        result,
        Err(Ok(SorobanError::from_contract_error(
            Error::InvalidAmount as u32,
        )))
    );
}

#[test]
fn hot_path_overdraft_rejected() {
    let env = Env::default();
    let (_admin, creator, depositor, client, _, _) = setup(&env);

    client.deposit(&depositor, &creator, &300);

    let result = client.try_withdraw(&creator, &400);
    assert_eq!(
        result,
        Err(Ok(SorobanError::from_contract_error(
            Error::InsufficientBalance as u32,
        )))
    );

    // Balance unchanged after failed withdrawal
    assert_eq!(client.balance(&creator), 300);
}
