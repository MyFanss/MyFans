//! AUTH_MATRIX.md compliance tests.
//!
//! Every public method listed in `contract/AUTH_MATRIX.md` has at least one
//! *valid* invocation test (correct signer succeeds) and one *invalid*
//! invocation test (wrong/missing signer is rejected).
//!
//! Pattern:
//! - Valid tests use `env.mock_all_auths()` or targeted `MockAuth` entries.
//! - Invalid tests call `env.set_auths(&[])` to strip all mocked auth so
//!   `require_auth()` calls fail, then assert `try_*` returns `Err`.

use content_access::{ContentAccess, ContentAccessClient};
use creator_registry::{CreatorRegistryContract, CreatorRegistryContractClient};
use earnings::{Earnings, EarningsClient};
use myfans_token::{MyFansToken, MyFansTokenClient};
use soroban_sdk::{
    testutils::{Address as _, Ledger as _},
    xdr::SorobanAuthorizationEntry,
    Address, Env, String,
};
use subscription::{MyfansContract, MyfansContractClient};

// ── shared helpers ────────────────────────────────────────────────────────────

const EMPTY_AUTHS: &[SorobanAuthorizationEntry] = &[];

fn base_env() -> Env {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().with_mut(|li| {
        li.min_persistent_entry_ttl = 1_000_000;
        li.min_temp_entry_ttl = 1_000_000;
    });
    env
}

fn setup_token(env: &Env) -> (MyFansTokenClient<'_>, Address) {
    let admin = Address::generate(env);
    let id = env.register_contract(None, MyFansToken);
    let client = MyFansTokenClient::new(env, &id);
    client.initialize(
        &admin,
        &String::from_str(env, "MyFans Token"),
        &String::from_str(env, "MFT"),
        &7u32,
        &0i128,
    );
    (client, admin)
}

fn setup_subscription<'a>(
    env: &'a Env,
    token_id: &Address,
    admin: &Address,
    fee_recipient: &Address,
) -> MyfansContractClient<'a> {
    let id = env.register_contract(None, MyfansContract);
    let client = MyfansContractClient::new(env, &id);
    client.init(admin, &500u32, fee_recipient, token_id, &1000i128);
    client
}

fn setup_content<'a>(env: &'a Env, token_id: &Address, admin: &Address) -> ContentAccessClient<'a> {
    let id = env.register_contract(None, ContentAccess);
    let client = ContentAccessClient::new(env, &id);
    client.initialize(admin, token_id);
    client
}

fn setup_registry(env: &Env, admin: &Address) -> CreatorRegistryContractClient<'_> {
    let id = env.register_contract(None, CreatorRegistryContract);
    let client = CreatorRegistryContractClient::new(env, &id);
    client.initialize(admin);
    client
}

fn setup_earnings<'a>(env: &'a Env, admin: &Address) -> EarningsClient<'a> {
    let id = env.register_contract(None, Earnings);
    let client = EarningsClient::new(env, &id);
    client.init(admin);
    client
}

// ═══════════════════════════════════════════════════════════════════════════════
// myfans-token
// ═══════════════════════════════════════════════════════════════════════════════

/// initialize – no auth required; any caller may invoke once.
#[test]
fn token_initialize_valid_any_caller() {
    let env = base_env();
    let admin = Address::generate(&env);
    let id = env.register_contract(None, MyFansToken);
    let client = MyFansTokenClient::new(&env, &id);
    client.initialize(
        &admin,
        &String::from_str(&env, "T"),
        &String::from_str(&env, "T"),
        &7u32,
        &0i128,
    );
    // no panic = success
}

/// set_admin – admin signs and rotates to new_admin.
#[test]
fn token_set_admin_valid_admin_signs() {
    let env = base_env();
    let (client, _admin) = setup_token(&env);
    let new_admin = Address::generate(&env);
    client.set_admin(&new_admin);
    assert_eq!(client.admin(), new_admin);
}

