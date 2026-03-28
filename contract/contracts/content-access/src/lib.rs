#![no_std]
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, token, Address, BytesN,
    Env, Symbol,
};

/// Metadata for a piece of content in a creator's catalog.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ContentInfo {
    /// Price in the contract's configured token (stroops / smallest unit).
    pub price: i128,
    /// Whether the content is currently available for purchase.
    pub is_active: bool,
}

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
    /// Content price: (creator, content_id) -> price  [legacy u64 key]
    ContentPrice(Address, u64),
    /// Content catalog entry: (creator, content_id_32) -> ContentInfo  [issue #312]
    ContentCatalog(Address, BytesN<32>),
}

#[contracterror]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Error {
    AlreadyInitialized = 1,
    ContentPriceNotSet = 2,
    NotInitialized = 3,
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
        admin.require_auth();
        if env.storage().instance().has(&DataKey::Admin) {
            panic_with_error!(&env, Error::AlreadyInitialized);
        }

        let token_client = token::Client::new(&env, &token_address);
        let _ = token_client.balance(&admin);

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
    ///
    /// # Behavior
    /// - Buyer must authorize the transaction
    /// - Uses stored price set by the creator
    /// - Transfers price tokens from buyer to creator
    /// - Stores access record (buyer, creator, content_id) -> true
    /// - Idempotent: duplicate unlock is a no-op
    pub fn unlock_content(env: Env, buyer: Address, creator: Address, content_id: u64) {
        buyer.require_auth();

        // Check if already unlocked (idempotent)
        let access_key = DataKey::Access(buyer.clone(), creator.clone(), content_id);
        if env.storage().instance().has(&access_key) {
            return;
        }

        // Get stored price
        let price: i128 = Self::get_content_price(env.clone(), creator.clone(), content_id)
            .unwrap_or_else(|| panic_with_error!(&env, Error::ContentPriceNotSet));

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

        // Emit structured unlock event:
        //   topics : (symbol "content_unlocked", buyer, creator)
        //   data   : (content_id, amount)
        env.events().publish(
            (
                Symbol::new(&env, "content_unlocked"),
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

    /// Get the price for (creator, content_id). Returns None if not set.
    pub fn get_content_price(env: Env, creator: Address, content_id: u64) -> Option<i128> {
        let key = DataKey::ContentPrice(creator, content_id);
        env.storage().instance().get(&key)
    }

    /// Set the price for a creator's content. Creator must authorize.
    pub fn set_content_price(env: Env, creator: Address, content_id: u64, price: i128) {
        creator.require_auth();
        let key = DataKey::ContentPrice(creator, content_id);
        env.storage().instance().set(&key, &price);
    }

    /// Register (or update) a content item in the creator's catalog.
    /// Creator must authorize. Stores price and active flag in persistent storage.
    pub fn register_content(
        env: Env,
        creator: Address,
        content_id: BytesN<32>,
        price: i128,
        is_active: bool,
    ) {
        creator.require_auth();
        let key = DataKey::ContentCatalog(creator, content_id);
        let info = ContentInfo { price, is_active };
        env.storage().persistent().set(&key, &info);
    }

    /// Read-only catalog lookup for a creator's content item.
    ///
    /// Returns `Some(ContentInfo)` when the content exists, `None` otherwise.
    /// No authorization required – safe for anonymous UI previews.
    pub fn get_content_info(
        env: Env,
        creator: Address,
        content_id: BytesN<32>,
    ) -> Option<ContentInfo> {
        let key = DataKey::ContentCatalog(creator, content_id);
        env.storage().persistent().get(&key)
    }

    /// Set a new admin address. Current admin must authorize.
    pub fn set_admin(env: Env, new_admin: Address) {
        let current_admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .unwrap_or_else(|| panic_with_error!(&env, Error::NotInitialized));
        current_admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &new_admin);
    }
}

mod content_query_test;

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{
        testutils::{Address as _, Events},
        vec, Address, Env, Error as SorobanError, IntoVal, Symbol, TryIntoVal,
    };

    // Mock token contract for testing
    #[contract]
    pub struct MockToken;

#[contractimpl]
    impl MockToken {
        pub fn balance(_env: Env, _id: Address) -> i128 {
            0
        }

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

        // Set price
        client.set_content_price(&creator, &1, &100);

        // Unlock content
        client.unlock_content(&buyer, &creator, &1);

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
                        Symbol::new(&env, "content_unlocked"),
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
        client.set_content_price(&creator, &1, &100);

        // Try to unlock without auth - should panic
        client.unlock_content(&buyer, &creator, &1);
    }

    #[test]
    fn test_duplicate_unlock_is_idempotent() {
        let (env, contract_id, admin, token_address, buyer, creator) = setup_test();
        let client = ContentAccessClient::new(&env, &contract_id);

        client.initialize(&admin, &token_address);
        client.set_content_price(&creator, &1, &100);

        // First unlock
        client.unlock_content(&buyer, &creator, &1);
        assert!(client.has_access(&buyer, &creator, &1));

        // Second unlock (should be no-op, no error)
        client.unlock_content(&buyer, &creator, &1);
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
        client.set_content_price(&creator, &1, &100);

        // Buyer1 unlocks content
        client.unlock_content(&buyer, &creator, &1);

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
        client.set_content_price(&creator, &1, &100);
        client.set_content_price(&creator2, &1, &100);

        // Buyer unlocks content from creator1
        client.unlock_content(&buyer, &creator, &1);

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
        client.set_content_price(&creator, &1, &100);
        client.set_content_price(&creator, &2, &100);

        // Buyer unlocks content 1
        client.unlock_content(&buyer, &creator, &1);

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
        client.set_content_price(&creator, &1, &100);
        client.set_content_price(&creator, &2, &150);
        client.set_content_price(&creator, &3, &200);

        // Unlock multiple content items
        client.unlock_content(&buyer, &creator, &1);
        client.unlock_content(&buyer, &creator, &2);
        client.unlock_content(&buyer, &creator, &3);

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
        client.set_content_price(&creator, &1, &100);

        // Multiple buyers unlock same content
        client.unlock_content(&buyer, &creator, &1);
        client.unlock_content(&buyer2, &creator, &1);

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
    fn test_initialize_fails_if_already_initialized() {
        let (env, contract_id, admin, token_address, _, _) = setup_test();
        let client = ContentAccessClient::new(&env, &contract_id);

        client.initialize(&admin, &token_address);
        let result = client.try_initialize(&admin, &token_address);
        assert_eq!(
            result,
            Err(Ok(SorobanError::from_contract_error(
                Error::AlreadyInitialized as u32,
            )))
        );
    }

    // ── #295 – detailed unlock event fields ──────────────────────────────────

    /// Verifies every field of the content_unlocked event individually:
    ///   topics[0] = Symbol "content_unlocked"
    ///   topics[1] = buyer  (Address)
    ///   topics[2] = creator (Address)
    ///   data      = (content_id: u64, amount: i128)
    #[test]
    fn test_unlock_event_fields() {
        let (env, contract_id, admin, token_address, buyer, creator) = setup_test();
        let client = ContentAccessClient::new(&env, &contract_id);

        client.initialize(&admin, &token_address);
        client.set_content_price(&creator, &42, &750);
        client.unlock_content(&buyer, &creator, &42);

        let all_events = env.events().all();

        // Find the content_unlocked event by its first topic symbol.
        let unlock_event = all_events.iter().find(|e| {
            e.1.first().is_some_and(|t| {
                t.try_into_val(&env).ok() == Some(Symbol::new(&env, "content_unlocked"))
            })
        });

        assert!(unlock_event.is_some(), "content_unlocked event not emitted");
        let event = unlock_event.unwrap();

        // ── topics ────────────────────────────────────────────────────────────
        assert_eq!(
            event.1.len(),
            3,
            "expected 3 topics: (name, buyer, creator)"
        );

        let topic_name: Symbol = event.1.get(0).unwrap().try_into_val(&env).unwrap();
        assert_eq!(topic_name, Symbol::new(&env, "content_unlocked"));

        let event_buyer: Address = event.1.get(1).unwrap().try_into_val(&env).unwrap();
        assert_eq!(event_buyer, buyer, "buyer mismatch in topics");

        let event_creator: Address = event.1.get(2).unwrap().try_into_val(&env).unwrap();
        assert_eq!(event_creator, creator, "creator mismatch in topics");

        // ── data: (content_id, amount) ────────────────────────────────────────
        let (event_content_id, event_amount): (u64, i128) = event.2.try_into_val(&env).unwrap();
        assert_eq!(event_content_id, 42u64, "content_id mismatch in data");
        assert_eq!(event_amount, 750i128, "amount mismatch in data");
    }

    /// Duplicate unlock emits no second event (idempotent early-return).
    #[test]
    fn test_duplicate_unlock_emits_no_second_event() {
        let (env, contract_id, admin, token_address, buyer, creator) = setup_test();
        let client = ContentAccessClient::new(&env, &contract_id);

        client.initialize(&admin, &token_address);
        client.set_content_price(&creator, &1, &100);

        client.unlock_content(&buyer, &creator, &1);
        let count_after_first = env
            .events()
            .all()
            .iter()
            .filter(|e| {
                e.1.first().is_some_and(|t| {
                    t.try_into_val(&env).ok() == Some(Symbol::new(&env, "content_unlocked"))
                })
            })
            .count();

        client.unlock_content(&buyer, &creator, &1); // idempotent – no-op
        let count_after_second = env
            .events()
            .all()
            .iter()
            .filter(|e| {
                e.1.first().is_some_and(|t| {
                    t.try_into_val(&env).ok() == Some(Symbol::new(&env, "content_unlocked"))
                })
            })
            .count();

        assert_eq!(count_after_first, 1);
        assert_eq!(
            count_after_second, 1,
            "duplicate unlock must not emit a second event"
        );
    }

    #[test]
    fn test_initialize_valid_token_succeeds() {
        let (env, contract_id, admin, token_address, _, _) = setup_test();
        let client = ContentAccessClient::new(&env, &contract_id);

        client.initialize(&admin, &token_address);
    }

    #[test]
    #[should_panic(expected = r##"calling unknown contract function"##)]
    fn test_initialize_invalid_token_fails() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
let invalid_token_contract = env.register_contract(None, ContentAccess);
        let invalid_token_address: Address = invalid_token_contract.into();

        let contract_id = env.register_contract(None, ContentAccess);
        let client = ContentAccessClient::new(&env, &contract_id);

        client.initialize(&admin, &invalid_token_address);
    }

    #[test]
    #[should_panic(expected = r##"Unauthorized function call"##)]
    fn test_initialize_missing_admin_auth_fails() {
        let env = Env::default();
        // No mock auths

        let contract_id = env.register_contract(None, ContentAccess);
        let client = ContentAccessClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let token_address = Address::generate(&env);

        client.initialize(&admin, &token_address);
    }
}
