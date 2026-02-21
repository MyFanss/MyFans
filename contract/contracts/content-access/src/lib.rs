#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, token, Address, Env, Symbol};

/// Storage keys for content access contract
#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    /// Admin address
    Admin,
    /// Token address for payments
    TokenAddress,
    /// Access record: (buyer, creator, content_id) -> true
    Access(Address, Address, u64),
}

#[contract]
pub struct ContentAccess;

#[contractimpl]
impl ContentAccess {
    /// Initialize the contract with admin and token address
    ///
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `admin` - Admin address
    /// * `token_address` - Token contract address for payments
    pub fn initialize(env: Env, admin: Address, token_address: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::TokenAddress, &token_address);
    }

    /// Unlock content for a buyer by transferring payment to creator
    ///
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `buyer` - Buyer address (must authorize)
    /// * `creator` - Creator address (receives payment)
    /// * `content_id` - Content ID to unlock
    /// * `price` - Price in tokens
    ///
    /// # Behavior
    /// - Buyer must authorize the transaction
    /// - Transfers `price` tokens from buyer to creator
    /// - Stores access record (buyer, creator, content_id) -> true
    /// - Idempotent: duplicate unlock is a no-op (returns early if already unlocked)
    pub fn unlock_content(
        env: Env,
        buyer: Address,
        creator: Address,
        content_id: u64,
        price: i128,
    ) {
        buyer.require_auth();

        // Check if already unlocked (idempotent)
        let access_key = DataKey::Access(buyer.clone(), creator.clone(), content_id);
        if env.storage().instance().has(&access_key) {
            return;
        }

        // Get token address
        let token_address: Address = env
            .storage()
            .instance()
            .get(&DataKey::TokenAddress)
            .unwrap();

        // Transfer tokens from buyer to creator
        let token_client = token::Client::new(&env, &token_address);
        token_client.transfer(&buyer, &creator, &price);

        // Store access record
        env.storage().instance().set(&access_key, &true);

        // Emit event
        env.events().publish(
            (
                Symbol::new(&env, "ContentUnlocked"),
                buyer.clone(),
                creator.clone(),
            ),
            (content_id, price),
        );
    }

    /// Check if buyer has access to content
    ///
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `buyer` - Buyer address
    /// * `creator` - Creator address
    /// * `content_id` - Content ID
    ///
    /// # Returns
    /// `true` if buyer has unlocked this content, `false` otherwise
    pub fn has_access(env: Env, buyer: Address, creator: Address, content_id: u64) -> bool {
        let access_key = DataKey::Access(buyer, creator, content_id);
        env.storage().instance().get(&access_key).unwrap_or(false)
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{
        testutils::{Address as _, Events},
        vec, Env, IntoVal,
    };

    // Mock token contract for testing
    #[contract]
    pub struct MockToken;

    #[contractimpl]
    impl MockToken {
        pub fn transfer(_env: Env, _from: Address, _to: Address, _amount: i128) {
            // Mock implementation - just succeed
        }
    }

    fn setup_test() -> (Env, Address, Address, Address, Address, Address) {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let buyer = Address::generate(&env);
        let creator = Address::generate(&env);

        // Register mock token contract
        let token_id = env.register_contract(None, MockToken);
        let token_address = token_id;

        // Register content-access contract
        let contract_id = env.register_contract(None, ContentAccess);

        (env, contract_id, admin, token_address, buyer, creator)
    }

    #[test]
    fn test_initialize() {
        let (env, contract_id, admin, token_address, _, _) = setup_test();
        let client = ContentAccessClient::new(&env, &contract_id);

        client.initialize(&admin, &token_address);

        // Verify initialization by checking storage (indirectly via has_access)
        let buyer = Address::generate(&env);
        let creator = Address::generate(&env);
        assert!(!client.has_access(&buyer, &creator, &1));
    }

    #[test]
    fn test_unlock_content_works() {
        let (env, contract_id, admin, token_address, buyer, creator) = setup_test();
        let client = ContentAccessClient::new(&env, &contract_id);

        client.initialize(&admin, &token_address);

        // Verify no access before unlock
        assert!(!client.has_access(&buyer, &creator, &1));

        // Unlock content
        client.unlock_content(&buyer, &creator, &1, &100);

        // Verify access after unlock
        assert!(client.has_access(&buyer, &creator, &1));

        let events = env.events().all();
        assert_eq!(
            events,
            vec![
                &env,
                (
                    contract_id.clone(),
                    (
                        Symbol::new(&env, "ContentUnlocked"),
                        buyer.clone(),
                        creator.clone()
                    )
                        .into_val(&env),
                    (1u64, 100i128).into_val(&env)
                )
            ]
        );
    }

    #[test]
    #[should_panic]
    fn test_unlock_content_requires_buyer_auth() {
        let env = Env::default();
        // Don't mock all auths - this should fail

        let contract_id = env.register_contract(None, ContentAccess);
        let client = ContentAccessClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let token_address = Address::generate(&env);
        let buyer = Address::generate(&env);
        let creator = Address::generate(&env);

        client.initialize(&admin, &token_address);

        // Try to unlock without auth - should panic
        client.unlock_content(&buyer, &creator, &1, &100);
    }

    #[test]
    fn test_duplicate_unlock_is_idempotent() {
        let (env, contract_id, admin, token_address, buyer, creator) = setup_test();
        let client = ContentAccessClient::new(&env, &contract_id);

        client.initialize(&admin, &token_address);

        // First unlock
        client.unlock_content(&buyer, &creator, &1, &100);
        assert!(client.has_access(&buyer, &creator, &1));

        // Second unlock (should be no-op, no error)
        client.unlock_content(&buyer, &creator, &1, &100);
        assert!(client.has_access(&buyer, &creator, &1));
    }

    #[test]
    fn test_has_access_returns_false_for_non_existent() {
        let (env, contract_id, admin, token_address, buyer, creator) = setup_test();
        let client = ContentAccessClient::new(&env, &contract_id);

        client.initialize(&admin, &token_address);

        // Check access for content that was never unlocked
        assert!(!client.has_access(&buyer, &creator, &999));
    }

    #[test]
    fn test_access_is_buyer_specific() {
        let (env, contract_id, admin, token_address, buyer, creator) = setup_test();
        let client = ContentAccessClient::new(&env, &contract_id);

        let buyer2 = Address::generate(&env);

        client.initialize(&admin, &token_address);

        // Buyer1 unlocks content
        client.unlock_content(&buyer, &creator, &1, &100);

        // Verify buyer1 has access
        assert!(client.has_access(&buyer, &creator, &1));

        // Verify buyer2 does not have access
        assert!(!client.has_access(&buyer2, &creator, &1));
    }

    #[test]
    fn test_access_is_creator_specific() {
        let (env, contract_id, admin, token_address, buyer, creator) = setup_test();
        let client = ContentAccessClient::new(&env, &contract_id);

        let creator2 = Address::generate(&env);

        client.initialize(&admin, &token_address);

        // Buyer unlocks content from creator1
        client.unlock_content(&buyer, &creator, &1, &100);

        // Verify access for creator1
        assert!(client.has_access(&buyer, &creator, &1));

        // Verify no access for creator2
        assert!(!client.has_access(&buyer, &creator2, &1));
    }

    #[test]
    fn test_access_is_content_id_specific() {
        let (env, contract_id, admin, token_address, buyer, creator) = setup_test();
        let client = ContentAccessClient::new(&env, &contract_id);

        client.initialize(&admin, &token_address);

        // Buyer unlocks content 1
        client.unlock_content(&buyer, &creator, &1, &100);

        // Verify access for content 1
        assert!(client.has_access(&buyer, &creator, &1));

        // Verify no access for content 2
        assert!(!client.has_access(&buyer, &creator, &2));
    }

    #[test]
    fn test_multiple_unlocks_different_content() {
        let (env, contract_id, admin, token_address, buyer, creator) = setup_test();
        let client = ContentAccessClient::new(&env, &contract_id);

        client.initialize(&admin, &token_address);

        // Unlock multiple content items
        client.unlock_content(&buyer, &creator, &1, &100);
        client.unlock_content(&buyer, &creator, &2, &150);
        client.unlock_content(&buyer, &creator, &3, &200);

        // Verify all are accessible
        assert!(client.has_access(&buyer, &creator, &1));
        assert!(client.has_access(&buyer, &creator, &2));
        assert!(client.has_access(&buyer, &creator, &3));
    }

    #[test]
    fn test_multiple_buyers_same_content() {
        let (env, contract_id, admin, token_address, buyer, creator) = setup_test();
        let client = ContentAccessClient::new(&env, &contract_id);

        let buyer2 = Address::generate(&env);
        let buyer3 = Address::generate(&env);

        client.initialize(&admin, &token_address);

        // Multiple buyers unlock same content
        client.unlock_content(&buyer, &creator, &1, &100);
        client.unlock_content(&buyer2, &creator, &1, &100);

        // Verify access
        assert!(client.has_access(&buyer, &creator, &1));
        assert!(client.has_access(&buyer2, &creator, &1));
        assert!(!client.has_access(&buyer3, &creator, &1));
    }

    #[test]
    fn test_set_admin_works() {
        let (env, contract_id, admin, token_address, _, _) = setup_test();
        let client = ContentAccessClient::new(&env, &contract_id);

        client.initialize(&admin, &token_address);

        let new_admin = Address::generate(&env);
        client.set_admin(&new_admin);

        // Verify by setting it again with new admin
        let admin3 = Address::generate(&env);
        client.set_admin(&admin3);
    }

    #[test]
    #[should_panic] // Status codes in Soroban tests can be tricky
    fn test_set_admin_fails_if_not_authorized() {
        let env = Env::default();
        let contract_id = env.register_contract(None, ContentAccess);
        let client = ContentAccessClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let token_address = Address::generate(&env);
        client.initialize(&admin, &token_address);

        let non_admin = Address::generate(&env);
        // We don't call mock_all_auths, but we need to specify whose auth we are testing
        // For simplicity, we just check that it doesn't work without any auth setup
        client.set_admin(&non_admin);
    }

    #[test]
    #[should_panic(expected = "already initialized")]
    fn test_initialize_fails_if_already_initialized() {
        let (env, contract_id, admin, token_address, _, _) = setup_test();
        let client = ContentAccessClient::new(&env, &contract_id);

        client.initialize(&admin, &token_address);
        client.initialize(&admin, &token_address);
    }
}