/// set_admin – non-admin (no auth) is rejected.
#[test]
fn token_set_admin_invalid_non_admin_rejected() {
    let env = base_env();
    let (client, _admin) = setup_token(&env);
    let attacker = Address::generate(&env);
    env.set_auths(EMPTY_AUTHS);
    let result = client.try_set_admin(&attacker);
    assert!(result.is_err(), "non-admin must not rotate admin");
}

/// set_metadata – admin signs and updates name/symbol.
#[test]
fn token_set_metadata_valid_admin_signs() {
    let env = base_env();
    let (client, _admin) = setup_token(&env);
    client.set_metadata(
        &String::from_str(&env, "NewName"),
        &String::from_str(&env, "NEW"),
    );
    assert_eq!(client.name(), String::from_str(&env, "NewName"));
}

/// set_metadata – non-admin (no auth) is rejected.
#[test]
fn token_set_metadata_invalid_non_admin_rejected() {
    let env = base_env();
    let (client, _admin) = setup_token(&env);
    env.set_auths(EMPTY_AUTHS);
    let result = client.try_set_metadata(
        &String::from_str(&env, "X"),
        &String::from_str(&env, "X"),
    );
    assert!(result.is_err(), "non-admin must not update metadata");
}

/// name / symbol / decimals / total_supply / balance / allowance – no auth.
#[test]
fn token_read_methods_require_no_auth() {
    let env = base_env();
    let (client, _admin) = setup_token(&env);
    let any = Address::generate(&env);
    env.set_auths(EMPTY_AUTHS);
    // All of these must succeed without any auth.
    let _ = client.name();
    let _ = client.symbol();
    let _ = client.decimals();
    let _ = client.total_supply();
    let _ = client.balance(&any);
    let _ = client.allowance(&any, &any);
}

/// approve – `from` signs and sets allowance.
#[test]
fn token_approve_valid_from_signs() {
    let env = base_env();
    let (client, admin) = setup_token(&env);
    let from = Address::generate(&env);
    let spender = Address::generate(&env);
    client.mint(&from, &1000i128);
    let _ = client.admin(); // ensure admin is set
    let _ = admin; // suppress unused warning
    let exp = env.ledger().sequence() + 100;
    client.approve(&from, &spender, &500i128, &exp);
    assert_eq!(client.allowance(&from, &spender), 500i128);
}

/// approve – spender signing on behalf of `from` is rejected.
#[test]
fn token_approve_invalid_spender_cannot_approve_for_from() {
    let env = base_env();
    let (client, _admin) = setup_token(&env);
    let from = Address::generate(&env);
    let spender = Address::generate(&env);
    env.set_auths(EMPTY_AUTHS);
    let exp = env.ledger().sequence() + 100;
    let result = client.try_approve(&from, &spender, &500i128, &exp);
    assert!(result.is_err(), "spender must not approve on behalf of from");
}

/// transfer_from – spender signs and spends allowance.
#[test]
fn token_transfer_from_valid_spender_signs() {
    let env = base_env();
    let (client, _admin) = setup_token(&env);
    let from = Address::generate(&env);
    let spender = Address::generate(&env);
    let to = Address::generate(&env);
    client.mint(&from, &1000i128);
    let exp = env.ledger().sequence() + 100;
    client.approve(&from, &spender, &300i128, &exp);
    client.transfer_from(&spender, &from, &to, &200i128);
    assert_eq!(client.balance(&to), 200i128);
}

/// transfer_from – `from` signing without spender auth is rejected.
#[test]
fn token_transfer_from_invalid_from_cannot_act_as_spender() {
    let env = base_env();
    let (client, _admin) = setup_token(&env);
    let from = Address::generate(&env);
    let spender = Address::generate(&env);
    let to = Address::generate(&env);
    client.mint(&from, &1000i128);
    let exp = env.ledger().sequence() + 100;
    client.approve(&from, &spender, &300i128, &exp);
    env.set_auths(EMPTY_AUTHS);
    let result = client.try_transfer_from(&spender, &from, &to, &200i128);
    assert!(result.is_err(), "from must not act as spender");
}

