#![no_std]
use soroban_sdk::{contract, contractimpl, Address, Env, Vec};

#[contract]
pub struct ContentAccess;

#[contractimpl]
impl ContentAccess {
    /// Check if buyer has access to a single content
    pub fn has_access(env: Env, buyer: Address, creator: Address, content_id: u64) -> bool {
        let key = (buyer.clone(), creator.clone(), content_id);
        env.storage().instance().get(&key).unwrap_or(false)
    }

    /// Grant access to content
    pub fn grant_access(env: Env, buyer: Address, creator: Address, content_id: u64) {
        let key = (buyer, creator, content_id);
        env.storage().instance().set(&key, &true);
    }

    /// Batch check access for multiple content items
    pub fn has_access_batch(
        env: Env,
        buyer: Address,
        content_ids: Vec<(Address, u64)>,
    ) -> Vec<bool> {
        let mut results = Vec::new(&env);
        
        for item in content_ids.iter() {
            let (creator, content_id) = item;
            let has_access = Self::has_access(env.clone(), buyer.clone(), creator, content_id);
            results.push_back(has_access);
        }
        
        results
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::Address as _, vec, Env};

    #[test]
    fn test_has_access_single() {
        let env = Env::default();
        let contract_id = env.register_contract(None, ContentAccess);
        let client = ContentAccessClient::new(&env, &contract_id);

        let buyer = Address::generate(&env);
        let creator = Address::generate(&env);
        let content_id = 1;

        assert!(!client.has_access(&buyer, &creator, &content_id));

        client.grant_access(&buyer, &creator, &content_id);
        assert!(client.has_access(&buyer, &creator, &content_id));
    }

    #[test]
    fn test_has_access_batch_empty() {
        let env = Env::default();
        let contract_id = env.register_contract(None, ContentAccess);
        let client = ContentAccessClient::new(&env, &contract_id);

        let buyer = Address::generate(&env);
        let content_ids = vec![&env];

        let results = client.has_access_batch(&buyer, &content_ids);
        assert_eq!(results.len(), 0);
    }

    #[test]
    fn test_has_access_batch_single() {
        let env = Env::default();
        let contract_id = env.register_contract(None, ContentAccess);
        let client = ContentAccessClient::new(&env, &contract_id);

        let buyer = Address::generate(&env);
        let creator = Address::generate(&env);
        let content_id = 1;

        let content_ids = vec![&env, (creator.clone(), content_id)];

        let results = client.has_access_batch(&buyer, &content_ids);
        assert_eq!(results.len(), 1);
        assert!(!results.get(0).unwrap());

        client.grant_access(&buyer, &creator, &content_id);

        let results = client.has_access_batch(&buyer, &content_ids);
        assert_eq!(results.len(), 1);
        assert!(results.get(0).unwrap());
    }

    #[test]
    fn test_has_access_batch_multiple() {
        let env = Env::default();
        let contract_id = env.register_contract(None, ContentAccess);
        let client = ContentAccessClient::new(&env, &contract_id);

        let buyer = Address::generate(&env);
        let creator1 = Address::generate(&env);
        let creator2 = Address::generate(&env);

        client.grant_access(&buyer, &creator1, &1);
        client.grant_access(&buyer, &creator2, &3);

        let content_ids = vec![
            &env,
            (creator1.clone(), 1),
            (creator1.clone(), 2),
            (creator2.clone(), 3),
            (creator2.clone(), 4),
        ];

        let results = client.has_access_batch(&buyer, &content_ids);
        
        assert_eq!(results.len(), 4);
        assert!(results.get(0).unwrap());   // creator1, content 1 - granted
        assert!(!results.get(1).unwrap());  // creator1, content 2 - not granted
        assert!(results.get(2).unwrap());   // creator2, content 3 - granted
        assert!(!results.get(3).unwrap());  // creator2, content 4 - not granted
    }

    #[test]
    fn test_has_access_batch_different_buyers() {
        let env = Env::default();
        let contract_id = env.register_contract(None, ContentAccess);
        let client = ContentAccessClient::new(&env, &contract_id);

        let buyer1 = Address::generate(&env);
        let buyer2 = Address::generate(&env);
        let creator = Address::generate(&env);

        client.grant_access(&buyer1, &creator, &1);

        let content_ids = vec![&env, (creator.clone(), 1)];

        let results1 = client.has_access_batch(&buyer1, &content_ids);
        assert!(results1.get(0).unwrap());

        let results2 = client.has_access_batch(&buyer2, &content_ids);
        assert!(!results2.get(0).unwrap());
    }
}
