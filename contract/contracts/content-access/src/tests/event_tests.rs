use crate::{
    events::{AdminTransferredEvent, ContentPriceSetEvent, MaxPriceClearedEvent, MaxPriceSetEvent},
    ContentAccess, ContentAccessClient,
};
use soroban_sdk::{
    contract, contractimpl,
    testutils::{Address as _, Events, Ledger},
    Address, Env, Symbol, TryIntoVal,
};

#[contract]
pub struct MockToken;

#[contractimpl]
impl MockToken {
    pub fn balance(_env: Env, _id: Address) -> i128 {
        0
    }

    pub fn transfer(_env: Env, _from: Address, _to: Address, _amount: i128) {}
}

fn setup(env: &Env) -> (ContentAccessClient<'_>, Address, Address) {
    env.mock_all_auths();
    env.ledger().with_mut(|li| li.sequence_number = 1000);

    let admin = Address::generate(env);
    let creator = Address::generate(env);
    let token_address = env.register_contract(None, MockToken);
    let contract_id = env.register_contract(None, ContentAccess);
    let client = ContentAccessClient::new(env, &contract_id);

    client.initialize(&admin, &token_address);
    (client, admin, creator)
}

#[test]
fn set_content_price_emits_structured_event() {
    let env = Env::default();
    let (client, _admin, creator) = setup(&env);

    client.set_content_price(&creator, &42, &750);

    let event = env
        .events()
        .all()
        .iter()
        .find(|event| {
            event.1.first().is_some_and(|topic| {
                topic.try_into_val(&env).ok() == Some(Symbol::new(&env, "content_price_set"))
            })
        })
        .expect("content_price_set event");
    let data: ContentPriceSetEvent = event.2.try_into_val(&env).unwrap();
    assert_eq!(
        data,
        ContentPriceSetEvent {
            creator,
            content_id: 42,
            price: 750,
        }
    );
}

#[test]
fn set_max_price_emits_structured_event() {
    let env = Env::default();
    let (client, admin, _creator) = setup(&env);

    client.set_max_price(&1_000);

    let event = env
        .events()
        .all()
        .iter()
        .find(|event| {
            event.1.first().is_some_and(|topic| {
                topic.try_into_val(&env).ok() == Some(Symbol::new(&env, "max_price_set"))
            })
        })
        .expect("max_price_set event");
    let data: MaxPriceSetEvent = event.2.try_into_val(&env).unwrap();
    assert_eq!(
        data,
        MaxPriceSetEvent {
            price: 1_000,
            set_by: admin,
        }
    );
}

#[test]
fn clear_max_price_emits_structured_event() {
    let env = Env::default();
    let (client, admin, _creator) = setup(&env);

    client.set_max_price(&1_000);
    client.set_max_price(&0);

    let event = env
        .events()
        .all()
        .iter()
        .find(|event| {
            event.1.first().is_some_and(|topic| {
                topic.try_into_val(&env).ok() == Some(Symbol::new(&env, "max_price_cleared"))
            })
        })
        .expect("max_price_cleared event");
    let data: MaxPriceClearedEvent = event.2.try_into_val(&env).unwrap();
    assert_eq!(data, MaxPriceClearedEvent { cleared_by: admin });
}

#[test]
fn set_admin_emits_structured_event() {
    let env = Env::default();
    let (client, admin, _creator) = setup(&env);
    let new_admin = Address::generate(&env);

    client.set_admin(&new_admin);

    let event = env
        .events()
        .all()
        .iter()
        .find(|event| {
            event.1.first().is_some_and(|topic| {
                topic.try_into_val(&env).ok() == Some(Symbol::new(&env, "admin_transferred"))
            })
        })
        .expect("admin_transferred event");
    let data: AdminTransferredEvent = event.2.try_into_val(&env).unwrap();
    assert_eq!(
        data,
        AdminTransferredEvent {
            old_admin: admin,
            new_admin,
        }
    );
}