/// clear_allowance – `from` signs and zeros allowance.
#[test]
fn token_clear_allowance_valid_from_signs() {
    let env = base_env();
    let (client, _admin) = setup_token(&env);
    let from = Address::generate(&env);
    let spender = Address::generate(&env);
    client.mint(&from, &1000i128);
    let exp = env.ledger().sequence() + 100;
    client.approve(&from, &spender, &500i128, &exp);
    client.clear_allowance(&from, &spender);
    assert_eq!(client.allowance(&from, &spender), 0i128);
}

/// clear_allowance – spender signing on behalf of `from` is rejected.
#[test]
fn token_clear_allowance_invalid_spender_rejected() {
    let env = base_env();
    let (client, _admin) = setup_token(&env);
    let from = Address::generate(&env);
    let spender = Address::generate(&env);
    env.set_auths(EMPTY_AUTHS);
    let result = client.try_clear_allowance(&from, &spender);
    assert!(result.is_err(), "spender must not clear allowance for from");
}

/// mint – admin signs and mints tokens.
#[test]
fn token_mint_valid_admin_signs() {
    let env = base_env();
    let (client, _admin) = setup_token(&env);
    let to = Address::generate(&env);
    client.mint(&to, &500i128);
    assert_eq!(client.balance(&to), 500i128);
}

/// mint – non-admin (no auth) is rejected.
#[test]
fn token_mint_invalid_non_admin_rejected() {
    let env = base_env();
    let (client, _admin) = setup_token(&env);
    let to = Address::generate(&env);
    env.set_auths(EMPTY_AUTHS);
    let result = client.try_mint(&to, &500i128);
    assert!(result.is_err(), "non-admin must not mint");
}

/// burn – `from` signs and burns own tokens.
#[test]
fn token_burn_valid_from_signs() {
    let env = base_env();
    let (client, _admin) = setup_token(&env);
    let from = Address::generate(&env);
    client.mint(&from, &1000i128);
    client.burn(&from, &400i128);
    assert_eq!(client.balance(&from), 600i128);
}

/// burn – another caller (no auth) cannot burn `from` balance.
#[test]
fn token_burn_invalid_third_party_rejected() {
    let env = base_env();
    let (client, _admin) = setup_token(&env);
    let from = Address::generate(&env);
    client.mint(&from, &1000i128);
    env.set_auths(EMPTY_AUTHS);
    let result = client.try_burn(&from, &400i128);
    assert!(result.is_err(), "third party must not burn from's balance");
}

/// transfer – `from` signs and transfers own balance.
#[test]
fn token_transfer_valid_from_signs() {
    let env = base_env();
    let (client, _admin) = setup_token(&env);
    let from = Address::generate(&env);
    let to = Address::generate(&env);
    client.mint(&from, &1000i128);
    client.transfer(&from, &to, &300i128);
    assert_eq!(client.balance(&to), 300i128);
}

/// transfer – third-party caller without `from` auth is rejected.
#[test]
fn token_transfer_invalid_third_party_rejected() {
    let env = base_env();
    let (client, _admin) = setup_token(&env);
    let from = Address::generate(&env);
    let to = Address::generate(&env);
    client.mint(&from, &1000i128);
    env.set_auths(EMPTY_AUTHS);
    let result = client.try_transfer(&from, &to, &300i128);
    assert!(result.is_err(), "third party must not transfer from's balance");
}

// ═══════════════════════════════════════════════════════════════════════════════
// creator-registry
// ═══════════════════════════════════════════════════════════════════════════════

/// initialize – no auth required; any caller may invoke once.
#[test]
fn registry_initialize_valid_any_caller() {
    let env = base_env();
    let admin = Address::generate(&env);
    let id = env.register_contract(None, CreatorRegistryContract);
    let client = CreatorRegistryContractClient::new(&env, &id);
    client.initialize(&admin);
    assert_eq!(client.admin(), admin);
}

