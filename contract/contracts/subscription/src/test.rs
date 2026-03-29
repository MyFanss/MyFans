#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Events, Ledger, MockAuth, MockAuthInvoke},
    token,
    vec,
    xdr::{ScAddress, SorobanAuthorizationEntry},
    Address, Env, Error as SorobanError, IntoVal, Symbol, TryFromVal, TryIntoVal,
};

fn setup_test() -> (
    Env,
    MyfansContractClient<'static>,
    Address,
    token::Client<'static>,
    token::StellarAssetClient<'static>,
) {
    let env = Env::default();
    env.mock_all_auths();
    // Raise TTL so advancing the ledger sequence never archives instance storage.
    env.ledger().with_mut(|li| {
        li.min_persistent_entry_ttl = 10_000_000;
        li.min_temp_entry_ttl = 10_000_000;
    });

    // Create a mock token
    let admin = Address::generate(&env);
    let token_address = env.register_stellar_asset_contract_v2(admin.clone());
    let token_client = token::Client::new(&env, &token_address.address());
    let token_admin_client = token::StellarAssetClient::new(&env, &token_address.address());

    // Register contract
    let contract_id = env.register_contract(None, MyfansContract);
    let client = MyfansContractClient::new(&env, &contract_id);

    (env, client, admin, token_client, token_admin_client)
}

#[test]
fn test_subscribe_full_flow() {
    let (env, client, admin, token, token_admin) = setup_test();

    let fee_recipient = Address::generate(&env);

    // fee_bps = 500 (5%)
    client.init(&admin, &500, &fee_recipient, &token.address, &1000);

    let creator = Address::generate(&env);
    let fan = Address::generate(&env);

    // Mint tokens to fan
    token_admin.mint(&fan, &10000);

    // Create a plan: 1000 tokens for 30 days
    let plan_id = client.create_plan(&creator, &token.address, &1000, &30);
    assert_eq!(plan_id, 1);

    // Subscribe calls token transfer, so it will deduct from fan
    client.subscribe(&fan, &plan_id, &token.address);

    // Check balances
    // Fan paid 1000, should have 9000
    assert_eq!(token.balance(&fan), 9000);

    // Fee is 5% of 1000 = 50. Creator gets 950.
    assert_eq!(token.balance(&fee_recipient), 50);
    assert_eq!(token.balance(&creator), 950);

    // Verify subscription status
    assert!(client.is_subscriber(&fan, &creator));
}

#[test]
#[should_panic]
fn test_subscribe_insufficient_balance_reverts() {
    let (env, client, admin, token, token_admin) = setup_test();

    let fee_recipient = Address::generate(&env);
    client.init(&admin, &500, &fee_recipient, &token.address, &1000);

    let creator = Address::generate(&env);
    let fan = Address::generate(&env);

    // Fan only has 500, but plan costs 1000
    token_admin.mint(&fan, &500);

    let plan_id = client.create_plan(&creator, &token.address, &1000, &30);

    // This should panic due to token transfer failure automatically mapped inside Soroban
    client.subscribe(&fan, &plan_id, &token.address);
}

#[test]
fn test_platform_fee_zero() {
    let (env, client, admin, token, token_admin) = setup_test();

    let fee_recipient = Address::generate(&env);

    // fee_bps = 0
    client.init(&admin, &0, &fee_recipient, &token.address, &1000);

    let creator = Address::generate(&env);
    let fan = Address::generate(&env);

    token_admin.mint(&fan, &10000);

    let plan_id = client.create_plan(&creator, &token.address, &1000, &30);
    client.subscribe(&fan, &plan_id, &token.address);

    // Fee is 0%. Creator gets all 1000.
    assert_eq!(token.balance(&fee_recipient), 0);
    assert_eq!(token.balance(&creator), 1000);
}

#[test]
fn test_cancel_subscription() {
    let (env, client, admin, token, token_admin) = setup_test();
    let fee_recipient = Address::generate(&env);
    client.init(&admin, &500, &fee_recipient, &token.address, &1000);

    let creator = Address::generate(&env);
    let fan = Address::generate(&env);

    token_admin.mint(&fan, &10000);
    let plan_id = client.create_plan(&creator, &token.address, &1000, &30);
    client.subscribe(&fan, &plan_id, &token.address);

    assert!(client.is_subscriber(&fan, &creator));

    client.cancel(&fan, &creator, &0);
    assert!(!client.is_subscriber(&fan, &creator));
}

#[test]
fn test_create_subscription_payment_flow() {
    let (env, client, admin, token, token_admin) = setup_test();
    let fee_recipient = Address::generate(&env);
    client.init(&admin, &500, &fee_recipient, &token.address, &1000);
    let creator = Address::generate(&env);
    let fan = Address::generate(&env);
    token_admin.mint(&fan, &10000);
    env.ledger().with_mut(|li| {
        li.sequence_number = 1000;
    });
    client.create_subscription(&fan, &creator, &518400);
    assert_eq!(token.balance(&fan), 9000);
    assert_eq!(token.balance(&fee_recipient), 50);
    assert_eq!(token.balance(&creator), 950);
}

