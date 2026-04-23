//! Cross-contract integration tests using the shared `TestEnv` fixture from
//! `myfans-lib`. Every test starts from `TestEnv::new()` — no per-test
//! boilerplate for env setup, token registration, or address generation.

use content_access::{ContentAccess, ContentAccessClient};
use myfans_lib::test_fixtures::TestEnv;
use myfans_token::{MyFansToken, MyFansTokenClient};
use soroban_sdk::testutils::{Events, Ledger as _};
use soroban_sdk::{String, Symbol, TryIntoVal};
use subscription::{MyfansContract, MyfansContractClient};

// ── helpers ───────────────────────────────────────────────────────────────────

fn setup_token<'a>(f: &'a TestEnv) -> MyFansTokenClient<'a> {
    let id = f.env.register_contract(None, MyFansToken);
    let client = MyFansTokenClient::new(&f.env, &id);
    client.initialize(
        &f.admin,
        &String::from_str(&f.env, "MyFans Token"),
        &String::from_str(&f.env, "MFT"),
        &7u32,
        &0i128,
    );
    client
}

fn setup_subscription<'a>(
    f: &'a TestEnv,
    token_id: &soroban_sdk::Address,
) -> MyfansContractClient<'a> {
    let id = f.env.register_contract(None, MyfansContract);
    let client = MyfansContractClient::new(&f.env, &id);
    client.init(&f.admin, &500u32, &f.fee_recipient, token_id, &1000i128);
    client
}

fn setup_content<'a>(f: &'a TestEnv, token_id: &soroban_sdk::Address) -> ContentAccessClient<'a> {
    let id = f.env.register_contract(None, ContentAccess);
    let client = ContentAccessClient::new(&f.env, &id);
    client.initialize(&f.admin, token_id);
    client
}

// ── tests ─────────────────────────────────────────────────────────────────────

/// Original end-to-end flow rewritten to use `TestEnv`.
#[test]
fn test_subscription_to_content_unlock_flow() {
    let f = TestEnv::new();

    let token = setup_token(&f);
    let sub = setup_subscription(&f, &token.address);
    let content = setup_content(&f, &token.address);

    token.mint(&f.fan, &2_000i128);

    let plan_id = sub.create_plan(&f.creator, &token.address, &1000i128, &30u32);
    sub.subscribe(&f.fan, &plan_id, &token.address);

    assert!(sub.is_subscriber(&f.fan, &f.creator));
    assert_eq!(token.balance(&f.fan), 1_000i128);
    assert_eq!(token.balance(&f.creator), 950i128);
    assert_eq!(token.balance(&f.fee_recipient), 50i128);

    let content_id = 1u64;
    assert!(!content.has_access(&f.fan, &f.creator, &content_id));
    content.set_content_price(&f.creator, &content_id, &500i128);
    content.unlock_content(&f.fan, &f.creator, &content_id);

    assert!(content.has_access(&f.fan, &f.creator, &content_id));
    assert_eq!(token.balance(&f.fan), 500i128);
    assert_eq!(token.balance(&f.creator), 1_450i128);

    let unlocked = f.env.events().all().iter().any(|event| {
        let topic: Symbol = event.1.first().unwrap().try_into_val(&f.env).unwrap();
        topic == Symbol::new(&f.env, "content_unlocked")
    });
    assert!(unlocked, "content_unlocked event must be emitted");
}

/// Two `TestEnv` instances are fully isolated — no shared addresses or state.
#[test]
fn test_fixture_isolation_between_test_envs() {
    let f1 = TestEnv::new();
    let f2 = TestEnv::new();

    let token1 = setup_token(&f1);
    let token2 = setup_token(&f2);

    token1.mint(&f1.fan, &1_000i128);
    token2.mint(&f2.fan, &2_000i128);

    assert_eq!(token1.balance(&f1.fan), 1_000i128);
    assert_eq!(token2.balance(&f2.fan), 2_000i128);
}

/// `advance_ledger` helper moves sequence forward so expiry logic works
/// without manually mutating ledger state in every test.
#[test]
fn test_subscription_expires_after_advance_ledger() {
    let f = TestEnv::new();

    let token = setup_token(&f);
    let sub = setup_subscription(&f, &token.address);

    token.mint(&f.fan, &5_000i128);
    f.env.ledger().with_mut(|li| li.sequence_number = 1_000);

    // 1 day = 17280 ledgers
    let plan_id = sub.create_plan(&f.creator, &token.address, &1000i128, &1u32);
    sub.subscribe(&f.fan, &plan_id, &token.address);

    assert!(sub.is_subscriber(&f.fan, &f.creator), "should be active");

    f.advance_ledger(17_281);

    assert!(
        !sub.is_subscriber(&f.fan, &f.creator),
        "should be expired after advance"
    );
}

/// Balances are consistent across subscription payment and content unlock
/// when both contracts share the same token in one `TestEnv`.
#[test]
fn test_shared_token_balance_consistency_across_contracts() {
    let f = TestEnv::new();

    let token = setup_token(&f);
    let sub = setup_subscription(&f, &token.address);
    let content = setup_content(&f, &token.address);

    token.mint(&f.fan, &3_000i128);

    let plan_id = sub.create_plan(&f.creator, &token.address, &1000i128, &30u32);
    sub.subscribe(&f.fan, &plan_id, &token.address);

    assert_eq!(token.balance(&f.fan), 2_000i128);
    assert_eq!(token.balance(&f.creator), 950i128);
    assert_eq!(token.balance(&f.fee_recipient), 50i128);

    content.set_content_price(&f.creator, &1u64, &500i128);
    content.unlock_content(&f.fan, &f.creator, &1u64);

    assert_eq!(token.balance(&f.fan), 1_500i128);
    assert_eq!(token.balance(&f.creator), 1_450i128);

    content.set_content_price(&f.creator, &2u64, &300i128);
    content.unlock_content(&f.fan, &f.creator, &2u64);

    assert_eq!(token.balance(&f.fan), 1_200i128);
    assert_eq!(token.balance(&f.creator), 1_750i128);
}

/// Cancel subscription via shared fixture and verify state is cleared.
#[test]
fn test_cancel_subscription_via_shared_fixture() {
    let f = TestEnv::new();

    let token = setup_token(&f);
    let sub = setup_subscription(&f, &token.address);

    token.mint(&f.fan, &5_000i128);

    let plan_id = sub.create_plan(&f.creator, &token.address, &1000i128, &30u32);
    sub.subscribe(&f.fan, &plan_id, &token.address);
    assert!(sub.is_subscriber(&f.fan, &f.creator));

    sub.cancel(&f.fan, &f.creator, &0u32);
    assert!(!sub.is_subscriber(&f.fan, &f.creator));
}

/// Duplicate content unlock is idempotent — fan balance unchanged on second call.
#[test]
fn test_duplicate_content_unlock_is_idempotent_via_shared_fixture() {
    let f = TestEnv::new();

    let token = setup_token(&f);
    let sub = setup_subscription(&f, &token.address);
    let content = setup_content(&f, &token.address);

    token.mint(&f.fan, &5_000i128);

    let plan_id = sub.create_plan(&f.creator, &token.address, &1000i128, &30u32);
    sub.subscribe(&f.fan, &plan_id, &token.address);

    content.set_content_price(&f.creator, &1u64, &200i128);
    content.unlock_content(&f.fan, &f.creator, &1u64);
    let balance_after_first = token.balance(&f.fan);

    content.unlock_content(&f.fan, &f.creator, &1u64);
    assert_eq!(
        token.balance(&f.fan),
        balance_after_first,
        "duplicate unlock must not charge fan again"
    );
}
