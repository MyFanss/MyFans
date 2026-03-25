#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, xdr::SorobanAuthorizationEntry, Address, Env};

// ── helpers ──────────────────────────────────────────────────────────────────

fn setup(env: &Env) -> (Address, Address, EarningsClient<'_>) {
    env.mock_all_auths();

    let admin = Address::generate(env);
    let creator = Address::generate(env);

    let contract_id = env.register_contract(None, Earnings);
    let client = EarningsClient::new(env, &contract_id);

    client.init(&admin);

    (admin, creator, client)
}

// ── #319 – non-admin record reverts ──────────────────────────────────────────

/// Non-admin caller (no admin auth) must not be able to record earnings.
/// Clears all mocked auth entries so admin.require_auth() fails.
#[test]
fn test_non_admin_record_reverts() {
    let env = Env::default();
    let (_admin, creator, client) = setup(&env);

    // Strip all mocked auth — record now lacks the admin signature.
    let empty: &[SorobanAuthorizationEntry] = &[];
    env.set_auths(empty);

    let result = client.try_record(&creator, &500);
    assert!(result.is_err(), "expected non-admin record to revert");
}

// ── #319 – admin record success + totals ─────────────────────────────────────

/// Admin can record earnings; cumulative amounts accumulate correctly.
#[test]
fn test_admin_record_success_and_totals() {
    let env = Env::default();
    let (_admin, creator, client) = setup(&env);

    // First entry
    client.record(&creator, &300);
    assert_eq!(client.get_earnings(&creator), 300);

    // Second entry accumulates
    client.record(&creator, &200);
    assert_eq!(client.get_earnings(&creator), 500);
}

/// Multiple creators maintain independent, correct totals.
#[test]
fn test_earnings_totals_are_per_creator() {
    let env = Env::default();
    let (_admin, creator1, client) = setup(&env);
    let creator2 = Address::generate(&env);

    client.record(&creator1, &100);
    client.record(&creator1, &150);
    client.record(&creator2, &400);

    assert_eq!(client.get_earnings(&creator1), 250);
    assert_eq!(client.get_earnings(&creator2), 400);
}

/// A creator with no recorded earnings returns zero.
#[test]
fn test_get_earnings_defaults_to_zero() {
    let env = Env::default();
    let (_admin, creator, client) = setup(&env);

    assert_eq!(client.get_earnings(&creator), 0);
}