/// initialize – re-initialization after already initialized is rejected.
#[test]
fn registry_initialize_invalid_reinit_rejected() {
    let env = base_env();
    let admin = Address::generate(&env);
    let id = env.register_contract(None, CreatorRegistryContract);
    let client = CreatorRegistryContractClient::new(&env, &id);
    client.initialize(&admin);
    let result = client.try_initialize(&admin);
    assert!(result.is_err(), "re-initialization must be rejected");
}

/// register_creator – admin signs and registers a creator.
#[test]
fn registry_register_creator_valid_admin_signs() {
    let env = base_env();
    let admin = Address::generate(&env);
    let registry = setup_registry(&env, &admin);
    let creator = Address::generate(&env);
    registry.register_creator(&admin, &creator, &1u64);
    assert_eq!(registry.get_creator_id(&creator), Some(1u64));
}

/// register_creator – creator registers themselves (caller == creator_address).
#[test]
fn registry_register_creator_valid_self_registration() {
    let env = base_env();
    let admin = Address::generate(&env);
    let registry = setup_registry(&env, &admin);
    let creator = Address::generate(&env);
    registry.register_creator(&creator, &creator, &42u64);
    assert_eq!(registry.get_creator_id(&creator), Some(42u64));
}

/// register_creator – random address trying to register another creator is rejected.
#[test]
fn registry_register_creator_invalid_random_caller_rejected() {
    let env = base_env();
    let admin = Address::generate(&env);
    let registry = setup_registry(&env, &admin);
    let random = Address::generate(&env);
    let victim = Address::generate(&env);
    // random != admin and random != victim, so contract panics with Unauthorized.
    // We still need auth for `caller.require_auth()`, so keep mock_all_auths but
    // pass random as caller — the contract's own check rejects it.
    let result = registry.try_register_creator(&random, &victim, &99u64);
    assert!(result.is_err(), "random caller must not register another creator");
}

/// unregister_creator – admin signs and removes a creator.
#[test]
fn registry_unregister_creator_valid_admin_signs() {
    let env = base_env();
    let admin = Address::generate(&env);
    let registry = setup_registry(&env, &admin);
    let creator = Address::generate(&env);
    registry.register_creator(&admin, &creator, &7u64);
    registry.unregister_creator(&creator);
    assert_eq!(registry.get_creator_id(&creator), None);
}

/// unregister_creator – non-admin (no auth) is rejected.
#[test]
fn registry_unregister_creator_invalid_non_admin_rejected() {
    let env = base_env();
    let admin = Address::generate(&env);
    let registry = setup_registry(&env, &admin);
    let creator = Address::generate(&env);
    registry.register_creator(&admin, &creator, &7u64);
    env.set_auths(EMPTY_AUTHS);
    let result = registry.try_unregister_creator(&creator);
    assert!(result.is_err(), "non-admin must not unregister a creator");
}

/// get_creator_id – no auth required; any caller may read.
#[test]
fn registry_get_creator_id_requires_no_auth() {
    let env = base_env();
    let admin = Address::generate(&env);
    let registry = setup_registry(&env, &admin);
    let creator = Address::generate(&env);
    registry.register_creator(&admin, &creator, &5u64);
    env.set_auths(EMPTY_AUTHS);
    assert_eq!(registry.get_creator_id(&creator), Some(5u64));
}

// ═══════════════════════════════════════════════════════════════════════════════
// subscription
// ═══════════════════════════════════════════════════════════════════════════════

fn sub_setup(env: &Env) -> (MyfansContractClient<'_>, MyFansTokenClient<'_>, Address, Address, Address) {
    let (token, admin) = setup_token(env);
    let fee_recipient = Address::generate(env);
    let sub = setup_subscription(env, &token.address, &admin, &fee_recipient);
    let creator = Address::generate(env);
    let fan = Address::generate(env);
    token.mint(&fan, &10_000i128);
    (sub, token, admin, creator, fan)
}

/// init – no auth required; any caller initializes once.
#[test]
fn sub_init_valid_any_caller() {
    let env = base_env();
    let (token, admin) = setup_token(&env);
    let fee_recipient = Address::generate(&env);
    let id = env.register_contract(None, MyfansContract);
    let client = MyfansContractClient::new(&env, &id);
    client.init(&admin, &500u32, &fee_recipient, &token.address, &1000i128);
    assert_eq!(client.admin(), admin);
}

