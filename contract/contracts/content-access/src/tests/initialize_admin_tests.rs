//! Unit tests for `initialize` and admin-function paths in ContentAccess.
//!
//! Covers paths not exercised by the existing test suite:
//! - initialize: config persists correctly across all stored keys
//! - set_admin: new admin can call admin-only functions; chain transfer works
//! - set_max_price: zero removes cap, negative rejected, enforced on set_content_price
//! - get_max_price: None by default, Some after setting, None after cap removal
//! - admin(): exact return value after each transfer

use crate::{ContentAccess, ContentAccessClient};
use soroban_sdk::{
    contract, contractimpl,
    testutils::{Address as _, Ledger},
    Address, Env,
};

// Minimal mock token — only `balance` needed for initialize's validation call.
#[contract]
pub struct MockToken;

#[contractimpl]
impl MockToken {
    pub fn balance(_env: Env, _id: Address) -> i128 {
        0
    }
    pub fn transfer(_env: Env, _from: Address, _to: Address, _amount: i128) {}
}

fn deploy(env: &Env) -> (ContentAccessClient<'_>, Address, Address) {
    env.mock_all_auths();
    env.ledger().with_mut(|li| li.sequence_number = 1000);
    let admin = Address::generate(env);
    let token = env.register_contract(None, MockToken);
    let id = env.register_contract(None, ContentAccess);
    let client = ContentAccessClient::new(env, &id);
    client.initialize(&admin, &token);
    (client, admin, token)
}

// ── initialize ────────────────────────────────────────────────────────────────

/// After initialize, `admin()` returns the address passed to initialize.
#[test]
fn initialize_stores_admin_correctly() {
    let env = Env::default();
    let (client, admin, _token) = deploy(&env);
    assert_eq!(client.admin(), admin);
}

/// After initialize, get_max_price returns None (no cap by default).
#[test]
fn initialize_sets_no_max_price_by_default() {
    let env = Env::default();
    let (client, _admin, _token) = deploy(&env);
    assert_eq!(client.get_max_price(), None);
}

/// Double-initialize returns AlreadyInitialized error code 1.
#[test]
fn initialize_already_initialized_returns_error_code_1() {
    let env = Env::default();
    let (client, admin, token) = deploy(&env);
    let result = client.try_initialize(&admin, &token);
    assert_eq!(
        result,
        Err(Ok(soroban_sdk::Error::from_contract_error(
            crate::Error::AlreadyInitialized as u32
        )))
    );
}

// ── set_admin / admin ─────────────────────────────────────────────────────────

/// set_admin changes the admin; admin() reflects the new address.
#[test]
fn set_admin_updates_admin_address() {
    let env = Env::default();
    let (client, _old_admin, _token) = deploy(&env);
    let new_admin = Address::generate(&env);
    client.set_admin(&new_admin);
    assert_eq!(client.admin(), new_admin);
}

/// After set_admin, the NEW admin can call set_max_price (admin-only).
#[test]
fn new_admin_can_call_admin_only_functions() {
    let env = Env::default();
    let (client, _old_admin, _token) = deploy(&env);
    let new_admin = Address::generate(&env);
    client.set_admin(&new_admin);

    // new_admin is now the admin — set_max_price must succeed.
    client.set_max_price(&500);
    assert_eq!(client.get_max_price(), Some(500));
}

/// Admin transfer chain A → B → C: only the latest admin is authoritative.
#[test]
fn admin_chain_transfer_three_hops() {
    let env = Env::default();
    let (client, _admin_a, _token) = deploy(&env);

    let admin_b = Address::generate(&env);
    let admin_c = Address::generate(&env);

    client.set_admin(&admin_b);
    assert_eq!(client.admin(), admin_b);

    client.set_admin(&admin_c);
    assert_eq!(client.admin(), admin_c);
}

/// admin() on an uninitialized contract returns NotInitialized (code 3).
#[test]
fn admin_view_uninitialized_returns_not_initialized() {
    let env = Env::default();
    env.mock_all_auths();
    let id = env.register_contract(None, ContentAccess);
    let client = ContentAccessClient::new(&env, &id);

    let result = client.try_admin();
    assert_eq!(
        result,
        Err(Ok(soroban_sdk::Error::from_contract_error(
            crate::Error::NotInitialized as u32
        )))
    );
}

// ── set_max_price / get_max_price ─────────────────────────────────────────────

/// Admin can set a positive max price; get_max_price reflects it.
#[test]
fn set_max_price_stores_and_is_readable() {
    let env = Env::default();
    let (client, _admin, _token) = deploy(&env);

    client.set_max_price(&1_000);
    assert_eq!(client.get_max_price(), Some(1_000));
}

/// set_max_price(0) removes the cap; get_max_price returns None afterward.
#[test]
fn set_max_price_zero_removes_cap() {
    let env = Env::default();
    let (client, _admin, _token) = deploy(&env);

    client.set_max_price(&500);
    assert_eq!(client.get_max_price(), Some(500));

    client.set_max_price(&0);
    assert_eq!(
        client.get_max_price(),
        None,
        "zero must remove the price cap"
    );
}

/// Negative max_price is rejected with InvalidMaxPrice (code 9).
#[test]
fn set_max_price_negative_returns_invalid_max_price() {
    let env = Env::default();
    let (client, _admin, _token) = deploy(&env);

    let result = client.try_set_max_price(&-1);
    assert_eq!(
        result,
        Err(Ok(soroban_sdk::Error::from_contract_error(
            crate::Error::InvalidMaxPrice as u32
        )))
    );
}

/// Overwriting an existing max price with a new value works correctly.
#[test]
fn set_max_price_can_be_updated() {
    let env = Env::default();
    let (client, _admin, _token) = deploy(&env);

    client.set_max_price(&200);
    assert_eq!(client.get_max_price(), Some(200));

    client.set_max_price(&800);
    assert_eq!(client.get_max_price(), Some(800));
}

/// get_max_price returns None by default (no cap configured after initialize).
#[test]
fn get_max_price_default_is_none() {
    let env = Env::default();
    let (client, _admin, _token) = deploy(&env);
    assert_eq!(client.get_max_price(), None);
}

/// When a max price cap is active, set_content_price above the cap is rejected.
#[test]
fn set_content_price_above_max_price_rejected() {
    let env = Env::default();
    let (client, _admin, _token) = deploy(&env);
    let creator = Address::generate(&env);

    client.set_max_price(&100);
    let result = client.try_set_content_price(&creator, &1, &101);
    assert_eq!(
        result,
        Err(Ok(soroban_sdk::Error::from_contract_error(
            crate::Error::PriceExceedsMax as u32
        )))
    );
}

/// When a max price cap is active, set_content_price at exactly the cap succeeds.
#[test]
fn set_content_price_at_max_price_boundary_succeeds() {
    let env = Env::default();
    let (client, _admin, _token) = deploy(&env);
    let creator = Address::generate(&env);

    client.set_max_price(&100);
    client.set_content_price(&creator, &1, &100);
    assert_eq!(client.get_content_price(&creator, &1), Some(100));
}

/// After removing the cap (set_max_price(0)), previously rejected prices succeed.
#[test]
fn set_content_price_succeeds_after_cap_removed() {
    let env = Env::default();
    let (client, _admin, _token) = deploy(&env);
    let creator = Address::generate(&env);

    client.set_max_price(&50);
    assert!(client.try_set_content_price(&creator, &1, &100).is_err());

    client.set_max_price(&0); // remove cap
    client.set_content_price(&creator, &1, &100);
    assert_eq!(client.get_content_price(&creator, &1), Some(100));
}
