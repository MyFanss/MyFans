#![no_std]
use myfans_lib::{ContentType, MyfansError, SubscriptionStatus};
use soroban_sdk::{contract, contractimpl, Env};

#[contract]
pub struct TestConsumer;

#[contractimpl]
impl TestConsumer {
    /// Returns true only when `status` is `Active`.
    pub fn is_active(_env: Env, status: SubscriptionStatus) -> bool {
        status == SubscriptionStatus::Active
    }

    /// Returns the numeric discriminant of a `MyfansError` variant, confirming
    /// the shared error type is importable and its codes are stable.
    pub fn error_code(_env: Env, err: MyfansError) -> u32 {
        err as u32
    }

    /// Returns the numeric discriminant of a `ContentType` variant.
    pub fn content_code(_env: Env, ct: ContentType) -> u32 {
        ct as u32
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::Env;

    // ── SubscriptionStatus ────────────────────────────────────────────────

    #[test]
    fn active_is_active() {
        let env = Env::default();
        let id = env.register_contract(None, TestConsumer);
        let client = TestConsumerClient::new(&env, &id);
        assert!(client.is_active(&SubscriptionStatus::Active));
    }

    #[test]
    fn non_active_statuses_are_not_active() {
        let env = Env::default();
        let id = env.register_contract(None, TestConsumer);
        let client = TestConsumerClient::new(&env, &id);
        assert!(!client.is_active(&SubscriptionStatus::Pending));
        assert!(!client.is_active(&SubscriptionStatus::Cancelled));
        assert!(!client.is_active(&SubscriptionStatus::Expired));
    }

    // ── MyfansError discriminants ─────────────────────────────────────────

    #[test]
    fn error_codes_are_stable() {
        let env = Env::default();
        let id = env.register_contract(None, TestConsumer);
        let client = TestConsumerClient::new(&env, &id);
        assert_eq!(client.error_code(&MyfansError::AlreadyInitialized), 1);
        assert_eq!(client.error_code(&MyfansError::NotInitialized), 2);
        assert_eq!(client.error_code(&MyfansError::NotAuthorized), 3);
        assert_eq!(client.error_code(&MyfansError::InsufficientBalance), 4);
        assert_eq!(client.error_code(&MyfansError::InvalidFeeBps), 5);
        assert_eq!(client.error_code(&MyfansError::RateLimited), 6);
        assert_eq!(client.error_code(&MyfansError::AlreadyRegistered), 7);
        assert_eq!(client.error_code(&MyfansError::NotLiked), 8);
        assert_eq!(client.error_code(&MyfansError::Paused), 9);
        assert_eq!(client.error_code(&MyfansError::ContentPriceNotSet), 101);
        assert_eq!(client.error_code(&MyfansError::SubscriptionNotFound), 102);
        assert_eq!(client.error_code(&MyfansError::SubscriptionExpired), 103);
        assert_eq!(client.error_code(&MyfansError::AdminNotInitialized), 104);
        assert_eq!(client.error_code(&MyfansError::NegativeMinBalance), 105);
        assert_eq!(client.error_code(&MyfansError::MinBalanceViolation), 106);
    }

    // ── ContentType discriminants ─────────────────────────────────────────

    #[test]
    fn content_type_codes_are_stable() {
        let env = Env::default();
        let id = env.register_contract(None, TestConsumer);
        let client = TestConsumerClient::new(&env, &id);
        assert_eq!(client.content_code(&ContentType::Free), 0);
        assert_eq!(client.content_code(&ContentType::Paid), 1);
    }

    // ── myfans-token integration (Issue #887) ─────────────────────────────

    mod token_integration {
        use myfans_token::{MyFansToken, MyFansTokenClient};
        use soroban_sdk::{testutils::Address as _, Address, Env, String};

        fn deploy_token(env: &Env) -> (MyFansTokenClient<'_>, Address) {
            let id = env.register_contract(None, MyFansToken);
            let client = MyFansTokenClient::new(env, &id);
            let admin = Address::generate(env);
            client.initialize(
                &admin,
                &String::from_str(env, "MyFans Token"),
                &String::from_str(env, "MFAN"),
                &7,
                &0,
            );
            (client, admin)
        }

        /// Mint → transfer: balances and total supply are correct.
        #[test]
        fn token_mint_and_transfer() {
            let env = Env::default();
            env.mock_all_auths();
            let (token, _) = deploy_token(&env);

            let alice = Address::generate(&env);
            let bob = Address::generate(&env);

            token.mint(&alice, &1_000);
            assert_eq!(token.total_supply(), 1_000);

            token.transfer(&alice, &bob, &400);
            assert_eq!(token.balance(&alice), 600);
            assert_eq!(token.balance(&bob), 400);
            assert_eq!(token.total_supply(), 1_000);
        }

        /// Approve → transfer_from: allowance decrements, balances shift.
        #[test]
        fn token_approve_and_transfer_from() {
            let env = Env::default();
            env.mock_all_auths();
            let (token, _) = deploy_token(&env);

            let owner = Address::generate(&env);
            let spender = Address::generate(&env);
            let receiver = Address::generate(&env);

            token.mint(&owner, &2_000);
            token.approve(&owner, &spender, &800, &10_000);
            assert_eq!(token.allowance(&owner, &spender), 800);

            token.transfer_from(&spender, &owner, &receiver, &300);
            assert_eq!(token.balance(&owner), 1_700);
            assert_eq!(token.balance(&receiver), 300);
            assert_eq!(token.allowance(&owner, &spender), 500);
        }

        /// Burn reduces balance and total supply.
        #[test]
        fn token_burn_reduces_supply() {
            let env = Env::default();
            env.mock_all_auths();
            let (token, _) = deploy_token(&env);

            let user = Address::generate(&env);
            token.mint(&user, &500);
            token.burn(&user, &200);

            assert_eq!(token.balance(&user), 300);
            assert_eq!(token.total_supply(), 300);
        }

        /// clear_allowance zeroes an existing allowance.
        #[test]
        fn token_clear_allowance() {
            let env = Env::default();
            env.mock_all_auths();
            let (token, _) = deploy_token(&env);

            let owner = Address::generate(&env);
            let spender = Address::generate(&env);
            token.mint(&owner, &1_000);
            token.approve(&owner, &spender, &500, &10_000);
            assert_eq!(token.allowance(&owner, &spender), 500);

            token.clear_allowance(&owner, &spender);
            assert_eq!(token.allowance(&owner, &spender), 0);
        }

        /// transfer_from with no prior approve returns NoAllowance (code 6).
        #[test]
        fn token_transfer_from_no_allowance_returns_error() {
            use myfans_token::Error;
            let env = Env::default();
            env.mock_all_auths();
            let (token, _) = deploy_token(&env);

            let owner = Address::generate(&env);
            let spender = Address::generate(&env);
            let receiver = Address::generate(&env);
            token.mint(&owner, &1_000);

            assert_eq!(
                token.try_transfer_from(&spender, &owner, &receiver, &100),
                Err(Ok(Error::NoAllowance))
            );
        }

        /// set_admin transfers admin rights; new admin can mint.
        #[test]
        fn token_set_admin_and_new_admin_can_mint() {
            let env = Env::default();
            env.mock_all_auths();
            let (token, _old_admin) = deploy_token(&env);

            let new_admin = Address::generate(&env);
            token.set_admin(&new_admin);
            assert_eq!(token.admin(), new_admin);

            let user = Address::generate(&env);
            token.mint(&user, &100);
            assert_eq!(token.balance(&user), 100);
        }
    }

    // ── subscription integration (Issue #897) ────────────────────────────────

    mod subscription_integration {
        use myfans_lib::error_codes::subscription as sub_err;
        use myfans_token::{MyFansToken, MyFansTokenClient};
        use soroban_sdk::{
            testutils::{Address as _, Ledger as _},
            Address, Env, Error as SorobanError, String,
        };
        use subscription::{Error as SubError, MyfansContract, MyfansContractClient};

        fn deploy_token(env: &Env) -> (MyFansTokenClient<'_>, Address) {
            let admin = Address::generate(env);
            let id = env.register_contract(None, MyFansToken);
            let client = MyFansTokenClient::new(env, &id);
            client.initialize(
                &admin,
                &String::from_str(env, "MyFans Token"),
                &String::from_str(env, "MFAN"),
                &7,
                &0,
            );
            (client, admin)
        }

        fn deploy_subscription<'a>(
            env: &'a Env,
            admin: &Address,
            fee_recipient: &Address,
            token_id: &Address,
        ) -> MyfansContractClient<'a> {
            let id = env.register_contract(None, MyfansContract);
            let client = MyfansContractClient::new(env, &id);
            client.init(admin, &500u32, fee_recipient, token_id, &1000i128);
            client
        }

