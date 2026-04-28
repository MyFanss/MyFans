#![no_std]
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, token, Address, Env,
    Symbol,
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

/// A purchase record stored per (buyer, creator, content_id).
/// `expiry` is the ledger sequence number after which the purchase is considered expired.
/// A value of `u64::MAX` means the purchase never expires.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Purchase {
    /// Ledger sequence at which this purchase expires (exclusive).
    pub expiry: u64,
}

/// Storage keys for content access contract
#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    /// Admin address
    Admin,
    /// Token address for payments
    TokenAddress,
    /// Purchase record: (buyer, creator, content_id) -> Purchase
    Access(Address, Address, u64),
    /// Content price: (creator, content_id) -> price  [legacy u64 key]
    ContentPrice(Address, u64),
    /// Optional maximum price cap set by admin
    MaxPrice,
}

/// Per-contract error codes for the **content-access** contract.
///
/// These discriminants are stable and form part of the public client API.
/// Do **not** renumber existing variants; add new ones at the end.
///
/// | Code | Variant |
/// |------|---------|
/// | 1 | `AlreadyInitialized` |
/// | 2 | `ContentPriceNotSet` |
/// | 3 | `NotInitialized` |
/// | 4 | `PurchaseExpired` |
/// | 6 | `NotBuyer` |
#[contracterror]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Error {
    /// Code 1 – contract was already initialized.
    AlreadyInitialized = 1,
    /// Code 2 – no price registered for (creator, content_id).
    ContentPriceNotSet = 2,
    /// Code 3 – contract was never initialized.
    NotInitialized = 3,
    /// Code 4 – purchase record exists but its expiry ledger has passed.
    PurchaseExpired = 4,
    /// Code 6 – no purchase record found for the claimer (not the buyer).
    NotBuyer = 6,
}

#[contract]
pub struct ContentAccess;

#[contractimpl]
impl ContentAccess {
    /// Initialize the contract with admin and token address
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

    /// Unlock content for a buyer by transferring payment to creator.
    ///
    /// `expiry_ledger` sets when the purchase expires. Pass `u64::MAX` for a
    /// non-expiring purchase. Passing `0` is rejected (would be immediately expired).
    ///
    /// # Errors
    /// - `ContentPriceNotSet` – no price registered for (creator, content_id).
    ///
    /// # Panics (auth)
    /// - Buyer must authorize the transaction.
    pub fn unlock_content(
        env: Env,
        buyer: Address,
        creator: Address,
        content_id: u64,
        expiry_ledger: u64,
    ) {
        buyer.require_auth();

        // Check if already unlocked (idempotent) – but re-check expiry.
        let access_key = DataKey::Access(buyer.clone(), creator.clone(), content_id);
        if let Some(existing) = env
            .storage()
            .instance()
            .get::<DataKey, Purchase>(&access_key)
        {
            // If the existing purchase is still valid, treat as no-op.
            if existing.expiry > env.ledger().sequence() as u64 {
                return;
            }
            // Expired purchase: allow re-purchase by falling through.
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

        // Store purchase record with expiry
        let purchase = Purchase {
            expiry: expiry_ledger,
        };
        env.storage().instance().set(&access_key, &purchase);

        env.events().publish(
            (
                Symbol::new(&env, "content_unlocked"),
                buyer.clone(),
                creator.clone(),
            ),
            (content_id, price),
        );
    }

    /// Check if buyer has valid (non-expired) access to content.
    pub fn has_access(env: Env, buyer: Address, creator: Address, content_id: u64) -> bool {
        let access_key = DataKey::Access(buyer, creator, content_id);
        if let Some(purchase) = env
            .storage()
            .instance()
            .get::<DataKey, Purchase>(&access_key)
        {
            purchase.expiry > env.ledger().sequence() as u64
        } else {
            false
        }
    }

    /// Verify that `claimer` is the buyer of (creator, content_id) and the purchase
    /// is not expired.
    ///
    /// # Panics (contract errors)
    /// - `NotBuyer`        – no purchase record exists for `claimer`.
    /// - `PurchaseExpired` – purchase exists but has expired.
    pub fn verify_access(env: Env, claimer: Address, creator: Address, content_id: u64) {
        let access_key = DataKey::Access(claimer.clone(), creator.clone(), content_id);
        let purchase: Purchase = env
            .storage()
            .instance()
            .get::<DataKey, Purchase>(&access_key)
            .unwrap_or_else(|| panic_with_error!(&env, Error::NotBuyer));

        if purchase.expiry <= env.ledger().sequence() as u64 {
            panic_with_error!(&env, Error::PurchaseExpired);
        }
    }

    /// Get the price for (creator, content_id). Returns None if not set.
    pub fn get_content_price(env: Env, creator: Address, content_id: u64) -> Option<i128> {
        let key = DataKey::ContentPrice(creator, content_id);
        env.storage().instance().get(&key)
    }

    /// Set the price for a creator's content. Creator must authorize.
    pub fn set_content_price(env: Env, creator: Address, content_id: u64, price: i128) {
        creator.require_auth();

        if price <= 0 {
            panic!("price must be positive");
        }

        if let Some(max_price) = env
            .storage()
            .instance()
            .get::<DataKey, i128>(&DataKey::MaxPrice)
        {
            if price > max_price {
                panic!("price exceeds maximum allowed");
            }
        }

        let key = DataKey::ContentPrice(creator, content_id);
        env.storage().instance().set(&key, &price);
    }

    /// Set a global maximum price cap. Only admin may call this.
    /// Pass `0` to remove the cap entirely.
    pub fn set_max_price(env: Env, max_price: i128) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("not initialized");
        admin.require_auth();

        if max_price == 0 {
            env.storage().instance().remove(&DataKey::MaxPrice);
        } else {
            if max_price < 0 {
                panic!("max price must be positive or zero to remove cap");
            }
            env.storage().instance().set(&DataKey::MaxPrice, &max_price);
        }
    }