#[test]
fn test_is_subscribed_false_after_expiry() {
    let (env, client, admin, token, token_admin) = setup_test();
    let fee_recipient = Address::generate(&env);
    client.init(&admin, &0, &fee_recipient, &token.address, &1000);
    let creator = Address::generate(&env);
    let fan = Address::generate(&env);
    token_admin.mint(&fan, &10000);
    env.ledger().with_mut(|li| {
        li.sequence_number = 1000;
    });
    // Subscribe for exactly 1 day (17280 ledgers); advancing by 17281 expires it.
    client.create_subscription(&fan, &creator, &17280);
    assert!(client.is_subscriber(&fan, &creator));
    env.ledger().with_mut(|li| {
        // Subscription expires at init_sequence + duration_ledgers (1000 + 17280).
        li.sequence_number = 18281;
    });
    assert!(!client.is_subscriber(&fan, &creator));
}

#[test]
#[should_panic]
fn test_create_subscription_insufficient_balance() {
    let (env, client, admin, token, token_admin) = setup_test();
    let fee_recipient = Address::generate(&env);
    let creator = Address::generate(&env);
    let fan = Address::generate(&env);
    client.init(&admin, &500, &fee_recipient, &token.address, &1000);
    token_admin.mint(&fan, &500);
    let plan_id = client.create_plan(&creator, &token.address, &1000, &1);
    client.subscribe(&fan, &plan_id, &token.address);
}

#[test]
fn test_extend_updates_expiry() {
    let (env, client, admin, token, token_admin) = setup_test();
    let fee_recipient = Address::generate(&env);
    client.init(&admin, &0, &fee_recipient, &token.address, &1000);
    let creator = Address::generate(&env);
    let fan = Address::generate(&env);
    token_admin.mint(&fan, &5000);
    env.ledger().with_mut(|li| {
        li.sequence_number = 1000;
    });
    let plan_id = client.create_plan(&creator, &token.address, &1000, &1);
    client.subscribe(&fan, &plan_id, &token.address);
    let initial_expiry = env.as_contract(&client.address, || {
        env.storage()
            .instance()
            .get::<DataKey, Subscription>(&DataKey::Sub(fan.clone(), creator.clone()))
            .unwrap()
            .expiry
    });

    client.extend_subscription(&fan, &creator, &7, &token.address);

    let updated_expiry = env.as_contract(&client.address, || {
        env.storage()
            .instance()
            .get::<DataKey, Subscription>(&DataKey::Sub(fan.clone(), creator.clone()))
            .unwrap()
            .expiry
    });
    assert_eq!(updated_expiry, initial_expiry + 7);
}

#[test]
fn test_create_subscription_no_fee() {
    let (env, client, admin, token, token_admin) = setup_test();
    let fee_recipient = Address::generate(&env);
    let creator = Address::generate(&env);
    let fan = Address::generate(&env);
    client.init(&admin, &0, &fee_recipient, &token.address, &1000);
    token_admin.mint(&fan, &20000);
    let plan_id = client.create_plan(&creator, &token.address, &1000, &1);
    client.subscribe(&fan, &plan_id, &token.address);

    let initial_expiry = env.as_contract(&client.address, || {
        env.storage()
            .instance()
            .get::<DataKey, Subscription>(&DataKey::Sub(fan.clone(), creator.clone()))
            .unwrap()
            .expiry
    });

    client.extend_subscription(&fan, &creator, &17280, &token.address);

    let updated_expiry = env.as_contract(&client.address, || {
        env.storage()
            .instance()
            .get::<DataKey, Subscription>(&DataKey::Sub(fan.clone(), creator.clone()))
            .unwrap()
            .expiry
    });
    assert_eq!(updated_expiry, initial_expiry + 17280);
}

#[test]
fn test_extend_requires_payment() {
    let (env, client, admin, token, token_admin) = setup_test();
    let fee_recipient = Address::generate(&env);
    let creator = Address::generate(&env);
    let fan = Address::generate(&env);
    client.init(&admin, &0, &fee_recipient, &token.address, &1000);
    token_admin.mint(&fan, &20000);
    let plan_id = client.create_plan(&creator, &token.address, &1000, &1);
    client.subscribe(&fan, &plan_id, &token.address);

    assert_eq!(token.balance(&creator), 1000);

    client.extend_subscription(&fan, &creator, &17280, &token.address);

    assert_eq!(token.balance(&creator), 2000);
    assert_eq!(token.balance(&fan), 18000);
}

