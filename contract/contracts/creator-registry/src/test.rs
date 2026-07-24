use super::Error as ContractError;
use super::*;
use soroban_sdk::token::Client as TokenClient;
use soroban_sdk::{
    testutils::{Address as _, Events, Ledger, MockAuth, MockAuthInvoke},
    token::StellarAssetClient,
    Address, Env, Error as SorobanError, IntoVal, Symbol, TryIntoVal,
};

#[test]
fn test_initialize() {
    let env = Env::default();
    env.mock_all_auths();
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
    env.mock_all_auths();
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

    // High ledger must be set before instance storage is written: jumping here
    // after initialize would exceed the entry TTL and archive keys (SDK 21.7+).
    env.ledger().with_mut(|li| li.sequence_number = 99_999);

    let contract_id = env.register_contract(None, CreatorRegistryContract);
    let client = CreatorRegistryContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let creator = Address::generate(&env);

    client.initialize(&admin);

    // No prior registration for admin — rate limit cannot apply
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

fn setup_token(env: &Env) -> (Address, TokenClient, StellarAssetClient) {
    let token_admin = Address::generate(env);
    let token_id = env
        .register_stellar_asset_contract_v2(token_admin.clone())
        .address();
    (
        token_id.clone(),
        TokenClient::new(env, &token_id),
        StellarAssetClient::new(env, &token_id),
    )
}

#[test]
fn test_registration_fee_transfers_to_contract() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, CreatorRegistryContract);
    let client = CreatorRegistryContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let creator = Address::generate(&env);

    let (token_id, token_client, token_admin_client) = setup_token(&env);
    client.initialize(&admin);
    client.set_spam_fee(&token_id, &100);

    token_admin_client.mint(&creator, &1000);
    client.register_creator(&creator, &creator, &42);

    assert_eq!(client.get_creator_id(&creator), Some(42));
    assert_eq!(token_client.balance(&creator), 900);
    assert_eq!(token_client.balance(&contract_id), 100);
}

#[test]
fn test_registration_fee_insufficient_balance_reverts() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, CreatorRegistryContract);
    let client = CreatorRegistryContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let creator = Address::generate(&env);

    let (token_id, _, token_admin_client) = setup_token(&env);
    client.initialize(&admin);
    client.set_spam_fee(&token_id, &100);

    token_admin_client.mint(&creator, &50);
    let result = client.try_register_creator(&creator, &creator, &42);
    assert!(result.is_err());
    assert_eq!(client.get_creator_id(&creator), None);
}

#[test]
fn test_registration_fee_zero_allows_free_registration() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, CreatorRegistryContract);
    let client = CreatorRegistryContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let creator = Address::generate(&env);

    client.initialize(&admin);
    client.register_creator(&creator, &creator, &7);

    assert_eq!(client.get_creator_id(&creator), Some(7));
}

// ─── Initialize & admin path tests ────────────────────────────────────────────

#[test]
fn initialize_sets_admin_in_storage() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, CreatorRegistryContract);
    let client = CreatorRegistryContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);

    client.initialize(&admin);

    let stored: Address = env.as_contract(&contract_id, || {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("admin must be set after initialize")
    });
    assert_eq!(stored, admin);
}

#[test]
fn initialize_sets_default_rate_limit() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, CreatorRegistryContract);
    let client = CreatorRegistryContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);

    client.initialize(&admin);

    let rate: u32 = env.as_contract(&contract_id, || {
        env.storage()
            .instance()
            .get(&DataKey::RateLimit)
            .expect("RateLimit must be set")
    });
    assert_eq!(rate, DEFAULT_RATE_LIMIT);
}

#[test]
fn initialize_sets_default_spam_fee_to_zero() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, CreatorRegistryContract);
    let client = CreatorRegistryContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);

    client.initialize(&admin);

    let fee: i128 = env.as_contract(&contract_id, || {
        env.storage()
            .instance()
            .get(&DataKey::SpamFee)
            .expect("SpamFee must be set")
    });
    assert_eq!(fee, 0i128);
}

#[test]
fn double_initialize_reverts_with_already_initialized() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, CreatorRegistryContract);
    let client = CreatorRegistryContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);

    client.initialize(&admin);

    let result = client.try_initialize(&admin);
    assert_eq!(
        result,
        Err(Ok(SorobanError::from_contract_error(
            ContractError::AlreadyInitialized as u32,
        ))),
        "second initialize must return AlreadyInitialized (code 1)"
    );
}