/// init – re-initialization is rejected.
#[test]
fn sub_init_invalid_reinit_rejected() {
    let env = base_env();
    let (sub, token, admin, _creator, _fan) = sub_setup(&env);
    let fee_recipient = Address::generate(&env);
    let result = sub.try_init(&admin, &500u32, &fee_recipient, &token.address, &1000i128);
    assert!(result.is_err(), "re-init must be rejected");
}

/// create_plan – creator signs and creates a plan.
#[test]
fn sub_create_plan_valid_creator_signs() {
    let env = base_env();
    let (sub, token, _admin, creator, _fan) = sub_setup(&env);
    let plan_id = sub.create_plan(&creator, &token.address, &1000i128, &30u32);
    assert_eq!(plan_id, 1u32);
}

/// create_plan – non-creator (no auth) is rejected.
#[test]
fn sub_create_plan_invalid_non_creator_rejected() {
    let env = base_env();
    let (sub, token, _admin, creator, _fan) = sub_setup(&env);
    env.set_auths(EMPTY_AUTHS);
    let result = sub.try_create_plan(&creator, &token.address, &1000i128, &30u32);
    assert!(result.is_err(), "non-creator must not create a plan");
}

/// subscribe – fan signs and subscribes.
#[test]
fn sub_subscribe_valid_fan_signs() {
    let env = base_env();
    let (sub, token, _admin, creator, fan) = sub_setup(&env);
    let plan_id = sub.create_plan(&creator, &token.address, &1000i128, &30u32);
    sub.subscribe(&fan, &plan_id, &token.address);
    assert!(sub.is_subscriber(&fan, &creator));
}

/// subscribe – another address subscribing as `fan` without fan auth is rejected.
#[test]
fn sub_subscribe_invalid_third_party_rejected() {
    let env = base_env();
    let (sub, token, _admin, creator, fan) = sub_setup(&env);
    let plan_id = sub.create_plan(&creator, &token.address, &1000i128, &30u32);
    env.set_auths(EMPTY_AUTHS);
    let result = sub.try_subscribe(&fan, &plan_id, &token.address);
    assert!(result.is_err(), "third party must not subscribe as fan");
}

/// admin / is_subscriber / is_paused / get_expiry_unix – no auth required.
#[test]
fn sub_read_methods_require_no_auth() {
    let env = base_env();
    let (sub, _token, _admin, creator, fan) = sub_setup(&env);
    env.set_auths(EMPTY_AUTHS);
    let _ = sub.admin();
    let _ = sub.is_subscriber(&fan, &creator);
    let _ = sub.is_paused();
    let _ = sub.get_expiry_unix(&fan, &creator);
}

/// extend_subscription – fan signs and extends.
#[test]
fn sub_extend_subscription_valid_fan_signs() {
    let env = base_env();
    let (sub, token, _admin, creator, fan) = sub_setup(&env);
    let plan_id = sub.create_plan(&creator, &token.address, &1000i128, &30u32);
    sub.subscribe(&fan, &plan_id, &token.address);
    token.mint(&fan, &10_000i128);
    sub.extend_subscription(&fan, &creator, &100u32, &token.address);
    assert!(sub.is_subscriber(&fan, &creator));
}

/// extend_subscription – third party without fan auth is rejected.
#[test]
fn sub_extend_subscription_invalid_third_party_rejected() {
    let env = base_env();
    let (sub, token, _admin, creator, fan) = sub_setup(&env);
    let plan_id = sub.create_plan(&creator, &token.address, &1000i128, &30u32);
    sub.subscribe(&fan, &plan_id, &token.address);
    env.set_auths(EMPTY_AUTHS);
    let result = sub.try_extend_subscription(&fan, &creator, &100u32, &token.address);
    assert!(result.is_err(), "third party must not extend fan subscription");
}

