#![no_std]

//! Example contract demonstrating myfans-lib usage
//! 
//! This shows how to import and use SubscriptionStatus and ContentType
//! in a Soroban contract.

use soroban_sdk::{contract, contractimpl, Env};
use myfans_lib::{SubscriptionStatus, ContentType};

#[contract]
pub struct ExampleContract;

#[contractimpl]
impl ExampleContract {
    /// Returns a subscription status
    pub fn get_status(_env: Env) -> SubscriptionStatus {
        SubscriptionStatus::Active
    }
    
    /// Returns a content type
    pub fn get_content_type(_env: Env) -> ContentType {
        ContentType::Paid
    }
    
    /// Checks if subscription is active
    pub fn is_active(_env: Env, status: SubscriptionStatus) -> bool {
        status == SubscriptionStatus::Active
    }
    
    /// Checks if content requires payment
    pub fn requires_payment(_env: Env, content_type: ContentType) -> bool {
        content_type == ContentType::Paid
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::Env;

    #[test]
    fn test_enum_usage() {
        let env = Env::default();
        let contract_id = env.register_contract(None, ExampleContract);
        let client = ExampleContractClient::new(&env, &contract_id);

        let status = client.get_status();
        assert_eq!(status, SubscriptionStatus::Active);

        let content_type = client.get_content_type();
        assert_eq!(content_type, ContentType::Paid);

        assert!(client.is_active(&SubscriptionStatus::Active));
        assert!(!client.is_active(&SubscriptionStatus::Pending));

        assert!(client.requires_payment(&ContentType::Paid));
        assert!(!client.requires_payment(&ContentType::Free));
    }
}