#[test]
fn admin_getter_reverts_before_initialize() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, CreatorRegistryContract);
    let client = CreatorRegistryContractClient::new(&env, &contract_id);

    let result = client.try_admin();
    assert_eq!(
        result,
        Err(Ok(SorobanError::from_contract_error(
            ContractError::NotInitialized as u32,
        ))),
        "admin() before initialize must return NotInitialized (code 2)"
    );
}

#[test]
fn admin_getter_returns_correct_address() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, CreatorRegistryContract);
    let client = CreatorRegistryContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);

    client.initialize(&admin);

    assert_eq!(client.admin(), admin);
}

// ─── Unauthorized caller revert tests ─────────────────────────────────────────

#[test]
fn set_rate_limit_reverts_if_not_admin() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, CreatorRegistryContract);
    let client = CreatorRegistryContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);

    client.initialize(&admin);

    // Drop all auths so the admin auth check fails
    use soroban_sdk::xdr::SorobanAuthorizationEntry;
    let empty: &[SorobanAuthorizationEntry] = &[];
    env.set_auths(empty);

    let result = client.try_set_rate_limit(&20u32);
    assert!(result.is_err(), "set_rate_limit without admin auth must revert");
}

#[test]
fn set_spam_fee_reverts_if_not_admin() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, CreatorRegistryContract);
    let client = CreatorRegistryContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);

    let (token_id, _, _) = setup_token(&env);
    client.initialize(&admin);

    use soroban_sdk::xdr::SorobanAuthorizationEntry;
    let empty: &[SorobanAuthorizationEntry] = &[];
    env.set_auths(empty);

    let result = client.try_set_spam_fee(&token_id, &50i128);
    assert!(result.is_err(), "set_spam_fee by non-admin must revert");
}

#[test]
fn unregister_creator_reverts_if_not_admin() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, CreatorRegistryContract);
    let client = CreatorRegistryContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let creator = Address::generate(&env);

    client.initialize(&admin);
    client.register_creator(&creator, &creator, &1u64);

    use soroban_sdk::xdr::SorobanAuthorizationEntry;
    let empty: &[SorobanAuthorizationEntry] = &[];
    env.set_auths(empty);

    let result = client.try_unregister_creator(&creator);
    assert!(
        result.is_err(),
        "unregister_creator by non-admin must revert"
    );
}

#[test]
fn unregister_not_registered_reverts_with_not_registered() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, CreatorRegistryContract);
    let client = CreatorRegistryContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let ghost = Address::generate(&env);

    client.initialize(&admin);

    let result = client.try_unregister_creator(&ghost);
    assert_eq!(
        result,
        Err(Ok(SorobanError::from_contract_error(
            ContractError::NotRegistered as u32,
        ))),
        "unregister of non-existent creator must return NotRegistered (code 6)"
    );
}

#[test]
fn register_creator_reverts_if_not_admin_or_self() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, CreatorRegistryContract);
    let client = CreatorRegistryContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let creator = Address::generate(&env);
    let stranger = Address::generate(&env);

    client.initialize(&admin);

    let result = client.try_register_creator(&stranger, &creator, &1u64);
    assert_eq!(
        result,
        Err(Ok(SorobanError::from_contract_error(
            ContractError::Unauthorized as u32,
        ))),
        "register_creator by stranger must return Unauthorized (code 3)"
    );
}

#[test]
fn set_spam_fee_negative_amount_reverts_with_invalid_amount() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, CreatorRegistryContract);
    let client = CreatorRegistryContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let (token_id, _, _) = setup_token(&env);

    client.initialize(&admin);

    let result = client.try_set_spam_fee(&token_id, &-1i128);
    assert_eq!(
        result,
        Err(Ok(SorobanError::from_contract_error(
            ContractError::InvalidAmount as u32,
        ))),
        "set_spam_fee with negative amount must return InvalidAmount (code 7)"
    );
}

// ─── Event tests ──────────────────────────────────────────────────────────────

fn find_event<'a>(
    env: &'a Env,
    contract_id: &Address,
    topic_name: &str,
) -> Option<(
    Address,
    soroban_sdk::Vec<soroban_sdk::Val>,
    soroban_sdk::Val,
)> {
    let all = env.events().all();
    for i in 0..all.len() {
        let evt = all.get(i).unwrap();
        let (id, topics, _) = &evt;
        if id != contract_id {
            continue;
        }
        let t0: Option<Symbol> = topics.get(0).and_then(|v| v.try_into_val(env).ok());
        if t0 == Some(Symbol::new(env, topic_name)) {
            return Some(evt);
        }
    }
    None
}