#[test]
fn test_extend_fails_if_expired() {
    let (env, client, admin, token, token_admin) = setup_test();
    let fee_recipient = Address::generate(&env);
    let creator = Address::generate(&env);
    let fan = Address::generate(&env);
    client.init(&admin, &0, &fee_recipient, &token.address, &1000);
    token_admin.mint(&fan, &20000);
    env.ledger().with_mut(|li| {
        li.sequence_number = 1000;
    });
    let plan_id = client.create_plan(&creator, &token.address, &1000, &1);
    client.subscribe(&fan, &plan_id, &token.address);
    env.as_contract(&client.address, || {
        let expired_sub = Subscription {
            fan: fan.clone(),
            plan_id,
            expiry: 999,
        };
        env.storage()
            .instance()
            .set(&DataKey::Sub(fan.clone(), creator.clone()), &expired_sub);
    });
    let result = client.try_extend_subscription(&fan, &creator, &17280, &token.address);
    assert_eq!(
        result,
        Err(Ok(SorobanError::from_contract_error(
            Error::SubscriptionExpired as u32,
        )))
    );
}

/// Verify subscription state consistency across snapshot restore.
/// Saves state after subscribe with env.to_snapshot(), restores with Env::from_snapshot(), then asserts plan, expiry, and fan (subscription data).
#[test]
fn test_subscription_state_after_snapshot_restore() {
    let (env, client, admin, token, token_admin) = setup_test();
    let fee_recipient = Address::generate(&env);
    client.init(&admin, &500, &fee_recipient, &token.address, &1000);

    let creator = Address::generate(&env);
    let fan = Address::generate(&env);
    token_admin.mint(&fan, &10000);

    let plan_id = client.create_plan(&creator, &token.address, &1000, &30);
    assert_eq!(plan_id, 1);
    client.subscribe(&fan, &plan_id, &token.address);

    let contract_id = client.address.clone();
    let expected_expiry = env.ledger().sequence() + (30 * 17280);
    let sc_fan: ScAddress = fan.clone().try_into().unwrap();
    let sc_creator: ScAddress = creator.clone().try_into().unwrap();
    let sc_contract: ScAddress = contract_id.clone().try_into().unwrap();

    let snapshot = env.to_snapshot();
    let env2 = Env::from_snapshot(snapshot);
    env2.mock_all_auths();

    let contract_id2: Address = Address::try_from_val(&env2, &sc_contract).unwrap();
    let fan2: Address = Address::try_from_val(&env2, &sc_fan).unwrap();
    let creator2: Address = Address::try_from_val(&env2, &sc_creator).unwrap();

    env2.register_contract(Some(&contract_id2), MyfansContract);
    let client2 = MyfansContractClient::new(&env2, &contract_id2);

    assert!(
        client2.is_subscriber(&fan2, &creator2),
        "state after restore: fan should be subscriber"
    );

    let sub = env2.as_contract(&contract_id2, || {
        env2.storage()
            .instance()
            .get::<DataKey, Subscription>(&DataKey::subscription(fan2.clone(), creator2.clone()))
            .unwrap()
    });
    assert_eq!(sub.fan, fan2);
    assert_eq!(sub.plan_id, plan_id);
    assert_eq!(sub.expiry, expected_expiry as u64);

    let plan = env2.as_contract(&contract_id2, || {
        env2.storage()
            .instance()
            .get::<DataKey, Plan>(&DataKey::Plan(plan_id))
            .unwrap()
    });
    assert_eq!(plan.creator, creator2);
    assert_eq!(plan.amount, 1000);
    assert_eq!(plan.interval_days, 30);

    let plan_count: u32 = env2.as_contract(&contract_id2, || {
        env2.storage()
            .instance()
            .get::<DataKey, u32>(&DataKey::PlanCount)
            .unwrap_or(0)
    });
    assert_eq!(plan_count, 1, "plan count matches after restore");
}

// ── #311 – event topic standardization ───────────────────────────────────────

/// Helper: find the first event whose first topic matches `name`.
fn find_event(
    env: &Env,
    name: &str,
) -> Option<(
    Address,
    soroban_sdk::Vec<soroban_sdk::Val>,
    soroban_sdk::Val,
)> {
    env.events().all().iter().find(|e| {
        e.1.first()
            .is_some_and(|t| t.try_into_val(env).ok() == Some(Symbol::new(env, name)))
    })
}

/// `plan_created` — topics: (name, creator)  data: plan_id
#[test]
fn test_plan_created_event_fields() {
    let (env, client, admin, token, _) = setup_test();
    let fee_recipient = Address::generate(&env);
    client.init(&admin, &500, &fee_recipient, &token.address, &1000);
    let creator = Address::generate(&env);

    let plan_id = client.create_plan(&creator, &token.address, &1000, &30);

    let ev = find_event(&env, "plan_created").expect("plan_created event not emitted");

    assert_eq!(ev.1.len(), 2, "expected 2 topics: (name, creator)");
    let t_name: Symbol = ev.1.get(0).unwrap().try_into_val(&env).unwrap();
    assert_eq!(t_name, Symbol::new(&env, "plan_created"));
    let t_creator: Address = ev.1.get(1).unwrap().try_into_val(&env).unwrap();
    assert_eq!(t_creator, creator, "creator mismatch in topics");

    let d_plan_id: u32 = ev.2.try_into_val(&env).unwrap();
    assert_eq!(d_plan_id, plan_id, "plan_id mismatch in data");
}

