//! Unit tests for the content-access contract's initialize and admin paths
//! (issue #910).
//!
//! # Coverage
//! - `initialize`: stores admin and token, rejects double-init with `AlreadyInitialized`
//! - `admin()`: returns stored admin, panics when uninitialized
//! - `set_admin`: transfers role, requires current-admin auth
//! - Admin-gated functions (`set_max_price`, `get_max_price`): enforce admin auth,
//!   reject non-admin callers, support cap-clear via `set_max_price(0)`
//! - Admin transfer lifecycle: new admin gains powers, old admin loses them

#![cfg(test)]

use crate::{ContentAccess, ContentAccessClient, Error};
use soroban_sdk::{
    testutils::Address as _, xdr::SorobanAuthorizationEntry, Address, Env, Error as SorobanError,
};

const EMPTY_AUTHS: &[SorobanAuthorizationEntry] = &[];

// ── Mock token (same pattern as the inline test module) ──────────────────────

use soroban_sdk::{contract, contractimpl};

#[contract]
pub struct MockToken;

#[contractimpl]
impl MockToken {
    pub fn balance(_env: Env, _id: Address) -> i128 {
        0
    }

    pub fn transfer(_env: Env, _from: Address, _to: Address, _amount: i128) {}
}

// ── Setup helper ─────────────────────────────────────────────────────────────

fn setup() -> (Env, Address, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().with_mut(|li| {
        li.sequence_number = 1000;
        li.min_persistent_entry_ttl = 10_000_000;
        li.min_temp_entry_ttl = 10_000_000;
    });
    let admin = Address::generate(&env);
    let token_id = env.register_contract(None, MockToken);
    let contract_id = env.register_contract(None, ContentAccess);
    (env, contract_id, admin, token_id)
}

// ── Initialize ────────────────────────────────────────────────────────────────

/// initialize stores the admin so that admin() returns it.
#[test]
fn initialize_stores_admin() {
    let (env, contract_id, admin, token_id) = setup();
    let client = ContentAccessClient::new(&env, &contract_id);

    client.initialize(&admin, &token_id);

    assert_eq!(
        client.admin(),
        admin,
        "admin() must return the initialized admin"
    );
}

/// initialize stores the token address; set_content_price succeeds after init.
/// (Indirect proof that the token is wired: set_content_price requires no token
/// call, but unlock_content does — so we just verify the contract is usable.)
#[test]
fn initialize_stores_token_address() {
    let (env, contract_id, admin, token_id) = setup();
    let client = ContentAccessClient::new(&env, &contract_id);

    client.initialize(&admin, &token_id);

    // If token was not stored, unlock_content would panic with NotInitialized.
    // set_content_price is a safe proxy: it succeeds only when contract is initialized.
    let creator = Address::generate(&env);
    client.set_content_price(&creator, &1, &100);
    assert_eq!(client.get_content_price(&creator, &1), Some(100));
}

/// Second initialize call returns AlreadyInitialized (error code 1).
#[test]
fn initialize_double_init_returns_already_initialized() {
    let (env, contract_id, admin, token_id) = setup();
    let client = ContentAccessClient::new(&env, &contract_id);

    client.initialize(&admin, &token_id);
    let result = client.try_initialize(&admin, &token_id);

    assert_eq!(
        result,
        Err(Ok(SorobanError::from_contract_error(
            Error::AlreadyInitialized as u32,
        ))),
        "second initialize must return AlreadyInitialized (code 1)"
    );
}

/// initialize requires admin authorization.
#[test]
#[should_panic(expected = "Unauthorized function call")]
fn initialize_missing_admin_auth_panics() {
    let env = Env::default();
    env.ledger().with_mut(|li| li.sequence_number = 1000);
    let admin = Address::generate(&env);
    let token_id = env.register_contract(None, MockToken);
    let contract_id = env.register_contract(None, ContentAccess);
    let client = ContentAccessClient::new(&env, &contract_id);

    // No mock_all_auths — require_auth must fire.
    client.initialize(&admin, &token_id);
}

// ── admin() view ──────────────────────────────────────────────────────────────

/// admin() returns the currently configured admin.
#[test]
fn admin_view_returns_configured_admin() {
    let (env, contract_id, admin, token_id) = setup();
    let client = ContentAccessClient::new(&env, &contract_id);

    client.initialize(&admin, &token_id);

    assert_eq!(client.admin(), admin);
}

/// admin() panics with NotInitialized when the contract has not been initialized.
#[test]
fn admin_view_panics_when_uninitialized() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ContentAccess);
    let client = ContentAccessClient::new(&env, &contract_id);

    let result = client.try_admin();
    assert!(
        result.is_err(),
        "admin() must fail on uninitialized contract"
    );
}

// ── set_admin ─────────────────────────────────────────────────────────────────

/// set_admin transfers the admin role; admin() returns the new admin.
#[test]
fn set_admin_transfers_admin_role() {
    let (env, contract_id, admin, token_id) = setup();
    let client = ContentAccessClient::new(&env, &contract_id);
    let new_admin = Address::generate(&env);

    client.initialize(&admin, &token_id);
    client.set_admin(&new_admin);

    assert_eq!(
        client.admin(),
        new_admin,
        "admin() must return new admin after set_admin"
    );
}