        /// Subscription contract error discriminants must match the stable constants
        /// published in `myfans_lib::error_codes::subscription`.
        #[test]
        fn subscription_error_codes_match_stable_constants() {
            assert_eq!(SubError::AlreadyInitialized as u32, sub_err::ALREADY_INITIALIZED);
            assert_eq!(SubError::Paused as u32, sub_err::PAUSED);
            assert_eq!(SubError::SubscriptionNotFound as u32, sub_err::SUBSCRIPTION_NOT_FOUND);
            assert_eq!(SubError::SubscriptionExpired as u32, sub_err::SUBSCRIPTION_EXPIRED);
            assert_eq!(SubError::AdminNotInitialized as u32, sub_err::ADMIN_NOT_INITIALIZED);
            assert_eq!(SubError::InvalidFeeRecipient as u32, sub_err::INVALID_FEE_RECIPIENT);
            assert_eq!(SubError::InvalidFeeBps as u32, sub_err::INVALID_FEE_BPS);
            assert_eq!(SubError::InvalidTokenAddress as u32, sub_err::INVALID_TOKEN_ADDRESS);
            assert_eq!(SubError::InvalidPrice as u32, sub_err::INVALID_PRICE);
            assert_eq!(SubError::PlanNotFound as u32, sub_err::PLAN_NOT_FOUND);
        }