/// `subscribed` (plan-based) — topics: (name, fan, creator)  data: plan_id
#[test]
fn test_subscribed_event_fields() {
    let (env, client, admin, token, token_admin) = setup_test();
    let fee_recipient = Address::generate(&env);
    client.init(&admin, &0, &fee_recipient, &token.address, &1000);
    let creator = Address::generate(&env);
    let fan = Address::generate(&env);
    token_admin.mint(&fan, &5000);

    let plan_id = client.create_plan(&creator, &token.address, &1000, &30);
    client.subscribe(&fan, &plan_id, &token.address);

    let ev = find_event(&env, "subscribed").expect("subscribed event not emitted");

    assert_eq!(ev.1.len(), 3, "expected 3 topics: (name, fan, creator)");
    let t_name: Symbol = ev.1.get(0).unwrap().try_into_val(&env).unwrap();
    assert_eq!(t_name, Symbol::new(&env, "subscribed"));
    let t_fan: Address = ev.1.get(1).unwrap().try_into_val(&env).unwrap();
    assert_eq!(t_fan, fan, "fan mismatch in topics");
    let t_creator: Address = ev.1.get(2).unwrap().try_into_val(&env).unwrap();
    assert_eq!(t_creator, creator, "creator mismatch in topics");

    let d_plan_id: u32 = ev.2.try_into_val(&env).unwrap();
    assert_eq!(d_plan_id, plan_id, "plan_id mismatch in data");
}

/// `extended` — topics: (name, fan, creator)  data: plan_id
#[test]
fn test_extended_event_fields() {
    let (env, client, admin, token, token_admin) = setup_test();
    let fee_recipient = Address::generate(&env);
    client.init(&admin, &0, &fee_recipient, &token.address, &1000);
    let creator = Address::generate(&env);
    let fan = Address::generate(&env);
    token_admin.mint(&fan, &20000);

    let plan_id = client.create_plan(&creator, &token.address, &1000, &30);
    client.subscribe(&fan, &plan_id, &token.address);
    client.extend_subscription(&fan, &creator, &1000, &token.address);

    // find the most recent subscribed-family event: extended
    let ev = find_event(&env, "extended").expect("extended event not emitted");

    assert_eq!(ev.1.len(), 3, "expected 3 topics: (name, fan, creator)");
    let t_name: Symbol = ev.1.get(0).unwrap().try_into_val(&env).unwrap();
    assert_eq!(t_name, Symbol::new(&env, "extended"));
    let t_fan: Address = ev.1.get(1).unwrap().try_into_val(&env).unwrap();
    assert_eq!(t_fan, fan, "fan mismatch in topics");
    let t_creator: Address = ev.1.get(2).unwrap().try_into_val(&env).unwrap();
    assert_eq!(t_creator, creator, "creator mismatch in topics");

    let d_plan_id: u32 = ev.2.try_into_val(&env).unwrap();
    assert_eq!(d_plan_id, plan_id, "plan_id mismatch in data");
}

/// `cancelled` — topics: (name, fan, creator)  data: true
#[test]
fn test_cancelled_event_fields() {
    let (env, client, admin, token, token_admin) = setup_test();
    let fee_recipient = Address::generate(&env);
    client.init(&admin, &0, &fee_recipient, &token.address, &1000);
    let creator = Address::generate(&env);
    let fan = Address::generate(&env);
    token_admin.mint(&fan, &5000);

    let plan_id = client.create_plan(&creator, &token.address, &1000, &30);
    client.subscribe(&fan, &plan_id, &token.address);
    client.cancel(&fan, &creator, &1);

    let ev = find_event(&env, "cancelled").expect("cancelled event not emitted");

    assert_eq!(ev.1.len(), 3, "expected 3 topics: (name, fan, creator)");
    let t_name: Symbol = ev.1.get(0).unwrap().try_into_val(&env).unwrap();
    assert_eq!(t_name, Symbol::new(&env, "cancelled"));
    let t_fan: Address = ev.1.get(1).unwrap().try_into_val(&env).unwrap();
    assert_eq!(t_fan, fan, "fan mismatch in topics");
    let t_creator: Address = ev.1.get(2).unwrap().try_into_val(&env).unwrap();
    assert_eq!(t_creator, creator, "creator mismatch in topics");

    let d: (bool, u32) = ev.2.try_into_val(&env).unwrap();
    assert!(d.0, "data.0 should be true");
    assert_eq!(d.1, 1, "data.1 reason code mismatch");
}

// ── #286 – Cancel reason event assertions ───────────────────────────────────

/// Cancel with reason code 0 (user-initiated) emits correct event payload.
#[test]
fn test_cancel_reason_code_zero() {
    let (env, client, admin, token, token_admin) = setup_test();
    let fee_recipient = Address::generate(&env);
    client.init(&admin, &0, &fee_recipient, &token.address, &1000);
    let creator = Address::generate(&env);
    let fan = Address::generate(&env);
    token_admin.mint(&fan, &5000);

    let plan_id = client.create_plan(&creator, &token.address, &1000, &30);
    client.subscribe(&fan, &plan_id, &token.address);
    client.cancel(&fan, &creator, &0);

    let ev = find_event(&env, "cancelled").expect("cancelled event not emitted");
    let d: (bool, u32) = ev.2.try_into_val(&env).unwrap();
    assert!(d.0, "data.0 should be true");
    assert_eq!(d.1, 0, "reason code should be 0 (user-initiated)");
}

