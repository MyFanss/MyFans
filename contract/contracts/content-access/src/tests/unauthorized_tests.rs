use crate::{ContentAccess, ContentAccessClient};
use soroban_sdk::{
    contract, contractimpl,
    testutils::{Address as _, Ledger, MockAuth, MockAuthInvoke},
    vec, Address, Env, IntoVal, Val,
};

#[contract]
pub struct MockToken;

#[contractimpl]
impl MockToken {
    pub fn balance(_env: Env, _id: Address) -> i128 {
        0
    }

    pub fn transfer(_env: Env, _from: Address, _to: Address, _amount: i128) {}
}

fn setup(env: &Env) -> (ContentAccessClient<'_>, Address, Address) {
    env.mock_all_auths();
    env.ledger().with_mut(|li| li.sequence_number = 1000);

    let admin = Address::generate(env);
    let token_address = env.register_contract(None, MockToken);
    let contract_id = env.register_contract(None, ContentAccess);
    let client = ContentAccessClient::new(env, &contract_id);

    client.initialize(&admin, &token_address);
    (client, admin, token_address)
}

fn mock_rogue_auth(
    env: &Env,
    rogue: &Address,
    contract: &Address,
    fn_name: &'static str,
    args: soroban_sdk::Vec<Val>,
) {
    env.mock_auths(&[MockAuth {
        address: rogue,
        invoke: &MockAuthInvoke {
            contract,
            fn_name,
            args,
            sub_invokes: &[],
        },
    }]);
}

#[test]
fn initialize_reverts_for_non_admin_auth() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let rogue = Address::generate(&env);
    let token_address = env.register_contract(None, MockToken);
    let contract_id = env.register_contract(None, ContentAccess);
    let client = ContentAccessClient::new(&env, &contract_id);

    mock_rogue_auth(
        &env,
        &rogue,
        &client.address,
        "initialize",
        vec![
            &env,
            admin.clone().into_val(&env),
            token_address.clone().into_val(&env),
        ],
    );

    assert!(client.try_initialize(&admin, &token_address).is_err());
}

#[test]
fn unlock_content_reverts_for_non_buyer_auth() {
    let env = Env::default();
    let (client, _admin, _token_address) = setup(&env);
    let buyer = Address::generate(&env);
    let rogue = Address::generate(&env);
    let creator = Address::generate(&env);

    env.mock_all_auths();
    client.set_content_price(&creator, &1, &100);

    mock_rogue_auth(
        &env,
        &rogue,
        &client.address,
        "unlock_content",
        vec![
            &env,
            buyer.clone().into_val(&env),
            creator.clone().into_val(&env),
            1_u64.into_val(&env),
            u64::MAX.into_val(&env),
        ],
    );

    assert!(client
        .try_unlock_content(&buyer, &creator, &1, &u64::MAX)
        .is_err());
}

#[test]
fn set_content_price_reverts_for_non_creator_auth() {
    let env = Env::default();
    let (client, _admin, _token_address) = setup(&env);
    let creator = Address::generate(&env);
    let rogue = Address::generate(&env);

    mock_rogue_auth(
        &env,
        &rogue,
        &client.address,
        "set_content_price",
        vec![
            &env,
            creator.clone().into_val(&env),
            7_u64.into_val(&env),
            100_i128.into_val(&env),
        ],
    );

    assert!(client.try_set_content_price(&creator, &7, &100).is_err());
}

#[test]
fn set_max_price_reverts_for_non_admin_auth() {
    let env = Env::default();
    let (client, admin, _token_address) = setup(&env);
    let rogue = Address::generate(&env);

    mock_rogue_auth(
        &env,
        &rogue,
        &client.address,
        "set_max_price",
        vec![&env, 500_i128.into_val(&env)],
    );

    assert!(client.try_set_max_price(&500).is_err());
    assert_eq!(client.admin(), admin);
}

#[test]
fn set_admin_reverts_for_non_admin_auth() {
    let env = Env::default();
    let (client, admin, _token_address) = setup(&env);
    let rogue = Address::generate(&env);
    let new_admin = Address::generate(&env);

    mock_rogue_auth(
        &env,
        &rogue,
        &client.address,
        "set_admin",
        vec![&env, new_admin.clone().into_val(&env)],
    );

    assert!(client.try_set_admin(&new_admin).is_err());
    assert_eq!(client.admin(), admin);
}

#[test]
fn initialize_reverts_if_already_initialized() {
    let env = Env::default();
    let (client, _admin, token_address) = setup(&env);
    let second_admin = Address::generate(&env);

    env.mock_all_auths();
    assert!(client
        .try_initialize(&second_admin, &token_address)
        .is_err());
}

#[test]
fn admin_can_set_max_price_baseline() {
    let env = Env::default();
    let (client, _admin, _token_address) = setup(&env);

    env.mock_all_auths();
    client.set_max_price(&500);
    assert_eq!(client.get_max_price(), Some(500));
}