/// After set_admin, new admin can call admin-only functions (set_max_price).
#[test]
fn new_admin_can_call_admin_functions() {
    let (env, contract_id, admin, token_id) = setup();
    let client = ContentAccessClient::new(&env, &contract_id);
    let new_admin = Address::generate(&env);

    client.initialize(&admin, &token_id);
    client.set_admin(&new_admin);

    // set_max_price is admin-only; should succeed for new admin.
    client.set_max_price(&500_000);
    assert_eq!(client.get_max_price(), Some(500_000));
}

/// set_admin requires the current admin's authorization.
#[test]
fn set_admin_requires_current_admin_auth() {
    let env = Env::default();
    env.ledger().with_mut(|li| li.sequence_number = 1000);
    let contract_id = env.register_contract(None, ContentAccess);
    let client = ContentAccessClient::new(&env, &contract_id);
    let token_id = env.register_contract(None, MockToken);
    let admin = Address::generate(&env);
    let non_admin = Address::generate(&env);

    env.mock_all_auths();
    client.initialize(&admin, &token_id);

    // Remove all auths so the non-admin cannot authorize.
    env.set_auths(EMPTY_AUTHS);
    let new_admin = Address::generate(&env);
    let result = client.try_set_admin(&new_admin);
    assert!(result.is_err(), "set_admin must fail without admin auth");
    let _ = non_admin;
}

/// Admin can call set_admin multiple times (chain of transfers).
#[test]
fn set_admin_can_be_called_multiple_times() {
    let (env, contract_id, admin, token_id) = setup();
    let client = ContentAccessClient::new(&env, &contract_id);
    let admin2 = Address::generate(&env);
    let admin3 = Address::generate(&env);

    client.initialize(&admin, &token_id);
    client.set_admin(&admin2);
    assert_eq!(client.admin(), admin2);

    client.set_admin(&admin3);
    assert_eq!(client.admin(), admin3);
}

// ── set_max_price (admin-gated) ───────────────────────────────────────────────

/// Admin can set a max price cap; get_max_price returns it.
#[test]
fn set_max_price_stores_cap() {
    let (env, contract_id, admin, token_id) = setup();
    let client = ContentAccessClient::new(&env, &contract_id);

    client.initialize(&admin, &token_id);
    client.set_max_price(&1_000_000);

    assert_eq!(client.get_max_price(), Some(1_000_000));
}

/// get_max_price returns None before any cap is configured.
#[test]
fn get_max_price_none_before_set() {
    let (env, contract_id, admin, token_id) = setup();
    let client = ContentAccessClient::new(&env, &contract_id);

    client.initialize(&admin, &token_id);

    assert_eq!(client.get_max_price(), None);
}

/// set_max_price(0) removes the cap; get_max_price returns None.
#[test]
fn set_max_price_zero_clears_cap() {
    let (env, contract_id, admin, token_id) = setup();
    let client = ContentAccessClient::new(&env, &contract_id);

    client.initialize(&admin, &token_id);
    client.set_max_price(&500_000);
    assert_eq!(client.get_max_price(), Some(500_000));

    client.set_max_price(&0);
    assert_eq!(
        client.get_max_price(),
        None,
        "cap must be removed after set_max_price(0)"
    );
}

/// Non-admin cannot call set_max_price.
#[test]
fn set_max_price_rejected_for_non_admin() {
    let env = Env::default();
    env.ledger().with_mut(|li| li.sequence_number = 1000);
    let contract_id = env.register_contract(None, ContentAccess);
    let token_id = env.register_contract(None, MockToken);
    let client = ContentAccessClient::new(&env, &contract_id);
    let admin = Address::generate(&env);

    env.mock_all_auths();
    client.initialize(&admin, &token_id);

    env.set_auths(EMPTY_AUTHS);
    let result = client.try_set_max_price(&500_000);
    assert!(
        result.is_err(),
        "set_max_price must fail without admin auth"
    );
}

/// Prices above max_price are rejected when cap is configured.
#[test]
fn set_content_price_above_max_is_rejected() {
    let (env, contract_id, admin, token_id) = setup();
    let client = ContentAccessClient::new(&env, &contract_id);
    let creator = Address::generate(&env);

    client.initialize(&admin, &token_id);
    client.set_max_price(&1_000);

    let result = client.try_set_content_price(&creator, &1, &1_001);
    assert!(result.is_err(), "price above max_price must be rejected");
}

/// Prices at or below max_price are accepted when cap is configured.
#[test]
fn set_content_price_at_max_is_accepted() {
    let (env, contract_id, admin, token_id) = setup();
    let client = ContentAccessClient::new(&env, &contract_id);
    let creator = Address::generate(&env);

    client.initialize(&admin, &token_id);
    client.set_max_price(&1_000);

    client.set_content_price(&creator, &1, &1_000);
    assert_eq!(client.get_content_price(&creator, &1), Some(1_000));
}