        /// End-to-end: create plan → subscribe → verify balance and active state.
        #[test]
        fn subscription_create_and_subscribe_flow() {
            let env = Env::default();
            env.mock_all_auths();
            env.ledger().with_mut(|li| {
                li.min_persistent_entry_ttl = 10_000_000;
                li.min_temp_entry_ttl = 10_000_000;
            });

            let (token, admin) = deploy_token(&env);
            let fee_recipient = Address::generate(&env);
            let sub = deploy_subscription(&env, &admin, &fee_recipient, &token.address);

            let creator = Address::generate(&env);
            let fan = Address::generate(&env);
            token.mint(&fan, &5_000i128);

            let plan_id = sub.create_plan(&creator, &token.address, &1000i128, &30u32);
            assert_eq!(plan_id, 1u32, "first plan should have id 1");

            sub.subscribe(&fan, &plan_id, &token.address);

            // 5% fee on 1000
            assert_eq!(token.balance(&fan), 4_000i128);
            assert_eq!(token.balance(&creator), 950i128);
            assert_eq!(token.balance(&fee_recipient), 50i128);
            assert!(sub.is_subscriber(&fan, &creator), "fan must be active subscriber");
        }

        /// `subscribe` with a non-existent plan returns `Error::PlanNotFound` (code 10).
        #[test]
        fn subscription_plan_not_found_returns_typed_error() {
            let env = Env::default();
            env.mock_all_auths();
            env.ledger().with_mut(|li| {
                li.min_persistent_entry_ttl = 10_000_000;
                li.min_temp_entry_ttl = 10_000_000;
            });

            let (token, admin) = deploy_token(&env);
            let fee_recipient = Address::generate(&env);
            let sub = deploy_subscription(&env, &admin, &fee_recipient, &token.address);
            let fan = Address::generate(&env);

            let result = sub.try_subscribe(&fan, &9999u32, &token.address);
            assert_eq!(
                result,
                Err(Ok(SorobanError::from_contract_error(sub_err::PLAN_NOT_FOUND))),
                "subscribing to non-existent plan must return PlanNotFound (code 10)"
            );
        }

        /// `subscribe` when contract is paused returns `Error::Paused` (code 2).
        #[test]
        fn subscription_paused_returns_typed_error() {
            let env = Env::default();
            env.mock_all_auths();
            env.ledger().with_mut(|li| {
                li.min_persistent_entry_ttl = 10_000_000;
                li.min_temp_entry_ttl = 10_000_000;
            });

            let (token, admin) = deploy_token(&env);
            let fee_recipient = Address::generate(&env);
            let sub = deploy_subscription(&env, &admin, &fee_recipient, &token.address);

            let creator = Address::generate(&env);
            let fan = Address::generate(&env);
            token.mint(&fan, &5_000i128);

            let plan_id = sub.create_plan(&creator, &token.address, &1000i128, &30u32);
            sub.pause();

            let result = sub.try_subscribe(&fan, &plan_id, &token.address);
            assert_eq!(
                result,
                Err(Ok(SorobanError::from_contract_error(sub_err::PAUSED))),
                "subscribe while paused must return Paused (code 2)"
            );
        }