/// Cancel with a higher reason code (e.g. 4 = other) propagates correctly.
#[test]
fn test_cancel_reason_code_other() {
    let (env, client, admin, token, token_admin) = setup_test();
    let fee_recipient = Address::generate(&env);
    client.init(&admin, &0, &fee_recipient, &token.address, &1000);
    let creator = Address::generate(&env);
    let fan = Address::generate(&env);
    token_admin.mint(&fan, &5000);

    let plan_id = client.create_plan(&creator, &token.address, &1000, &30);
    client.subscribe(&fan, &plan_id, &token.address);
    client.cancel(&fan, &creator, &4);

    let ev = find_event(&env, "cancelled").expect("cancelled event not emitted");
    let d: (bool, u32) = ev.2.try_into_val(&env).unwrap();
    assert!(d.0, "data.0 should be true");
    assert_eq!(d.1, 4, "reason code should be 4 (other)");
}

/// Cancel event topics still contain fan and creator for backward compatibility.
#[test]
fn test_cancel_event_topics_backward_compatible() {
    let (env, client, admin, token, token_admin) = setup_test();
    let fee_recipient = Address::generate(&env);
    client.init(&admin, &0, &fee_recipient, &token.address, &1000);
    let creator = Address::generate(&env);
    let fan = Address::generate(&env);
    token_admin.mint(&fan, &5000);

    let plan_id = client.create_plan(&creator, &token.address, &1000, &30);
    client.subscribe(&fan, &plan_id, &token.address);
    client.cancel(&fan, &creator, &2);

    let ev = find_event(&env, "cancelled").expect("cancelled event not emitted");

    // Topics structure unchanged: (name, fan, creator)
    assert_eq!(ev.1.len(), 3, "topics count must stay 3 for backward compat");
    let t_name: Symbol = ev.1.get(0).unwrap().try_into_val(&env).unwrap();
    assert_eq!(t_name, Symbol::new(&env, "cancelled"));
    let t_fan: Address = ev.1.get(1).unwrap().try_into_val(&env).unwrap();
    assert_eq!(t_fan, fan, "fan mismatch");
    let t_creator: Address = ev.1.get(2).unwrap().try_into_val(&env).unwrap();
    assert_eq!(t_creator, creator, "creator mismatch");

    // Data is now (true, reason) — parsers that only read the first element
    // still see a truthy value, maintaining backward compatibility.
    let d: (bool, u32) = ev.2.try_into_val(&env).unwrap();
    assert!(d.0);
    assert_eq!(d.1, 2);
}

/// `subscribed` (direct via create_subscription) — topics: (name, fan, creator)  data: 0u32
#[test]
fn test_create_subscription_emits_subscribed_event() {
    let (env, client, admin, token, token_admin) = setup_test();
    let fee_recipient = Address::generate(&env);
    client.init(&admin, &0, &fee_recipient, &token.address, &1000);
    let creator = Address::generate(&env);
    let fan = Address::generate(&env);
    token_admin.mint(&fan, &5000);

    env.ledger().with_mut(|li| li.sequence_number = 1000);
    client.create_subscription(&fan, &creator, &518400);

    let ev = find_event(&env, "subscribed")
        .expect("subscribed event not emitted by create_subscription");

    assert_eq!(ev.1.len(), 3, "expected 3 topics: (name, fan, creator)");
    let t_fan: Address = ev.1.get(1).unwrap().try_into_val(&env).unwrap();
    assert_eq!(t_fan, fan, "fan mismatch in topics");
    let t_creator: Address = ev.1.get(2).unwrap().try_into_val(&env).unwrap();
    assert_eq!(t_creator, creator, "creator mismatch in topics");

    let d_plan_id: u32 = ev.2.try_into_val(&env).unwrap();
    assert_eq!(d_plan_id, 0u32, "direct sub should have plan_id=0 in data");
}

#[test]
fn test_subscription_key_helper_keeps_legacy_variant() {
    let env = Env::default();
    let fan = Address::generate(&env);
    let creator = Address::generate(&env);

    assert_eq!(
        DataKey::subscription(fan.clone(), creator.clone()),
        DataKey::Sub(fan, creator)
    );
}

