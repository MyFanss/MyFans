#![cfg(test)]
use super::*;
use soroban_sdk::{testutils::Address as _, testutils::Ledger, Address, Env};

#[test]
fn test_subscription_flow() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, MyfansContract);
    let client = MyfansContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let creator = Address::generate(&env);
    let fan = Address::generate(&env);
    let fee_recipient = Address::generate(&env);
    let asset = Address::generate(&env);

    client.init(&admin, &250, &fee_recipient);
    let plan_id = client.create_plan(&creator, &asset, &1000, &30);
    assert_eq!(plan_id, 1);

    assert!(!client.is_subscriber(&fan, &creator));
}

#[test]
fn test_is_subscribed_false_when_no_subscription() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, MyfansContract);
    let client = MyfansContractClient::new(&env, &contract_id);

    let fan = Address::generate(&env);
    let creator = Address::generate(&env);

    assert!(!client.is_subscribed(&fan, &creator));
    assert!(!client.is_subscriber(&fan, &creator));
}

#[test]
fn test_get_subscription_expiry_none_when_no_subscription() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, MyfansContract);
    let client = MyfansContractClient::new(&env, &contract_id);

    let fan = Address::generate(&env);
    let creator = Address::generate(&env);

    assert_eq!(client.get_subscription_expiry(&fan, &creator), None);
}

#[test]
#[should_panic(expected = "subscription does not exist")]
fn test_cancel_nonexistent_panics() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, MyfansContract);
    let client = MyfansContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let fee_recipient = Address::generate(&env);
    client.init(&admin, &250, &fee_recipient);

    let fan = Address::generate(&env);
    let creator = Address::generate(&env);

    // No subscription exists → should panic
    client.cancel(&fan, &creator);
}

#[test]
fn test_cancel_removes_subscription() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, MyfansContract);
    let client = MyfansContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let creator = Address::generate(&env);
    let fan = Address::generate(&env);
    let fee_recipient = Address::generate(&env);

    client.init(&admin, &250, &fee_recipient);

    // Manually insert a subscription record so we don't need a real token
    env.as_contract(&contract_id, || {
        let expiry = env.ledger().timestamp() + 86400 * 30;
        let sub = Subscription {
            fan: fan.clone(),
            plan_id: 1,
            expiry,
        };
        env.storage()
            .instance()
            .set(&DataKey::Sub(fan.clone(), creator.clone()), &sub);
    });

    assert!(client.is_subscribed(&fan, &creator));

    client.cancel(&fan, &creator);

    assert!(!client.is_subscribed(&fan, &creator));
    assert_eq!(client.get_subscription_expiry(&fan, &creator), None);
}

#[test]
fn test_get_subscription_expiry_returns_correct_value() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, MyfansContract);
    let client = MyfansContractClient::new(&env, &contract_id);

    let fan = Address::generate(&env);
    let creator = Address::generate(&env);

    let expected_expiry = env.ledger().timestamp() + 86400 * 30;

    // Manually insert a subscription record
    env.as_contract(&contract_id, || {
        let sub = Subscription {
            fan: fan.clone(),
            plan_id: 1,
            expiry: expected_expiry,
        };
        env.storage()
            .instance()
            .set(&DataKey::Sub(fan.clone(), creator.clone()), &sub);
    });

    assert_eq!(
        client.get_subscription_expiry(&fan, &creator),
        Some(expected_expiry)
    );
}

#[test]
fn test_is_subscribed_before_and_after_cancel() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, MyfansContract);
    let client = MyfansContractClient::new(&env, &contract_id);

    let fan = Address::generate(&env);
    let creator = Address::generate(&env);

    // Insert subscription with expiry well in the future
    env.as_contract(&contract_id, || {
        let sub = Subscription {
            fan: fan.clone(),
            plan_id: 1,
            expiry: env.ledger().timestamp() + 86400 * 30,
        };
        env.storage()
            .instance()
            .set(&DataKey::Sub(fan.clone(), creator.clone()), &sub);
    });

    // Before cancel
    assert!(client.is_subscribed(&fan, &creator));
    assert!(client.is_subscriber(&fan, &creator));

    // Cancel
    client.cancel(&fan, &creator);

    // After cancel
    assert!(!client.is_subscribed(&fan, &creator));
    assert!(!client.is_subscriber(&fan, &creator));
}

#[test]
fn test_is_subscribed_returns_false_when_expired() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, MyfansContract);
    let client = MyfansContractClient::new(&env, &contract_id);

    let fan = Address::generate(&env);
    let creator = Address::generate(&env);

    // Insert subscription with an expiry in the past relative to what we'll set
    env.as_contract(&contract_id, || {
        let sub = Subscription {
            fan: fan.clone(),
            plan_id: 1,
            expiry: 500,
        };
        env.storage()
            .instance()
            .set(&DataKey::Sub(fan.clone(), creator.clone()), &sub);
    });

    // Advance ledger past expiry
    env.ledger().with_mut(|li| {
        li.timestamp = 600;
    });

    // Subscription exists but expired
    assert!(!client.is_subscribed(&fan, &creator));
    // get_subscription_expiry still returns stored value
    assert_eq!(client.get_subscription_expiry(&fan, &creator), Some(500));
}