        /// Cancelling a subscription removes it and `is_subscriber` returns false.
        #[test]
        fn subscription_cancel_clears_state() {
            let env = Env::default();
            env.mock_all_auths();
            env.ledger().with_mut(|li| {
                li.min_persistent_entry_ttl = 10_000_000;
                li.min_temp_entry_ttl = 10_000_000;
            });

            let (token, admin) = deploy_token(&env);
            let fee_recipient = Address::generate(&env);
            let sub = deploy_subscription(&env, &admin, &fee_recipient, &token.address);

            let creator = Address::generate(&env);
            let fan = Address::generate(&env);
            token.mint(&fan, &5_000i128);

            let plan_id = sub.create_plan(&creator, &token.address, &1000i128, &30u32);
            sub.subscribe(&fan, &plan_id, &token.address);
            assert!(sub.is_subscriber(&fan, &creator));

            sub.cancel(&fan, &creator, &0u32);
            assert!(!sub.is_subscriber(&fan, &creator), "cancelled sub must be inactive");
            assert_eq!(
                sub.get_expiry_unix(&fan, &creator),
                (0u64, 0u64),
                "expiry must be zeroed after cancel"
            );
        }
    }

    // ── content-access integration (Issue #XXXX) ────────────────────────────────

    mod content_access_integration {
        use content_access::{ContentAccess, ContentAccessClient};
        use soroban_sdk::{testutils::Address as _, Address, Env, String, Symbol};

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

        fn deploy_token(env: &Env) -> (Address) {
            let admin = Address::generate(env);
            let id = env.register_contract(None, MockToken);
            id
        }

        fn deploy_content_access<'a>(
            env: &'a Env,
            admin: &Address,
            token_id: &Address,
        ) -> ContentAccessClient<'a> {
            let id = env.register_contract(None, ContentAccess);
            let client = ContentAccessClient::new(env, &id);
            client.initialize(admin, token_id);
            client
        }

        #[test]
        fn content_access_basic_flow() {
            let env = Env::default();
            env.mock_all_auths();
            env.ledger().with_mut(|li| {
                li.sequence_number = 1000;
                li.min_persistent_entry_ttl = 10_000_000;
                li.min_temp_entry_ttl = 10_000_000;
            });

            let token_address = deploy_token(&env);
            let admin = Address::generate(&env);
            let content_access = deploy_content_access(&env, &admin, &token_address);

            let buyer = Address::generate(&env);
            let creator = Address::generate(&env);
            let content_id = 1u32;

            // Initially no access
            assert!(!content_access.has_access(&buyer, &creator, content_id));

            // Set price for content
            content_access.set_content_price(&creator, &content_id, &100);

            // Verify price is set
            assert_eq!(content_access.get_content_price(&creator, &content_id), Some(100));

            // Buyer unlocks content
            content_access.unlock_content(&buyer, &creator, content_id, &2000); // expiry far in future

            // Verify access is granted
            assert!(content_access.has_access(&buyer, &creator, content_id));

            // Verify access via verify_access (should not panic)
            content_access.verify_access(&buyer, &creator, content_id);

            // Different buyer should not have access
            let other_buyer = Address::generate(&env);
            assert!(!content_access.has_access(&other_buyer, &creator, content_id));
            let result = content_access.try_verify_access(&other_buyer, &creator, content_id);
            assert_eq!(
                result,
                Err(Ok(soroban_sdk::Error::from_contract_error(
                    content_access::Error::NotBuyer as u32,
                )))
            );

            // Test admin functions
            let new_admin = Address::generate(&env);
            content_access.set_admin(&new_admin);
            assert_eq!(content_access.admin(), new_admin);
        }

        #[test]
        fn content_access_expiry_and_repurchase() {
            let env = Env::default();
            env.mock_all_auths();
            env.ledger().with_mut(|li| {
                li.sequence_number = 1000;
                li.min_persistent_entry_ttl = 10_000_000;
                li.min_temp_entry_ttl = 10_000_000;
            });

            let token_address = deploy_token(&env);
            let admin = Address::generate(&env);
            let content_access = deploy_content_access(&env, &admin, &token_address);

            let buyer = Address::generate(&env);
            let creator = Address::generate(&env);
            let content_id = 1u32;

            content_access.set_content_price(&creator, &content_id, &50);

            // Purchase with near expiry
            content_access.unlock_content(&buyer, &creator, content_id, &1005); // expires at ledger 1005
            assert!(content_access.has_access(&buyer, &creator, content_id));

            // Advance to just before expiry
            env.ledger().with_mut(|li| li.sequence_number = 1004);
            assert!(content_access.has_access(&buyer, &creator, content_id));

            // Advance to expiry - should lose access
            env.ledger().with_mut(|li| li.sequence_number = 1006);
            assert!(!content_access.has_access(&buyer, &creator, content_id));

            // Verify access should fail with PurchaseExpired
            let result = content_access.try_verify_access(&buyer, &creator, content_id);
            assert_eq!(
                result,
                Err(Ok(soroban_sdk::Error::from_contract_error(
                    content_access::Error::PurchaseExpired as u32,
                )))
            );

            // Repurchase with new expiry
            content_access.unlock_content(&buyer, &creator, content_id, &2000);
            assert!(content_access.has_access(&buyer, &creator, content_id));
        }
    }
}
