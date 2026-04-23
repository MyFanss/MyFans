#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, testutils::Ledger, Address, Env, Error as SorobanError};
use super::Error as ContractError;

#[test]
fn test_initialize() {
    let env = Env::default();
    let contract_id = env.register_contract(None, CreatorRegistryContract);
    let client = CreatorRegistryContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);

    client.initialize(&admin);

    // Should panic if initialized again
    // In soroban tests, panics can be caught using `try_initialize` but standard interface is fine.
}

#[test]
fn test_admin_getter_returns_initialized_admin() {
    let env = Env::default();
    let contract_id = env.register_contract(None, CreatorRegistryContract);
    let client = CreatorRegistryContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);

    client.initialize(&admin);

    let fetched_admin = client.admin();
    assert_eq!(fetched_admin, admin);
}

#[test]
fn test_register_and_lookup_self() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, CreatorRegistryContract);
    let client = CreatorRegistryContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let creator = Address::generate(&env);

    client.initialize(&admin);

    // Register by creator themselves (caller = creator, address = creator)
    client.register_creator(&creator, &creator, &12345);

    let fetched_id = client.get_creator_id(&creator);
    assert_eq!(fetched_id, Some(12345));
}

#[test]
fn test_register_and_lookup_admin() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, CreatorRegistryContract);
    let client = CreatorRegistryContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let creator = Address::generate(&env);

    client.initialize(&admin);

    // Register by admin (caller = admin, address = creator)
    client.register_creator(&admin, &creator, &54321);

    let fetched_id = client.get_creator_id(&creator);
    assert_eq!(fetched_id, Some(54321));
}

#[test]
fn test_unauthorized_registration() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, CreatorRegistryContract);
    let client = CreatorRegistryContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let creator = Address::generate(&env);
    let rando = Address::generate(&env);

    client.initialize(&admin);

    // Rando tries to register creator
    let result = client.try_register_creator(&rando, &creator, &999);
    assert_eq!(
        result,
        Err(Ok(SorobanError::from_contract_error(
            Error::Unauthorized as u32,
        )))
    );
}

#[test]
fn test_duplicate_registration_reverts() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, CreatorRegistryContract);
    let client = CreatorRegistryContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let creator = Address::generate(&env);

    client.initialize(&admin);

    env.ledger().with_mut(|li| li.sequence_number = 1000);
    client.register_creator(&creator, &creator, &111);
    // Advance past rate limit window so second attempt hits "already registered"
    env.ledger().with_mut(|li| li.sequence_number = 1015);
    let result = client.try_register_creator(&creator, &creator, &222);
    assert_eq!(
        result,
        Err(Ok(SorobanError::from_contract_error(
            Error::AlreadyRegistered as u32,
        )))
    );
}

#[test]
fn test_rate_limit_same_caller_within_window_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, CreatorRegistryContract);
    let client = CreatorRegistryContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let creator1 = Address::generate(&env);
    let creator2 = Address::generate(&env);

    client.initialize(&admin);

    env.ledger().with_mut(|li| li.sequence_number = 100);
    client.register_creator(&admin, &creator1, &111);
    // Same caller (admin), different creator, but within rate limit window -> must fail
    let result = client.try_register_creator(&admin, &creator2, &222);
    assert_eq!(
        result,
        Err(Ok(SorobanError::from_contract_error(
            Error::RateLimited as u32,
        )))
    );
}

#[test]
fn test_rate_limit_after_window_succeeds() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, CreatorRegistryContract);
    let client = CreatorRegistryContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let creator1 = Address::generate(&env);
    let creator2 = Address::generate(&env);

    client.initialize(&admin);

    env.ledger().with_mut(|li| li.sequence_number = 100);
    client.register_creator(&admin, &creator1, &111);
    assert_eq!(client.get_creator_id(&creator1), Some(111));

    // Advance past rate limit window (10 ledgers)
    env.ledger().with_mut(|li| li.sequence_number = 111);
    client.register_creator(&admin, &creator2, &222);
    assert_eq!(client.get_creator_id(&creator1), Some(111));
    assert_eq!(client.get_creator_id(&creator2), Some(222));
}

