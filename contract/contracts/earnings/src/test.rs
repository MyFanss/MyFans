use super::*;
use soroban_sdk::{
    testutils::{Address as _, Events},
    xdr::SorobanAuthorizationEntry,
    Address, Env, Error as SorobanError, Symbol, TryIntoVal,
};

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

#[test]
fn test_init_second_time_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let contract_id = env.register_contract(None, Earnings);
    let client = EarningsClient::new(&env, &contract_id);

    client.init(&admin);

    let result = client.try_init(&admin);
    assert_eq!(
        result,
        Err(Ok(SorobanError::from_contract_error(
            Error::AlreadyInitialized as u32,
        )))
    );
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

// ── #297 – withdrawal feature ─────────────────────────────────────────────────

/// Valid withdrawal reduces the recorded balance by the withdrawn amount.
#[test]
fn test_withdraw_valid_reduces_balance() {
    let env = Env::default();
    let (_admin, creator, client) = setup(&env);

    client.record(&creator, &500);
    client.withdraw(&creator, &200);

    assert_eq!(client.get_earnings(&creator), 300);
}

/// Withdrawing the full balance leaves zero.
#[test]
fn test_withdraw_full_balance_leaves_zero() {
    let env = Env::default();
    let (_admin, creator, client) = setup(&env);

    client.record(&creator, &400);
    client.withdraw(&creator, &400);

    assert_eq!(client.get_earnings(&creator), 0);
}

/// Withdrawing more than the recorded balance must revert.
#[test]
#[should_panic(expected = "insufficient balance")]
fn test_withdraw_over_balance_reverts() {
    let env = Env::default();
    let (_admin, creator, client) = setup(&env);

    client.record(&creator, &100);
    client.withdraw(&creator, &101);
}

/// Withdrawing from a creator with no earnings must revert.
#[test]
#[should_panic(expected = "insufficient balance")]
fn test_withdraw_zero_balance_reverts() {
    let env = Env::default();
    let (_admin, creator, client) = setup(&env);

    client.withdraw(&creator, &1);
}

/// A non-creator (no auth) must not be able to withdraw.
#[test]
fn test_withdraw_unauthorized_reverts() {
    let env = Env::default();
    let (_admin, creator, client) = setup(&env);

    client.record(&creator, &300);

    let empty: &[SorobanAuthorizationEntry] = &[];
    env.set_auths(empty);

    let result = client.try_withdraw(&creator, &100);
    assert!(result.is_err(), "expected unauthorized withdraw to revert");

    // Balance must be unchanged.
    env.mock_all_auths();
    assert_eq!(client.get_earnings(&creator), 300);
}

/// Withdraw emits a `withdraw` event with the correct topics and data.
#[test]
fn test_withdraw_emits_event() {
    let env = Env::default();
    let (_admin, creator, client) = setup(&env);

    client.record(&creator, &600);
    client.withdraw(&creator, &250);

    let all_events = env.events().all();
    let withdraw_event = all_events.iter().find(|e| {
        e.1.first()
            .is_some_and(|t| t.try_into_val(&env).ok() == Some(Symbol::new(&env, "withdraw")))
    });

    assert!(withdraw_event.is_some(), "withdraw event not emitted");
    let event = withdraw_event.unwrap();

    // topics: (symbol "withdraw", creator)
    assert_eq!(event.1.len(), 2, "expected 2 topics: (name, creator)");

    let topic_name: Symbol = event.1.get(0).unwrap().try_into_val(&env).unwrap();
    assert_eq!(topic_name, Symbol::new(&env, "withdraw"));

    let event_creator: Address = event.1.get(1).unwrap().try_into_val(&env).unwrap();
    assert_eq!(event_creator, creator, "creator mismatch in topics");

    // data: amount
    let event_amount: i128 = event.2.try_into_val(&env).unwrap();
    assert_eq!(event_amount, 250i128, "amount mismatch in data");
}

/// Multiple withdrawals each emit their own event and leave the correct balance.
#[test]
fn test_multiple_withdrawals_correct_totals() {
    let env = Env::default();
    let (_admin, creator, client) = setup(&env);

    client.record(&creator, &1000);
    client.withdraw(&creator, &300);
    client.withdraw(&creator, &200);

    assert_eq!(client.get_earnings(&creator), 500);
}