/// cancel – fan signs and cancels own subscription.
#[test]
fn sub_cancel_valid_fan_signs() {
    let env = base_env();
    let (sub, token, _admin, creator, fan) = sub_setup(&env);
    let plan_id = sub.create_plan(&creator, &token.address, &1000i128, &30u32);
    sub.subscribe(&fan, &plan_id, &token.address);
    sub.cancel(&fan, &creator, &0u32);
    assert!(!sub.is_subscriber(&fan, &creator));
}

/// cancel – creator trying to cancel fan subscription without fan auth is rejected.
#[test]
fn sub_cancel_invalid_creator_cannot_cancel_fan() {
    let env = base_env();
    let (sub, token, _admin, creator, fan) = sub_setup(&env);
    let plan_id = sub.create_plan(&creator, &token.address, &1000i128, &30u32);
    sub.subscribe(&fan, &plan_id, &token.address);
    env.set_auths(EMPTY_AUTHS);
    let result = sub.try_cancel(&fan, &creator, &0u32);
    assert!(result.is_err(), "creator must not cancel fan subscription");
}

/// pause – admin signs and pauses.
#[test]
fn sub_pause_valid_admin_signs() {
    let env = base_env();
    let (sub, _token, _admin, _creator, _fan) = sub_setup(&env);
    sub.pause();
    assert!(sub.is_paused());
}

/// pause – non-admin (no auth) is rejected.
#[test]
fn sub_pause_invalid_non_admin_rejected() {
    let env = base_env();
    let (sub, _token, _admin, _creator, _fan) = sub_setup(&env);
    env.set_auths(EMPTY_AUTHS);
    let result = sub.try_pause();
    assert!(result.is_err(), "non-admin must not pause");
}

/// unpause – admin signs and unpauses.
#[test]
fn sub_unpause_valid_admin_signs() {
    let env = base_env();
    let (sub, _token, _admin, _creator, _fan) = sub_setup(&env);
    sub.pause();
    sub.unpause();
    assert!(!sub.is_paused());
}

/// unpause – non-admin (no auth) is rejected.
#[test]
fn sub_unpause_invalid_non_admin_rejected() {
    let env = base_env();
    let (sub, _token, _admin, _creator, _fan) = sub_setup(&env);
    sub.pause();
    env.set_auths(EMPTY_AUTHS);
    let result = sub.try_unpause();
    assert!(result.is_err(), "non-admin must not unpause");
}

/// set_fee_recipient – admin signs and updates fee recipient.
#[test]
fn sub_set_fee_recipient_valid_admin_signs() {
    let env = base_env();
    let (sub, _token, _admin, _creator, _fan) = sub_setup(&env);
    let new_recipient = Address::generate(&env);
    sub.set_fee_recipient(&new_recipient);
}

/// set_fee_recipient – non-admin (no auth) is rejected.
#[test]
fn sub_set_fee_recipient_invalid_non_admin_rejected() {
    let env = base_env();
    let (sub, _token, _admin, _creator, _fan) = sub_setup(&env);
    let new_recipient = Address::generate(&env);
    env.set_auths(EMPTY_AUTHS);
    let result = sub.try_set_fee_recipient(&new_recipient);
    assert!(result.is_err(), "non-admin must not set fee recipient");
}

/// set_fee_bps – admin signs and updates fee.
#[test]
fn sub_set_fee_bps_valid_admin_signs() {
    let env = base_env();
    let (sub, _token, _admin, _creator, _fan) = sub_setup(&env);
    sub.set_fee_bps(&300u32);
}

/// set_fee_bps – non-admin (no auth) is rejected.
#[test]
fn sub_set_fee_bps_invalid_non_admin_rejected() {
    let env = base_env();
    let (sub, _token, _admin, _creator, _fan) = sub_setup(&env);
    env.set_auths(EMPTY_AUTHS);
    let result = sub.try_set_fee_bps(&300u32);
    assert!(result.is_err(), "non-admin must not change fee bps");
}

// ═══════════════════════════════════════════════════════════════════════════════
// content-access
// ═══════════════════════════════════════════════════════════════════════════════