#[test]
fn test_registration_ledger_key_helper_keeps_legacy_variant() {
    let env = Env::default();
    let caller = Address::generate(&env);

    assert_eq!(
        DataKey::registration_ledger(caller.clone()),
        DataKey::LastRegLedger(caller)
    );
}

#[test]
fn test_update_creator_id_authorized() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, CreatorRegistryContract);
    let client = CreatorRegistryContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let creator = Address::generate(&env);

    client.initialize(&admin);
    client.register_creator(&creator, &creator, &111);

    client.update_creator_id(&creator, &creator, &222);

    assert_eq!(client.get_creator_id(&creator), Some(222));

    let events = env.events().all();
    let found = events.iter().any(|event| {
        let topic: soroban_sdk::Symbol = event.1.get(0).unwrap().try_into_val(&env).unwrap();
        topic == soroban_sdk::Symbol::new(&env, "creator_updated")
    });
    assert!(found, "creator_updated event not emitted");
}

#[test]
fn test_update_creator_id_unauthorized_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, CreatorRegistryContract);
    let client = CreatorRegistryContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let creator = Address::generate(&env);
    let rando = Address::generate(&env);

    client.initialize(&admin);
    client.register_creator(&creator, &creator, &111);

    let result = client.try_update_creator_id(&rando, &creator, &222);
    assert_eq!(
        result,
        Err(Ok(SorobanError::from_contract_error(
            Error::Unauthorized as u32,
        )))
    );
}

#[test]
fn test_update_creator_id_not_registered_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, CreatorRegistryContract);
    let client = CreatorRegistryContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let creator = Address::generate(&env);

    client.initialize(&admin);

    let result = client.try_update_creator_id(&admin, &creator, &222);
    assert_eq!(
        result,
        Err(Ok(SorobanError::from_contract_error(
            Error::NotRegistered as u32,
        )))
    );
}

// ─── Rate limit boundary tests (issue #320) ───────────────────────────────────

/// Advance the ledger sequence by `n` ledgers.
fn advance(env: &Env, n: u32) {
    env.ledger().with_mut(|li| {
        li.sequence_number += n;
    });
}

/// Before boundary: second registration attempted one ledger before the window
/// closes (current < last + 10) must be rejected with RateLimited.
///
/// Sequence timeline:
///   ledger 100 — first registration  (last = 100)
///   ledger 109 — second attempt      (109 < 100 + 10 = 110) → blocked
#[test]
fn rate_limit_before_boundary_is_rejected() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, CreatorRegistryContract);
    let client = CreatorRegistryContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let creator_a = Address::generate(&env);
    let creator_b = Address::generate(&env);

    client.initialize(&admin);

    env.ledger().with_mut(|li| li.sequence_number = 100);
    client.register_creator(&admin, &creator_a, &1u64);

    // Advance to ledger 109 — one before the window closes
    advance(&env, 9);
    assert_eq!(env.ledger().sequence(), 109);

    let result = client.try_register_creator(&admin, &creator_b, &2u64);
    assert_eq!(
        result,
        Err(Ok(SorobanError::from_contract_error(
            ContractError::RateLimited as u32,
        ))),
        "registration one ledger before boundary must be rate-limited"
    );
}

/// At boundary: second registration at exactly last + RATE_LIMIT_LEDGERS must succeed.
///
/// Sequence timeline:
///   ledger 100 — first registration  (last = 100)
///   ledger 110 — second attempt      (110 < 110) → false → allowed
#[test]
fn rate_limit_at_boundary_is_allowed() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, CreatorRegistryContract);
    let client = CreatorRegistryContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let creator_a = Address::generate(&env);
    let creator_b = Address::generate(&env);

    client.initialize(&admin);

    env.ledger().with_mut(|li| li.sequence_number = 100);
    client.register_creator(&admin, &creator_a, &1u64);

    // Advance to exactly ledger 110 — the boundary
    advance(&env, 10);
    assert_eq!(env.ledger().sequence(), 110);

    client.register_creator(&admin, &creator_b, &2u64);

    assert_eq!(
        client.get_creator_id(&creator_b),
        Some(2u64),
        "creator_b must be registered at the boundary ledger"
    );
}

