use content_access::{ContentAccess, ContentAccessClient};
use myfans_token::{MyFansToken, MyFansTokenClient};
use soroban_sdk::{
    testutils::{Address as _, Events, Ledger},
    Address,
    Env,
    String,
    Symbol,
    TryIntoVal,
};
use subscription::{MyfansContract, MyfansContractClient};

#[test]
fn test_subscription_to_content_unlock_flow() {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().with_mut(|li| {
        li.min_persistent_entry_ttl = 10_000_000;
        li.min_temp_entry_ttl = 10_000_000;
    });

    let admin = Address::generate(&env);
    let fee_recipient = Address::generate(&env);
    let creator = Address::generate(&env);
    let fan = Address::generate(&env);

    let token_contract_id = env.register_contract(None, MyFansToken);
    let token_client = MyFansTokenClient::new(&env, &token_contract_id);
    token_client.initialize(
        &admin,
        &String::from_str(&env, "MyFans Token"),
        &String::from_str(&env, "MFT"),
        &7u32,
        &0i128,
    );

    let subscription_contract_id = env.register_contract(None, MyfansContract);
    let subscription_client = MyfansContractClient::new(&env, &subscription_contract_id);
    subscription_client.init(&admin, &500u32, &fee_recipient, &token_contract_id, &1000i128);

    let content_access_id = env.register_contract(None, ContentAccess);
    let content_client = ContentAccessClient::new(&env, &content_access_id);
    content_client.initialize(&admin, &token_contract_id);

    token_client.mint(&fan, &2_000i128);

    let plan_id = subscription_client.create_plan(&creator, &token_contract_id, &1000i128, &30u32);
    subscription_client.subscribe(&fan, &plan_id, &token_contract_id);

    assert!(subscription_client.is_subscriber(&fan, &creator));
    assert_eq!(token_client.balance(&fan), 1_000i128);
    assert_eq!(token_client.balance(&creator), 950i128);
    assert_eq!(token_client.balance(&fee_recipient), 50i128);

    let content_id = 1u64;
    assert!(!content_client.has_access(&fan, &creator, &content_id));
    content_client.set_content_price(&creator, &content_id, &500i128);
    content_client.unlock_content(&fan, &creator, &content_id);

    assert!(content_client.has_access(&fan, &creator, &content_id));
    assert_eq!(token_client.balance(&fan), 500i128);
    assert_eq!(token_client.balance(&creator), 1_450i128);

    let unlocked = env.events().all().iter().any(|event| {
        let topic: Symbol = event.1.first().unwrap().try_into_val(&env).unwrap();
        topic == Symbol::new(&env, "content_unlocked")
    });
    assert!(unlocked, "Expected content_unlocked event after unlocking content");
}
