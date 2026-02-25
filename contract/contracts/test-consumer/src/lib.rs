#![no_std]
use myfans_lib::{ContentType, SubscriptionStatus};
use soroban_sdk::{contract, contractimpl, Env};

#[contract]
pub struct TestConsumer;

#[contractimpl]
impl TestConsumer {
    pub fn get_status(_env: Env) -> SubscriptionStatus {
        SubscriptionStatus::Active
    }

    pub fn get_content(_env: Env) -> ContentType {
        ContentType::Paid
    }

    pub fn is_active(_env: Env, status: SubscriptionStatus) -> bool {
        status == SubscriptionStatus::Active
    }
}

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn test_import_and_use() {
        let env = Env::default();
        let contract_id = env.register_contract(None, TestConsumer);
        let client = TestConsumerClient::new(&env, &contract_id);

        assert_eq!(client.get_status(), SubscriptionStatus::Active);
        assert_eq!(client.get_content(), ContentType::Paid);
        assert!(client.is_active(&SubscriptionStatus::Active));
        assert!(!client.is_active(&SubscriptionStatus::Pending));
    }
}