/// After boundary: second registration one ledger past the boundary must succeed.
///
/// Sequence timeline:
///   ledger 100 — first registration  (last = 100)
///   ledger 111 — second attempt      (111 < 110) → false → allowed
#[test]
fn rate_limit_after_boundary_is_allowed() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, CreatorRegistryContract);
    let client = CreatorRegistryContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let creator_a = Address::generate(&env);
    let creator_b = Address::generate(&env);

    client.initialize(&admin);

    env.ledger().with_mut(|li| li.sequence_number = 100);
    client.register_creator(&admin, &creator_a, &1u64);

    // Advance to ledger 111 — one past the boundary
    advance(&env, 11);
    assert_eq!(env.ledger().sequence(), 111);

    client.register_creator(&admin, &creator_b, &2u64);

    assert_eq!(
        client.get_creator_id(&creator_b),
        Some(2u64),
        "creator_b must be registered one ledger past the boundary"
    );
}

/// Error code is deterministic: RateLimited maps to discriminant 4.
/// Pins the wire value so any enum reordering is caught immediately.
#[test]
fn rate_limited_error_code_is_4() {
    assert_eq!(ContractError::RateLimited as u32, 4);
}

/// Rate limit is per-caller: two different callers can each register
/// in the same ledger without triggering the limit for each other.
#[test]
fn rate_limit_is_per_caller_not_global() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, CreatorRegistryContract);
    let client = CreatorRegistryContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let caller_b = Address::generate(&env);
    let creator_a = Address::generate(&env);

    client.initialize(&admin);

    env.ledger().with_mut(|li| li.sequence_number = 100);

    // admin registers creator_a
    client.register_creator(&admin, &creator_a, &1u64);

    // caller_b registers themselves — separate LastRegLedger key, no prior entry
    client.register_creator(&caller_b, &caller_b, &2u64);

    assert_eq!(
        client.get_creator_id(&caller_b),
        Some(2u64),
        "caller_b must be registered independently of admin's rate limit"
    );
}

/// First-ever registration by a caller has no prior ledger stamp and must
/// always succeed regardless of the current sequence number.
#[test]
fn first_registration_is_never_rate_limited() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, CreatorRegistryContract);
    let client = CreatorRegistryContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let creator = Address::generate(&env);

    client.initialize(&admin);

    // Jump to a high ledger — no prior registration so limit cannot apply
    env.ledger().with_mut(|li| li.sequence_number = 99_999);

    client.register_creator(&admin, &creator, &99u64);

    assert_eq!(
        client.get_creator_id(&creator),
        Some(99u64),
        "first registration must always succeed regardless of ledger"
    );
}

/// Consecutive rejections before the boundary are idempotent — trying twice
/// at ledger 109 produces RateLimited both times and does not advance the stamp.
#[test]
fn repeated_attempts_before_boundary_all_rejected() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, CreatorRegistryContract);
    let client = CreatorRegistryContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let creator_a = Address::generate(&env);
    let creator_b = Address::generate(&env);
    let creator_c = Address::generate(&env);

    client.initialize(&admin);

    env.ledger().with_mut(|li| li.sequence_number = 100);
    client.register_creator(&admin, &creator_a, &1u64);

    advance(&env, 9); // ledger 109
    assert_eq!(env.ledger().sequence(), 109);

    let first_attempt = client.try_register_creator(&admin, &creator_b, &2u64);
    let second_attempt = client.try_register_creator(&admin, &creator_c, &3u64);

    assert_eq!(
        first_attempt,
        Err(Ok(SorobanError::from_contract_error(
            ContractError::RateLimited as u32,
        ))),
        "first attempt at ledger 109 must be rate-limited"
    );
    assert_eq!(
        second_attempt,
        Err(Ok(SorobanError::from_contract_error(
            ContractError::RateLimited as u32,
        ))),
        "second attempt at ledger 109 must also be rate-limited"
    );
}