#[test]
fn initialize_emits_initialized_event() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, CreatorRegistryContract);
    let client = CreatorRegistryContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);

    client.initialize(&admin);

    let event = find_event(&env, &contract_id, "initialized")
        .expect("initialized event must be emitted");
    let data: InitializedEvent = event.2.try_into_val(&env).unwrap();
    assert_eq!(data.admin, admin);
}

#[test]
fn register_creator_emits_creator_registered_event() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, CreatorRegistryContract);
    let client = CreatorRegistryContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let creator = Address::generate(&env);

    client.initialize(&admin);
    client.register_creator(&admin, &creator, &42u64);

    let event = find_event(&env, &contract_id, "creator_registered")
        .expect("creator_registered event must be emitted");
    let data: CreatorRegisteredEvent = event.2.try_into_val(&env).unwrap();
    assert_eq!(data.caller, admin);
    assert_eq!(data.creator, creator);
    assert_eq!(data.creator_id, 42u64);
}

#[test]
fn unregister_creator_emits_creator_unregistered_event() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, CreatorRegistryContract);
    let client = CreatorRegistryContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let creator = Address::generate(&env);

    client.initialize(&admin);
    client.register_creator(&admin, &creator, &7u64);
    client.unregister_creator(&creator);

    let event = find_event(&env, &contract_id, "creator_unregistered")
        .expect("creator_unregistered event must be emitted");
    let data: CreatorUnregisteredEvent = event.2.try_into_val(&env).unwrap();
    assert_eq!(data.creator, creator);
}

#[test]
fn set_rate_limit_emits_rate_limit_set_event() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, CreatorRegistryContract);
    let client = CreatorRegistryContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);

    client.initialize(&admin);
    client.set_rate_limit(&25u32);

    let event = find_event(&env, &contract_id, "rate_limit_set")
        .expect("rate_limit_set event must be emitted");
    let data: RateLimitSetEvent = event.2.try_into_val(&env).unwrap();
    assert_eq!(data.ledgers, 25u32);
}

#[test]
fn set_spam_fee_emits_spam_fee_set_event() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, CreatorRegistryContract);
    let client = CreatorRegistryContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let (token_id, _, _) = setup_token(&env);

    client.initialize(&admin);
    client.set_spam_fee(&token_id, &200i128);

    let event = find_event(&env, &contract_id, "spam_fee_set")
        .expect("spam_fee_set event must be emitted");
    let data: SpamFeeSetEvent = event.2.try_into_val(&env).unwrap();
    assert_eq!(data.token, token_id);
    assert_eq!(data.amount, 200i128);
}

// ─── initialize admin auth tests (issue #1370) ────────────────────────────────

/// `initialize` must reject a call made without the admin's authorization,
/// and succeed once the admin's authorization is present via `mock_auths`.
#[test]
fn initialize_requires_admin_auth() {
    let env = Env::default();
    let contract_id = env.register_contract(None, CreatorRegistryContract);
    let client = CreatorRegistryContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);

    let empty: &[soroban_sdk::xdr::SorobanAuthorizationEntry] = &[];
    env.set_auths(empty);
    assert!(
        client.try_initialize(&admin).is_err(),
        "initialize must fail without admin auth"
    );

    env.mock_auths(&[MockAuth {
        address: &admin,
        invoke: &MockAuthInvoke {
            contract: &contract_id,
            fn_name: "initialize",
            args: (admin.clone(),).into_val(&env),
            sub_invokes: &[],
        },
    }]);
    client.initialize(&admin);

    assert_eq!(client.admin(), admin);
}

// ─── Globally unique creator_id tests (issue #1371) ────────────────────────────

#[test]
fn duplicate_creator_id_from_different_address_reverts() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, CreatorRegistryContract);
    let client = CreatorRegistryContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let creator_a = Address::generate(&env);
    let creator_b = Address::generate(&env);

    client.initialize(&admin);
    client.register_creator(&creator_a, &creator_a, &777u64);

    let result = client.try_register_creator(&creator_b, &creator_b, &777u64);
    assert_eq!(
        result,
        Err(Ok(SorobanError::from_contract_error(
            ContractError::CreatorIdTaken as u32,
        ))),
        "registering an already-claimed creator_id from a different address must revert"
    );
    assert_eq!(client.get_creator_id(&creator_b), None);
}