/// Cancel after snapshot restore and assert subscription state is cleared.
#[test]
fn test_cancel_after_snapshot_restore() {
    let (env, client, admin, token, token_admin) = setup_test();
    let fee_recipient = Address::generate(&env);
    client.init(&admin, &500, &fee_recipient, &token.address, &1000);

    let creator = Address::generate(&env);
    let fan = Address::generate(&env);
    token_admin.mint(&fan, &10000);

    let plan_id = client.create_plan(&creator, &token.address, &1000, &30);
    client.subscribe(&fan, &plan_id, &token.address);
    assert!(client.is_subscriber(&fan, &creator));

    let contract_id = client.address.clone();
    let sc_fan: ScAddress = fan.clone().try_into().unwrap();
    let sc_creator: ScAddress = creator.clone().try_into().unwrap();
    let sc_contract: ScAddress = contract_id.clone().try_into().unwrap();

    let snapshot = env.to_snapshot();
    let env2 = Env::from_snapshot(snapshot);
    env2.mock_all_auths();

    let contract_id2: Address = Address::try_from_val(&env2, &sc_contract).unwrap();
    let fan2: Address = Address::try_from_val(&env2, &sc_fan).unwrap();
    let creator2: Address = Address::try_from_val(&env2, &sc_creator).unwrap();

    env2.register_contract(Some(&contract_id2), MyfansContract);
    let client2 = MyfansContractClient::new(&env2, &contract_id2);
    assert!(
        client2.is_subscriber(&fan2, &creator2),
        "state matches after restore"
    );

    client2.cancel(&fan2, &creator2, &0);
    assert!(
        !client2.is_subscriber(&fan2, &creator2),
        "cancel after restore: subscription should be removed"
    );
}

// ── #287 – paused state enforcement ──────────────────────────────────────────

/// Helper: initialise contract, create a plan, mint tokens to fan, then pause.
fn setup_paused() -> (
    Env,
    MyfansContractClient<'static>,
    Address,
    Address,
    Address,
    token::Client<'static>,
    token::StellarAssetClient<'static>,
) {
    let (env, client, admin, token, token_admin) = setup_test();
    let fee_recipient = Address::generate(&env);
    client.init(&admin, &500, &fee_recipient, &token.address, &1000);
    let creator = Address::generate(&env);
    let fan = Address::generate(&env);
    token_admin.mint(&fan, &50000);
    client.pause();
    (env, client, admin, creator, fan, token, token_admin)
}

#[test]
#[should_panic]
fn test_create_plan_fails_when_paused() {
    let (_env, client, _admin, creator, _fan, token, _token_admin) = setup_paused();
    client.create_plan(&creator, &token.address, &1000, &30);
}

#[test]
#[should_panic]
fn test_subscribe_fails_when_paused() {
    let (env, client, admin, token, token_admin) = setup_test();
    let fee_recipient = Address::generate(&env);
    let creator = Address::generate(&env);
    let fan = Address::generate(&env);
    client.init(&admin, &500, &fee_recipient, &token.address, &1000);
    token_admin.mint(&fan, &50000);
    // create plan before pausing
    let plan_id = client.create_plan(&creator, &token.address, &1000, &30);
    client.pause();
    client.subscribe(&fan, &plan_id, &token.address);
}

#[test]
#[should_panic(expected = "contract is paused")]
fn test_extend_subscription_fails_when_paused() {
    let (env, client, admin, token, token_admin) = setup_test();
    let fee_recipient = Address::generate(&env);
    let creator = Address::generate(&env);
    let fan = Address::generate(&env);
    client.init(&admin, &0, &fee_recipient, &token.address, &1000);
    token_admin.mint(&fan, &50000);
    let plan_id = client.create_plan(&creator, &token.address, &1000, &30);
    client.subscribe(&fan, &plan_id, &token.address);
    client.pause();
    client.extend_subscription(&fan, &creator, &17280, &token.address);
}

#[test]
#[should_panic]
fn test_cancel_fails_when_paused() {
    let (env, client, admin, token, token_admin) = setup_test();
    let fee_recipient = Address::generate(&env);
    let creator = Address::generate(&env);
    let fan = Address::generate(&env);
    client.init(&admin, &0, &fee_recipient, &token.address, &1000);
    token_admin.mint(&fan, &50000);
    let plan_id = client.create_plan(&creator, &token.address, &1000, &30);
    client.subscribe(&fan, &plan_id, &token.address);
    client.pause();
    client.cancel(&fan, &creator, &0);
}

#[test]
#[should_panic]
fn test_create_subscription_fails_when_paused() {
    let (_env, client, _admin, creator, fan, _token, _token_admin) = setup_paused();
    client.create_subscription(&fan, &creator, &518400);
}

/// Views must remain available while paused.
#[test]
fn test_views_available_when_paused() {
    let (env, client, admin, token, token_admin) = setup_test();
    let fee_recipient = Address::generate(&env);
    let creator = Address::generate(&env);
    let fan = Address::generate(&env);
    client.init(&admin, &0, &fee_recipient, &token.address, &1000);
    token_admin.mint(&fan, &50000);
    let plan_id = client.create_plan(&creator, &token.address, &1000, &30);
    client.subscribe(&fan, &plan_id, &token.address);

    client.pause();

    // is_paused view works
    assert!(client.is_paused());
    // is_subscriber view works
    assert!(client.is_subscriber(&fan, &creator));
}