    /// Get the configured max-price cap, or `None` if no cap is set.
    pub fn get_max_price(env: Env) -> Option<i128> {
        env.storage().instance().get(&DataKey::MaxPrice)
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

    /// Returns the configured admin address.
    pub fn admin(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .unwrap_or_else(|| panic_with_error!(&env, Error::NotInitialized))
    }
}

mod content_query_test;

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{
        testutils::{Address as _, Events, Ledger},
        vec,
        xdr::SorobanAuthorizationEntry,
        Address, Env, Error as SorobanError, IntoVal, Symbol, TryIntoVal,
    };

    const EMPTY_AUTHS: &[SorobanAuthorizationEntry] = &[];

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

    /// Default expiry: far future (non-expiring purchase).
    const NO_EXPIRY: u64 = u64::MAX;

    fn setup_test() -> (Env, Address, Address, Address, Address, Address) {
        let env = Env::default();
        env.mock_all_auths();
        env.ledger().with_mut(|li| {
            li.sequence_number = 1000;
            li.min_persistent_entry_ttl = 10_000_000;
            li.min_temp_entry_ttl = 10_000_000;
        });

        let admin = Address::generate(&env);
        let buyer = Address::generate(&env);
        let creator = Address::generate(&env);

        let token_id = env.register_contract(None, MockToken);
        let token_address = token_id;

        let contract_id = env.register_contract(None, ContentAccess);

        (env, contract_id, admin, token_address, buyer, creator)
    }

    #[test]
    fn test_initialize() {
        let (env, contract_id, admin, token_address, _, _) = setup_test();
        let client = ContentAccessClient::new(&env, &contract_id);

        client.initialize(&admin, &token_address);

        let buyer = Address::generate(&env);
        let creator = Address::generate(&env);
        assert!(!client.has_access(&buyer, &creator, &1));
    }

    #[test]
    fn test_unlock_content_works() {
        let (env, contract_id, admin, token_address, buyer, creator) = setup_test();
        let client = ContentAccessClient::new(&env, &contract_id);

        client.initialize(&admin, &token_address);
        assert!(!client.has_access(&buyer, &creator, &1));

        client.set_content_price(&creator, &1, &100);
        client.unlock_content(&buyer, &creator, &1, &NO_EXPIRY);

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
        env.ledger().with_mut(|li| li.sequence_number = 1000);

        let contract_id = env.register_contract(None, ContentAccess);
        let client = ContentAccessClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let token_address = Address::generate(&env);
        let buyer = Address::generate(&env);
        let creator = Address::generate(&env);

        client.initialize(&admin, &token_address);
        client.set_content_price(&creator, &1, &100);

        // No auth mocked – should panic
        client.unlock_content(&buyer, &creator, &1, &NO_EXPIRY);
    }