#[test]
fn different_creator_ids_succeed() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, CreatorRegistryContract);
    let client = CreatorRegistryContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let creator_a = Address::generate(&env);
    let creator_b = Address::generate(&env);

    client.initialize(&admin);
    client.register_creator(&creator_a, &creator_a, &1u64);
    client.register_creator(&creator_b, &creator_b, &2u64);

    assert_eq!(client.get_creator_id(&creator_a), Some(1u64));
    assert_eq!(client.get_creator_id(&creator_b), Some(2u64));
}

#[test]
fn creator_id_freed_after_unregister_can_be_reused() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, CreatorRegistryContract);
    let client = CreatorRegistryContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let creator_a = Address::generate(&env);
    let creator_b = Address::generate(&env);

    client.initialize(&admin);
    client.register_creator(&creator_a, &creator_a, &42u64);
    client.unregister_creator(&creator_a);

    // creator_id 42 is now unclaimed; a different address may take it.
    client.register_creator(&creator_b, &creator_b, &42u64);
    assert_eq!(client.get_creator_id(&creator_b), Some(42u64));
}

#[test]
fn creator_id_taken_error_code_is_8() {
    assert_eq!(ContractError::CreatorIdTaken as u32, 8);
}

// ─── Spam-fee-before-persistence ordering tests (issue #1372) ─────────────────

#[test]
fn failed_fee_transfer_leaves_no_creator_or_reverse_mapping() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, CreatorRegistryContract);
    let client = CreatorRegistryContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let creator = Address::generate(&env);

    let (token_id, _, token_admin_client) = setup_token(&env);
    client.initialize(&admin);
    client.set_spam_fee(&token_id, &100);

    // Caller cannot cover the fee.
    token_admin_client.mint(&creator, &10);
    let result = client.try_register_creator(&creator, &creator, &55u64);
    assert!(result.is_err());

    assert_eq!(client.get_creator_id(&creator), None);
    env.as_contract(&contract_id, || {
        assert!(
            !env.storage()
                .persistent()
                .has(&DataKey::CreatorIdOwner(55u64)),
            "reverse mapping must not be written when the fee transfer fails"
        );
    });
}

// ─── TTL extension tests (issue #1373) ─────────────────────────────────────────

#[test]
fn register_creator_extends_ttl_on_creator_keys() {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_min_persistent_entry_ttl(100);
    env.ledger().set_max_entry_ttl(1_000_000);
    let contract_id = env.register_contract(None, CreatorRegistryContract);
    let client = CreatorRegistryContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let creator = Address::generate(&env);

    client.initialize(&admin);
    client.register_creator(&creator, &creator, &9u64);

    let creator_key = DataKey::Creator(creator.clone());
    let owner_key = DataKey::CreatorIdOwner(9u64);

    env.as_contract(&contract_id, || {
        assert_eq!(
            env.storage().persistent().get_ttl(&creator_key),
            CREATOR_TTL_EXTEND_TO,
            "Creator key TTL must be extended to CREATOR_TTL_EXTEND_TO on registration"
        );
        assert_eq!(
            env.storage().persistent().get_ttl(&owner_key),
            CREATOR_TTL_EXTEND_TO,
            "CreatorIdOwner key TTL must be extended to CREATOR_TTL_EXTEND_TO on registration"
        );
    });
}

#[test]
fn get_creator_id_refreshes_ttl_after_it_decays_below_threshold() {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_min_persistent_entry_ttl(100);
    env.ledger().set_max_entry_ttl(1_000_000);
    let contract_id = env.register_contract(None, CreatorRegistryContract);
    let client = CreatorRegistryContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let creator = Address::generate(&env);

    client.initialize(&admin);
    client.register_creator(&creator, &creator, &13u64);

    let creator_key = DataKey::Creator(creator.clone());

    // Decay the key's TTL below the refresh threshold. Keep the contract
    // instance itself alive across the jump so the invocation below can run.
    advance(&env, CREATOR_TTL_EXTEND_TO - CREATOR_TTL_THRESHOLD + 1);
    env.as_contract(&contract_id, || {
        env.storage()
            .instance()
            .extend_ttl(CREATOR_TTL_EXTEND_TO, CREATOR_TTL_EXTEND_TO);
        assert!(
            env.storage().persistent().get_ttl(&creator_key) < CREATOR_TTL_THRESHOLD,
            "test setup must decay the Creator key below the refresh threshold"
        );
    });

    client.get_creator_id(&creator);

    let ttl_after_read = env.as_contract(&contract_id, || {
        env.storage().persistent().get_ttl(&creator_key)
    });
    assert_eq!(
        ttl_after_read, CREATOR_TTL_EXTEND_TO,
        "get_creator_id must refresh the Creator key TTL back up after it decays"
    );
}