/// Mutations succeed again after unpause.
#[test]
fn test_mutations_succeed_after_unpause() {
    let (env, client, admin, token, token_admin) = setup_test();
    let fee_recipient = Address::generate(&env);
    let creator = Address::generate(&env);
    let fan = Address::generate(&env);
    client.init(&admin, &0, &fee_recipient, &token.address, &1000);
    token_admin.mint(&fan, &50000);

    client.pause();
    assert!(client.is_paused());

    client.unpause();
    assert!(!client.is_paused());

    // mutations work again
    let plan_id = client.create_plan(&creator, &token.address, &1000, &30);
    client.subscribe(&fan, &plan_id, &token.address);
    assert!(client.is_subscriber(&fan, &creator));
}

// ── set_fee_recipient (admin fee recipient rotation) ─────────────────────────

#[test]
fn test_set_fee_recipient_admin_updates_storage_emits_event_and_routes_fees() {
    let (env, client, admin, token, token_admin) = setup_test();
    let fee_recipient = Address::generate(&env);
    let new_recipient = Address::generate(&env);
    client.init(&admin, &500, &fee_recipient, &token.address, &1000);

    client.set_fee_recipient(&new_recipient);

    let stored: Address = env.as_contract(&client.address, || {
        env.storage()
            .instance()
            .get::<DataKey, Address>(&DataKey::FeeRecipient)
            .unwrap()
    });
    assert_eq!(stored, new_recipient);

    let ev = find_event(&env, "fee_recipient_updated")
        .expect("fee_recipient_updated event not emitted");
    assert_eq!(ev.1.len(), 3, "topics: name, old, new");
    let t_old: Address = ev.1.get(1).unwrap().try_into_val(&env).unwrap();
    let t_new: Address = ev.1.get(2).unwrap().try_into_val(&env).unwrap();
    assert_eq!(t_old, fee_recipient);
    assert_eq!(t_new, new_recipient);

    let creator = Address::generate(&env);
    let fan = Address::generate(&env);
    token_admin.mint(&fan, &10000);
    let plan_id = client.create_plan(&creator, &token.address, &1000, &30);
    client.subscribe(&fan, &plan_id, &token.address);
    assert_eq!(token.balance(&new_recipient), 50);
    assert_eq!(token.balance(&fee_recipient), 0);
}

#[test]
#[should_panic]
fn test_init_rejects_null_fee_recipient() {
    let (env, client, admin, token, _token_admin) = setup_test();
    let null_addr = Address::from_string(&soroban_sdk::String::from_str(
        &env,
        "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
    ));
    client.init(&admin, &500, &null_addr, &token.address, &1000);
}

#[test]
fn test_set_fee_recipient_rejects_null_address() {
    let (env, client, admin, token, _) = setup_test();
    let fee_recipient = Address::generate(&env);
    client.init(&admin, &500, &fee_recipient, &token.address, &1000);
    let null_addr = Address::from_string(&soroban_sdk::String::from_str(
        &env,
        "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
    ));
    let r = client.try_set_fee_recipient(&null_addr);
    assert_eq!(
        r,
        Err(Ok(SorobanError::from_contract_error(
            Error::InvalidFeeRecipient as u32,
        )))
    );
}

#[test]
fn test_set_fee_recipient_non_admin_rejected() {
    let (env, client, admin, token, _) = setup_test();
    let fee_recipient = Address::generate(&env);
    let new_recipient = Address::generate(&env);
    client.init(&admin, &500, &fee_recipient, &token.address, &1000);

    let attacker = Address::generate(&env);
    let contract_id = client.address.clone();
    let invoke = MockAuthInvoke {
        contract: &contract_id,
        fn_name: "set_fee_recipient",
        args: vec![&env, new_recipient.clone().into_val(&env)],
        sub_invokes: &[],
    };
    env.mock_auths(&[MockAuth {
        address: &attacker,
        invoke: &invoke,
    }]);

    let r = client.try_set_fee_recipient(&new_recipient);
    assert!(r.is_err(), "only admin may rotate fee recipient");
}

#[test]
fn test_set_fee_recipient_requires_admin_authorization() {
    let (env, client, admin, token, _) = setup_test();
    let fee_recipient = Address::generate(&env);
    let new_recipient = Address::generate(&env);
    client.init(&admin, &500, &fee_recipient, &token.address, &1000);

    let empty: &[SorobanAuthorizationEntry] = &[];
    env.set_auths(empty);

    let r = client.try_set_fee_recipient(&new_recipient);
    assert!(
        r.is_err(),
        "set_fee_recipient must fail without authorization entry"
    );
}

// ── set_fee_bps (admin protocol fee bounds) ───────────────────────────────────