    #[test]
    fn test_duplicate_unlock_is_idempotent() {
        let (env, contract_id, admin, token_address, buyer, creator) = setup_test();
        let client = ContentAccessClient::new(&env, &contract_id);

        client.initialize(&admin, &token_address);
        client.set_content_price(&creator, &1, &100);

        client.unlock_content(&buyer, &creator, &1, &NO_EXPIRY);
        assert!(client.has_access(&buyer, &creator, &1));

        client.unlock_content(&buyer, &creator, &1, &NO_EXPIRY);
        assert!(client.has_access(&buyer, &creator, &1));
    }

    #[test]
    fn test_has_access_returns_false_for_non_existent() {
        let (env, contract_id, admin, token_address, buyer, creator) = setup_test();
        let client = ContentAccessClient::new(&env, &contract_id);

        client.initialize(&admin, &token_address);
        assert!(!client.has_access(&buyer, &creator, &999));
    }

    #[test]
    fn test_access_is_buyer_specific() {
        let (env, contract_id, admin, token_address, buyer, creator) = setup_test();
        let client = ContentAccessClient::new(&env, &contract_id);
        let buyer2 = Address::generate(&env);

        client.initialize(&admin, &token_address);
        client.set_content_price(&creator, &1, &100);
        client.unlock_content(&buyer, &creator, &1, &NO_EXPIRY);

        assert!(client.has_access(&buyer, &creator, &1));
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
        client.unlock_content(&buyer, &creator, &1, &NO_EXPIRY);

        assert!(client.has_access(&buyer, &creator, &1));
        assert!(!client.has_access(&buyer, &creator2, &1));
    }

    #[test]
    fn test_access_is_content_id_specific() {
        let (env, contract_id, admin, token_address, buyer, creator) = setup_test();
        let client = ContentAccessClient::new(&env, &contract_id);

        client.initialize(&admin, &token_address);
        client.set_content_price(&creator, &1, &100);
        client.set_content_price(&creator, &2, &100);
        client.unlock_content(&buyer, &creator, &1, &NO_EXPIRY);

        assert!(client.has_access(&buyer, &creator, &1));
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

        client.unlock_content(&buyer, &creator, &1, &NO_EXPIRY);
        client.unlock_content(&buyer, &creator, &2, &NO_EXPIRY);
        client.unlock_content(&buyer, &creator, &3, &NO_EXPIRY);

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
        client.unlock_content(&buyer, &creator, &1, &NO_EXPIRY);
        client.unlock_content(&buyer2, &creator, &1, &NO_EXPIRY);

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

        let admin3 = Address::generate(&env);
        client.set_admin(&admin3);
    }

    #[test]
    fn test_admin_view_returns_configured_admin() {
        let (env, contract_id, admin, token_address, _, _) = setup_test();
        let client = ContentAccessClient::new(&env, &contract_id);

        client.initialize(&admin, &token_address);
        assert_eq!(client.admin(), admin);
    }

    #[test]
    #[should_panic]
    fn test_admin_view_uninitialized_panics() {
        let env = Env::default();
        let contract_id = env.register_contract(None, ContentAccess);
        let client = ContentAccessClient::new(&env, &contract_id);
        client.admin();
    }

