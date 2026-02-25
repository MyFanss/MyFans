use super::*;
use soroban_sdk::{
    testutils::{Address as _, Events, MockAuth, MockAuthInvoke},
    token::{StellarAssetClient, TokenClient},
    xdr::SorobanAuthorizationEntry,
    Address, Env, IntoVal, Symbol,
};

fn create_token_contract<'a>(env: &Env, admin: &Address) -> (Address, TokenClient<'a>, StellarAssetClient<'a>) {
    let contract_address = env.register_stellar_asset_contract_v2(admin.clone()).address();
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

    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let unauthorized = Address::generate(&env);

    let (token_address, token_client, admin_client) = create_token_contract(&env, &admin);
    let treasury_id = env.register_contract(None, Treasury);
    let treasury_client = TreasuryClient::new(&env, &treasury_id);

    let mint_invoke = MockAuthInvoke {
        contract: &token_address,
        fn_name: "mint",
        args: soroban_sdk::vec![&env, user.clone().into_val(&env), 1000_i128.into_val(&env)],
        sub_invokes: &[],
    };
    env.mock_auths(&[MockAuth {
        address: &admin,
        invoke: &mint_invoke,
    }]);
    admin_client.mint(&user, &1000);

    let init_invoke = MockAuthInvoke {
        contract: &treasury_id,
        fn_name: "initialize",
        args: soroban_sdk::vec![
            &env,
            admin.clone().into_val(&env),
            token_address.clone().into_val(&env),
        ],
        sub_invokes: &[],
    };
    env.mock_auths(&[MockAuth {
        address: &admin,
        invoke: &init_invoke,
    }]);
    treasury_client.initialize(&admin, &token_address);

    let deposit_amount = 500_i128;
    let transfer_invoke = MockAuthInvoke {
        contract: &token_address,
        fn_name: "transfer",
        args: soroban_sdk::vec![
            &env,
            user.clone().into_val(&env),
            treasury_id.clone().into_val(&env),
            deposit_amount.into_val(&env),
        ],
        sub_invokes: &[],
    };
    let deposit_invoke = MockAuthInvoke {
        contract: &treasury_id,
        fn_name: "deposit",
        args: soroban_sdk::vec![
            &env,
            user.clone().into_val(&env),
            deposit_amount.into_val(&env),
        ],
        sub_invokes: &[transfer_invoke],
    };
    env.mock_auths(&[MockAuth {
        address: &user,
        invoke: &deposit_invoke,
    }]);
    treasury_client.deposit(&user, &deposit_amount);

    assert_eq!(token_client.balance(&treasury_id), 500);

    let empty: &[SorobanAuthorizationEntry] = &[];
    env.set_auths(empty);
    let result = treasury_client.try_withdraw(&unauthorized, &100);
    assert!(result.is_err());
}

#[test]
#[should_panic(expected = "treasury is paused")]
fn test_pause_blocks_deposit() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    let (token_address, _token_client, admin_client) = create_token_contract(&env, &admin);
    admin_client.mint(&user, &1000);

    let treasury_id = env.register_contract(None, Treasury);
    let treasury_client = TreasuryClient::new(&env, &treasury_id);

    treasury_client.initialize(&admin, &token_address);
    treasury_client.set_paused(&true);
    treasury_client.deposit(&user, &100);
}

#[test]
#[should_panic(expected = "treasury is paused")]
fn test_pause_blocks_withdraw() {
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

    treasury_client.set_paused(&true);
    treasury_client.withdraw(&user, &100);
}

#[test]
fn test_unpause_allows_deposit_and_withdraw() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    let (token_address, token_client, admin_client) = create_token_contract(&env, &admin);
    admin_client.mint(&user, &1000);

    let treasury_id = env.register_contract(None, Treasury);
    let treasury_client = TreasuryClient::new(&env, &treasury_id);

    treasury_client.initialize(&admin, &token_address);
    treasury_client.set_paused(&true);
    treasury_client.set_paused(&false);
    treasury_client.deposit(&user, &300);
    assert_eq!(token_client.balance(&treasury_id), 300);
    treasury_client.withdraw(&user, &100);
    assert_eq!(token_client.balance(&treasury_id), 200);
}

#[test]
#[should_panic(expected = "withdraw would leave balance below minimum")]
fn test_min_balance_blocks_withdraw() {
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
    treasury_client.set_min_balance(&300);

    // 500 - 300 = 200 would remain; min is 300, so withdraw 300 is ok, withdraw 201 is not
    treasury_client.withdraw(&user, &200);
    assert_eq!(token_client.balance(&treasury_id), 300);
    treasury_client.withdraw(&user, &1); // would leave 299 < 300
}

#[test]
fn test_min_balance_allows_withdraw_above_threshold() {
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
    treasury_client.set_min_balance(&200);

    treasury_client.withdraw(&user, &300);
    assert_eq!(token_client.balance(&treasury_id), 200);
    assert_eq!(token_client.balance(&user), 800); // 500 after deposit + 300 from withdraw
}

#[test]
#[should_panic(expected = "min_balance cannot be negative")]
fn test_set_min_balance_negative_reverts() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let (token_address, _, _) = create_token_contract(&env, &admin);

    let treasury_id = env.register_contract(None, Treasury);
    let treasury_client = TreasuryClient::new(&env, &treasury_id);

    treasury_client.initialize(&admin, &token_address);
    treasury_client.set_min_balance(&-1);
}

#[test]
fn test_deposit_emits_event() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    let (token_address, _, admin_client) = create_token_contract(&env, &admin);
    admin_client.mint(&user, &1000);

    let treasury_id = env.register_contract(None, Treasury);
    let treasury_client = TreasuryClient::new(&env, &treasury_id);

    treasury_client.initialize(&admin, &token_address);
    treasury_client.deposit(&user, &500);

    let events = env.events().all();
    let deposit_event = events.iter().find(|e| {
        e.topics.first().map_or(false, |t| {
            t.as_val().try_into_val(&env).ok() == Some(Symbol::new(&env, "deposit"))
        })
    });

    assert!(deposit_event.is_some());
    let event = deposit_event.unwrap();
    let (from, amount, token): (Address, i128, Address) = event.data.try_into_val(&env).unwrap();
    assert_eq!(from, user);
    assert_eq!(amount, 500);
    assert_eq!(token, token_address);
}