#[test]
fn test_set_fee_bps_admin_updates_storage_emits_event_and_fees() {
    let (env, client, admin, token, token_admin) = setup_test();
    let fee_recipient = Address::generate(&env);
    client.init(&admin, &500, &fee_recipient, &token.address, &1000);

    client.set_fee_bps(&250u32);

    let stored: u32 = env.as_contract(&client.address, || {
        env.storage()
            .instance()
            .get::<DataKey, u32>(&DataKey::FeeBps)
            .unwrap()
    });
    assert_eq!(stored, 250);

    let ev = find_event(&env, "fee_updated").expect("fee_updated event not emitted");
    assert_eq!(ev.1.len(), 1, "topics: name only");
    let (old_bps, new_bps): (u32, u32) = ev.2.try_into_val(&env).unwrap();
    assert_eq!(old_bps, 500);
    assert_eq!(new_bps, 250);

    let creator = Address::generate(&env);
    let fan = Address::generate(&env);
    token_admin.mint(&fan, &10000);
    let plan_id = client.create_plan(&creator, &token.address, &1000, &30);
    client.subscribe(&fan, &plan_id, &token.address);
    assert_eq!(token.balance(&fee_recipient), 25);
    assert_eq!(token.balance(&creator), 975);
}

#[test]
fn test_set_fee_bps_accepts_boundary_10000() {
    let (env, client, admin, token, _) = setup_test();
    let fee_recipient = Address::generate(&env);
    client.init(&admin, &0, &fee_recipient, &token.address, &1000);
    client.set_fee_bps(&10_000u32);

    let stored: u32 = env.as_contract(&client.address, || {
        env.storage()
            .instance()
            .get::<DataKey, u32>(&DataKey::FeeBps)
            .unwrap()
    });
    assert_eq!(stored, 10_000);
}

#[test]
fn test_set_fee_bps_rejects_over_10000() {
    let (env, client, admin, token, _) = setup_test();
    let fee_recipient = Address::generate(&env);
    client.init(&admin, &100, &fee_recipient, &token.address, &1000);

    let r = client.try_set_fee_bps(&10_001u32);
    assert_eq!(
        r,
        Err(Ok(SorobanError::from_contract_error(
            Error::InvalidFeeBps as u32,
        )))
    );
}

#[test]
fn test_init_rejects_fee_bps_over_10000() {
    let (env, client, admin, token, _) = setup_test();
    let fee_recipient = Address::generate(&env);
    let r = client.try_init(&admin, &10_001u32, &fee_recipient, &token.address, &1000);
    assert_eq!(
        r,
        Err(Ok(SorobanError::from_contract_error(
            Error::InvalidFeeBps as u32,
        )))
    );
}

#[test]
fn test_set_fee_bps_non_admin_rejected() {
    let (env, client, admin, token, _) = setup_test();
    let fee_recipient = Address::generate(&env);
    client.init(&admin, &500, &fee_recipient, &token.address, &1000);

    let attacker = Address::generate(&env);
    let contract_id = client.address.clone();
    let invoke = MockAuthInvoke {
        contract: &contract_id,
        fn_name: "set_fee_bps",
        args: vec![&env, 100u32.into_val(&env)],
        sub_invokes: &[],
    };
    env.mock_auths(&[MockAuth {
        address: &attacker,
        invoke: &invoke,
    }]);

    let r = client.try_set_fee_bps(&100u32);
    assert!(r.is_err(), "only admin may update fee bps");
}

#[test]
fn test_set_fee_bps_requires_admin_authorization() {
    let (env, client, admin, token, _) = setup_test();
    let fee_recipient = Address::generate(&env);
    client.init(&admin, &500, &fee_recipient, &token.address, &1000);

    let empty: &[SorobanAuthorizationEntry] = &[];
    env.set_auths(empty);

    let r = client.try_set_fee_bps(&100u32);
    assert!(r.is_err(), "set_fee_bps must fail without authorization entry");
}

// ── admin() view ──────────────────────────────────────────────────────────

/// admin() returns the address that was passed to init().
#[test]
fn admin_returns_initialized_address() {
    let (env, client, admin, _token_client, token_admin_client) = setup_test();

    // init the contract using the existing test setup pattern
    let fee_recipient = Address::generate(&env);
    token_admin_client.mint(&admin, &1_000i128);

    client.init(
        &admin,
        &0u32,
        &fee_recipient,
        &_token_client.address,
        &1_000i128,
    );

    assert_eq!(
        client.admin(),
        admin,
        "admin() must return the address set during init"
    );
}

/// admin() requires no auth — calling it without any auth context must succeed.
#[test]
fn admin_requires_no_auth() {
    let (env, client, admin, _token_client, _token_admin_client) = setup_test();
    let fee_recipient = Address::generate(&env);

    client.init(
        &admin,
        &0u32,
        &fee_recipient,
        &_token_client.address,
        &1_000i128,
    );

    // No specific auth configured — must still succeed
    assert_eq!(client.admin(), admin);
}

/// admin() is stable across unrelated state changes (pause/unpause).
#[test]
fn admin_is_stable_after_pause_and_unpause() {
    let (env, client, admin, _token_client, _token_admin_client) = setup_test();
    let fee_recipient = Address::generate(&env);

    client.init(
        &admin,
        &0u32,
        &fee_recipient,
        &_token_client.address,
        &1_000i128,
    );

    client.pause();
    assert_eq!(client.admin(), admin, "admin() must be unchanged after pause");

    client.unpause();
    assert_eq!(client.admin(), admin, "admin() must be unchanged after unpause");
}