    #[test]
    #[should_panic]
    fn test_set_admin_fails_if_not_authorized() {
        let env = Env::default();
        let contract_id = env.register_contract(None, ContentAccess);
        let client = ContentAccessClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let token_address = Address::generate(&env);
        client.initialize(&admin, &token_address);

        let non_admin = Address::generate(&env);
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

    // ── Issue #4: expired / wrong-buyer / wrong-content_id tests ─────────────

    /// Unlock with an expired purchase: `has_access` returns false and
    /// `verify_access` returns `PurchaseExpired`.
    #[test]
    fn test_unlock_with_expired_purchase() {
        let (env, contract_id, admin, token_address, buyer, creator) = setup_test();
        let client = ContentAccessClient::new(&env, &contract_id);

        client.initialize(&admin, &token_address);
        client.set_content_price(&creator, &1, &100);

        // Purchase expires at ledger 1100 (current is 1000, so valid for 100 ledgers).
        client.unlock_content(&buyer, &creator, &1, &1100);
        assert!(
            client.has_access(&buyer, &creator, &1),
            "should have access before expiry"
        );

        // Advance ledger past expiry.
        env.ledger().with_mut(|li| li.sequence_number = 1101);

        assert!(
            !client.has_access(&buyer, &creator, &1),
            "has_access must return false after expiry"
        );

        // verify_access must return PurchaseExpired.
        let result = client.try_verify_access(&buyer, &creator, &1);
        assert_eq!(
            result,
            Err(Ok(SorobanError::from_contract_error(
                Error::PurchaseExpired as u32,
            ))),
            "verify_access must return PurchaseExpired for expired purchase"
        );
    }

    /// Unlock with wrong content_id: buyer purchased content 1 but tries to
    /// verify access for content 2 – must return `NotBuyer` (no record).
    #[test]
    fn test_unlock_with_wrong_content_id() {
        let (env, contract_id, admin, token_address, buyer, creator) = setup_test();
        let client = ContentAccessClient::new(&env, &contract_id);

        client.initialize(&admin, &token_address);
        client.set_content_price(&creator, &1, &100);
        client.set_content_price(&creator, &2, &200);

        // Buyer purchases content 1 only.
        client.unlock_content(&buyer, &creator, &1, &NO_EXPIRY);

        // Attempting to verify access for content 2 (never purchased) must fail.
        let result = client.try_verify_access(&buyer, &creator, &2);
        assert_eq!(
            result,
            Err(Ok(SorobanError::from_contract_error(
                Error::NotBuyer as u32,
            ))),
            "verify_access must return NotBuyer when content_id was never purchased"
        );

        // has_access for the wrong content_id must also be false.
        assert!(
            !client.has_access(&buyer, &creator, &2),
            "has_access must be false for wrong content_id"
        );
    }

    /// Unlock as non-buyer: a different address tries to verify access for
    /// content purchased by the original buyer – must return `NotBuyer`.
    #[test]
    fn test_unlock_as_non_buyer() {
        let (env, contract_id, admin, token_address, buyer, creator) = setup_test();
        let client = ContentAccessClient::new(&env, &contract_id);
        let non_buyer = Address::generate(&env);

        client.initialize(&admin, &token_address);
        client.set_content_price(&creator, &1, &100);

        // Original buyer purchases content.
        client.unlock_content(&buyer, &creator, &1, &NO_EXPIRY);
        assert!(client.has_access(&buyer, &creator, &1));

        // Non-buyer has no purchase record – verify_access must return NotBuyer.
        let result = client.try_verify_access(&non_buyer, &creator, &1);
        assert_eq!(
            result,
            Err(Ok(SorobanError::from_contract_error(
                Error::NotBuyer as u32,
            ))),
            "verify_access must return NotBuyer for a caller who never purchased"
        );

        // has_access for non-buyer must also be false.
        assert!(
            !client.has_access(&non_buyer, &creator, &1),
            "has_access must be false for non-buyer"
        );
    }

    // ── event tests ───────────────────────────────────────────────────────────

    #[test]
    fn test_unlock_event_fields() {
        let (env, contract_id, admin, token_address, buyer, creator) = setup_test();
        let client = ContentAccessClient::new(&env, &contract_id);

        client.initialize(&admin, &token_address);
        client.set_content_price(&creator, &42, &750);
        client.unlock_content(&buyer, &creator, &42, &NO_EXPIRY);

        let all_events = env.events().all();
        let unlock_event = all_events.iter().find(|e| {
            e.1.first().is_some_and(|t| {
                t.try_into_val(&env).ok() == Some(Symbol::new(&env, "content_unlocked"))
            })
        });

        assert!(unlock_event.is_some(), "content_unlocked event not emitted");
        let event = unlock_event.unwrap();

        assert_eq!(event.1.len(), 3);
        let topic_name: Symbol = event.1.get(0).unwrap().try_into_val(&env).unwrap();
        assert_eq!(topic_name, Symbol::new(&env, "content_unlocked"));
        let event_buyer: Address = event.1.get(1).unwrap().try_into_val(&env).unwrap();
        assert_eq!(event_buyer, buyer);
        let event_creator: Address = event.1.get(2).unwrap().try_into_val(&env).unwrap();
        assert_eq!(event_creator, creator);

        let (event_content_id, event_amount): (u64, i128) = event.2.try_into_val(&env).unwrap();
        assert_eq!(event_content_id, 42u64);
        assert_eq!(event_amount, 750i128);
    }

    #[test]
    fn test_duplicate_unlock_emits_no_second_event() {
        let (env, contract_id, admin, token_address, buyer, creator) = setup_test();
        let client = ContentAccessClient::new(&env, &contract_id);

        client.initialize(&admin, &token_address);
        client.set_content_price(&creator, &1, &100);

        client.unlock_content(&buyer, &creator, &1, &NO_EXPIRY);
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

        client.unlock_content(&buyer, &creator, &1, &NO_EXPIRY);
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
    fn test_set_content_price_by_creator_succeeds() {
        let (env, contract_id, admin, token_address, _, creator) = setup_test();
        let client = ContentAccessClient::new(&env, &contract_id);

        client.initialize(&admin, &token_address);
        client.set_content_price(&creator, &42, &500);
        assert_eq!(client.get_content_price(&creator, &42), Some(500));
    }

    #[test]
    #[should_panic(expected = "Unauthorized")]
    fn test_set_content_price_unauthorized_fails() {
        let env = Env::default();
        env.ledger().with_mut(|li| li.sequence_number = 1000);

        let contract_id = env.register_contract(None, ContentAccess);
        let client = ContentAccessClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let token_id = env.register_contract(None, MockToken);

        env.mock_all_auths();
        client.initialize(&admin, &token_id);

        let creator = Address::generate(&env);
        env.set_auths(EMPTY_AUTHS);
        client.set_content_price(&creator, &1, &100);
    }

    #[test]
    #[should_panic(expected = r##"calling unknown contract function"##)]
    fn test_initialize_invalid_token_fails() {
        let env = Env::default();
        env.mock_all_auths();
        env.ledger().with_mut(|li| li.sequence_number = 1000);

        let admin = Address::generate(&env);
        let invalid_token_contract = env.register_contract(None, ContentAccess);
        let invalid_token_address = invalid_token_contract;

        let contract_id = env.register_contract(None, ContentAccess);
        let client = ContentAccessClient::new(&env, &contract_id);

        client.initialize(&admin, &invalid_token_address);
    }

    #[test]
    #[should_panic(expected = r##"Unauthorized function call"##)]
    fn test_initialize_missing_admin_auth_fails() {
        let env = Env::default();
        env.ledger().with_mut(|li| li.sequence_number = 1000);

        let contract_id = env.register_contract(None, ContentAccess);
        let client = ContentAccessClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let token_address = Address::generate(&env);

        client.initialize(&admin, &token_address);
    }

    /// Expired purchase can be re-purchased (unlock is not permanently blocked).
    #[test]
    fn test_repurchase_after_expiry() {
        let (env, contract_id, admin, token_address, buyer, creator) = setup_test();
        let client = ContentAccessClient::new(&env, &contract_id);

        client.initialize(&admin, &token_address);
        client.set_content_price(&creator, &1, &100);

        // First purchase expires at ledger 1100.
        client.unlock_content(&buyer, &creator, &1, &1100);
        assert!(client.has_access(&buyer, &creator, &1));

        // Advance past expiry.
        env.ledger().with_mut(|li| li.sequence_number = 1101);
        assert!(!client.has_access(&buyer, &creator, &1));

        // Re-purchase with a new expiry.
        client.unlock_content(&buyer, &creator, &1, &2000);
        assert!(
            client.has_access(&buyer, &creator, &1),
            "re-purchase should restore access"
        );
    }
}