fn content_setup(env: &Env) -> (ContentAccessClient<'_>, MyFansTokenClient<'_>, Address, Address, Address) {
    let (token, admin) = setup_token(env);
    let content = setup_content(env, &token.address, &admin);
    let buyer = Address::generate(env);
    let creator = Address::generate(env);
    token.mint(&buyer, &10_000i128);
    (content, token, admin, buyer, creator)
}

/// initialize – admin signs to initialize.
#[test]
fn content_initialize_valid_admin_signs() {
    let env = base_env();
    let (token, admin) = setup_token(&env);
    let id = env.register_contract(None, ContentAccess);
    let client = ContentAccessClient::new(&env, &id);
    client.initialize(&admin, &token.address);
    assert_eq!(client.admin(), admin);
}

/// initialize – non-admin (no auth) is rejected.
#[test]
fn content_initialize_invalid_non_admin_rejected() {
    let env = base_env();
    let (token, _admin) = setup_token(&env);
    let id = env.register_contract(None, ContentAccess);
    let client = ContentAccessClient::new(&env, &id);
    let non_admin = Address::generate(&env);
    env.set_auths(EMPTY_AUTHS);
    let result = client.try_initialize(&non_admin, &token.address);
    assert!(result.is_err(), "non-admin must not initialize content-access");
}

/// unlock_content – buyer signs and unlocks priced content.
#[test]
fn content_unlock_valid_buyer_signs() {
    let env = base_env();
    let (content, _token, _admin, buyer, creator) = content_setup(&env);
    content.set_content_price(&creator, &1u64, &500i128);
    content.unlock_content(&buyer, &creator, &1u64);
    assert!(content.has_access(&buyer, &creator, &1u64));
}

/// unlock_content – another caller without buyer auth is rejected.
#[test]
fn content_unlock_invalid_third_party_rejected() {
    let env = base_env();
    let (content, _token, _admin, buyer, creator) = content_setup(&env);
    content.set_content_price(&creator, &1u64, &500i128);
    env.set_auths(EMPTY_AUTHS);
    let result = content.try_unlock_content(&buyer, &creator, &1u64);
    assert!(result.is_err(), "third party must not unlock on behalf of buyer");
}

/// has_access / get_content_price / get_max_price – no auth required.
#[test]
fn content_read_methods_require_no_auth() {
    let env = base_env();
    let (content, _token, _admin, buyer, creator) = content_setup(&env);
    env.set_auths(EMPTY_AUTHS);
    let _ = content.has_access(&buyer, &creator, &1u64);
    let _ = content.get_content_price(&creator, &1u64);
    let _ = content.get_max_price();
}

/// set_content_price – creator signs and sets own content price.
#[test]
fn content_set_price_valid_creator_signs() {
    let env = base_env();
    let (content, _token, _admin, _buyer, creator) = content_setup(&env);
    content.set_content_price(&creator, &5u64, &1000i128);
    assert_eq!(content.get_content_price(&creator, &5u64), Some(1000i128));
}

/// set_content_price – non-creator (no auth) is rejected.
#[test]
fn content_set_price_invalid_non_creator_rejected() {
    let env = base_env();
    let (content, _token, _admin, _buyer, creator) = content_setup(&env);
    env.set_auths(EMPTY_AUTHS);
    let result = content.try_set_content_price(&creator, &5u64, &1000i128);
    assert!(result.is_err(), "non-creator must not set content price");
}

/// set_max_price – admin signs and updates max price cap.
#[test]
fn content_set_max_price_valid_admin_signs() {
    let env = base_env();
    let (content, _token, _admin, _buyer, _creator) = content_setup(&env);
    content.set_max_price(&5000i128);
    assert_eq!(content.get_max_price(), Some(5000i128));
}

/// set_max_price – non-admin (no auth) is rejected.
#[test]
fn content_set_max_price_invalid_non_admin_rejected() {
    let env = base_env();
    let (content, _token, _admin, _buyer, _creator) = content_setup(&env);
    env.set_auths(EMPTY_AUTHS);
    let result = content.try_set_max_price(&5000i128);
    assert!(result.is_err(), "non-admin must not set max price");
}

/// set_admin – current admin signs and updates admin.
#[test]
fn content_set_admin_valid_admin_signs() {
    let env = base_env();
    let (content, _token, _admin, _buyer, _creator) = content_setup(&env);
    let new_admin = Address::generate(&env);
    content.set_admin(&new_admin);
    assert_eq!(content.admin(), new_admin);
}

/// set_admin – non-admin (no auth) is rejected.
#[test]
fn content_set_admin_invalid_non_admin_rejected() {
    let env = base_env();
    let (content, _token, _admin, _buyer, _creator) = content_setup(&env);
    let attacker = Address::generate(&env);
    env.set_auths(EMPTY_AUTHS);
    let result = content.try_set_admin(&attacker);
    assert!(result.is_err(), "non-admin must not set new admin");
}

// ═══════════════════════════════════════════════════════════════════════════════
// earnings
// ═══════════════════════════════════════════════════════════════════════════════

/// init – admin signs and initializes.
#[test]
fn earnings_init_valid_admin_signs() {
    let env = base_env();
    let admin = Address::generate(&env);
    let id = env.register_contract(None, Earnings);
    let client = EarningsClient::new(&env, &id);
    client.init(&admin);
    assert_eq!(client.admin(), admin);
}

/// init – non-admin caller (no auth) is rejected.
#[test]
fn earnings_init_invalid_non_admin_rejected() {
    let env = base_env();
    let admin = Address::generate(&env);
    let id = env.register_contract(None, Earnings);
    let client = EarningsClient::new(&env, &id);
    env.set_auths(EMPTY_AUTHS);
    let result = client.try_init(&admin);
    assert!(result.is_err(), "non-admin must not initialize earnings");
}

/// admin / get_earnings – no auth required.
#[test]
fn earnings_read_methods_require_no_auth() {
    let env = base_env();
    let admin = Address::generate(&env);
    let earnings = setup_earnings(&env, &admin);
    let creator = Address::generate(&env);
    env.set_auths(EMPTY_AUTHS);
    let _ = earnings.admin();
    let _ = earnings.get_earnings(&creator);
}

/// record – admin signs and records creator earnings.
#[test]
fn earnings_record_valid_admin_signs() {
    let env = base_env();
    let admin = Address::generate(&env);
    let earnings = setup_earnings(&env, &admin);
    let creator = Address::generate(&env);
    earnings.record(&creator, &500i128);
    assert_eq!(earnings.get_earnings(&creator), 500i128);
}

/// record – non-admin (no auth) is rejected.
#[test]
fn earnings_record_invalid_non_admin_rejected() {
    let env = base_env();
    let admin = Address::generate(&env);
    let earnings = setup_earnings(&env, &admin);
    let creator = Address::generate(&env);
    env.set_auths(EMPTY_AUTHS);
    let result = earnings.try_record(&creator, &500i128);
    assert!(result.is_err(), "non-admin must not record earnings");
}

/// withdraw – creator signs and withdraws own earnings.
#[test]
fn earnings_withdraw_valid_creator_signs() {
    let env = base_env();
    let admin = Address::generate(&env);
    let earnings = setup_earnings(&env, &admin);
    let creator = Address::generate(&env);
    earnings.record(&creator, &1000i128);
    earnings.withdraw(&creator, &400i128);
    assert_eq!(earnings.get_earnings(&creator), 600i128);
}

/// withdraw – another address (no auth) cannot withdraw from creator earnings.
#[test]
fn earnings_withdraw_invalid_third_party_rejected() {
    let env = base_env();
    let admin = Address::generate(&env);
    let earnings = setup_earnings(&env, &admin);
    let creator = Address::generate(&env);
    earnings.record(&creator, &1000i128);
    env.set_auths(EMPTY_AUTHS);
    let result = earnings.try_withdraw(&creator, &400i128);
    assert!(result.is_err(), "third party must not withdraw creator earnings");
    // Balance must be unchanged.
    env.mock_all_auths();
    assert_eq!(earnings.get_earnings(&creator), 1000i128);
}
