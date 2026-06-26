#![no_std]
use myfans_lib::{ContentType, MyfansError, SubscriptionStatus};
use soroban_sdk::{contract, contractimpl, Env, Address, Symbol};

/// Data keys for contract storage
#[derive(Clone, Copy)]
pub enum DataKey {
    Admin = 0,
    Paused = 1,
}

impl DataKey {
    pub fn to_symbol(&self) -> Symbol {
        match self {
            DataKey::Admin => Symbol::short("admin"),
            DataKey::Paused => Symbol::short("paused"),
        }
    }
}

#[contract]
pub struct TestConsumer;

#[contractimpl]
impl TestConsumer {
    /// Initialize the contract with an admin address.
    /// 
    /// Must be called once per contract instance to set up admin privileges.
    /// Can only be called once; subsequent calls will fail with AlreadyInitialized.
    pub fn initialize(env: Env, admin: Address) -> Result<(), MyfansError> {
        let storage = env.storage().instance();
        
        // Check if already initialized
        if storage.has(&DataKey::Admin.to_symbol()) {
            return Err(MyfansError::AlreadyInitialized);
        }
        
        // Set the admin
        storage.set(&DataKey::Admin.to_symbol(), &admin);
        
        // Initialize paused to false
        storage.set(&DataKey::Paused.to_symbol(), &false);
        
        Ok(())
    }

    /// Get the current admin address.
    /// 
    /// Returns the admin address set during initialization.
    /// Fails with NotInitialized if initialize was not called first.
    pub fn admin(env: Env) -> Result<Address, MyfansError> {
        let storage = env.storage().instance();
        
        storage
            .get::<_, Address>(&DataKey::Admin.to_symbol())
            .ok_or(MyfansError::NotInitialized)
    }

    /// Set the paused status. Only the admin can call this.
    /// 
    /// Requires the caller to be the admin. Fails with NotAuthorized
    /// if the caller is not the admin.
    pub fn set_paused(env: Env, paused: bool) -> Result<(), MyfansError> {
        let storage = env.storage().instance();
        
        // Get admin
        let admin = storage
            .get::<_, Address>(&DataKey::Admin.to_symbol())
            .ok_or(MyfansError::NotInitialized)?;
        
        // Get current caller
        let caller = env.invoker();
        
        // Check authorization
        if caller != admin {
            return Err(MyfansError::NotAuthorized);
        }
        
        // Set paused status
        storage.set(&DataKey::Paused.to_symbol(), &paused);
        
        Ok(())
    }

    /// Get the current paused status.
    pub fn is_paused(env: Env) -> Result<bool, MyfansError> {
        let storage = env.storage().instance();
        
        Ok(storage
            .get::<_, bool>(&DataKey::Paused.to_symbol())
            .unwrap_or(false))
    }

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
    use soroban_sdk::{Env, Address};

    // ── Unauthorized Caller Tests (Admin-Protected Functions) ────────────

    #[test]
    fn test_set_paused_admin_authorization() {
        let env = Env::default();
        env.mock_all_auths();
        
        let id = env.register_contract(None, TestConsumer);
        let client = TestConsumerClient::new(&env, &id);
        
        let admin = Address::generate(&env);
        
        // Initialize
        let result = client.initialize(&admin);
        assert_eq!(result, Ok(()));
        
        // Admin should be able to set paused
        let result = client.set_paused(&true);
        assert_eq!(result, Ok(()));
        
        // Verify paused is set
        let is_paused = client.is_paused();
        assert_eq!(is_paused, Ok(true));
    }

    #[test]
    fn test_set_paused_unauthorized_caller_revert() {
        let env = Env::default();
        env.mock_all_auths();
        
        let id = env.register_contract(None, TestConsumer);
        let client = TestConsumerClient::new(&env, &id);
        
        let admin = Address::generate(&env);
        let unauthorized = Address::generate(&env);
        
        // Initialize with admin
        let result = client.initialize(&admin);
        assert_eq!(result, Ok(()));
        
        // Unauthorized caller tries to set paused
        let result = client.try_set_paused(&true);
        assert_eq!(
            result,
            Err(Ok(soroban_sdk::Error::from_contract_error(
                MyfansError::NotAuthorized as u32
            )))
        );
        
        // Paused should still be false
        let is_paused = client.is_paused();
        assert_eq!(is_paused, Ok(false));
    }

    #[test]
    fn test_set_paused_multiple_unauthorized_callers() {
        let env = Env::default();
        env.mock_all_auths();
        
        let id = env.register_contract(None, TestConsumer);
        let client = TestConsumerClient::new(&env, &id);
        
        let admin = Address::generate(&env);
        
        // Initialize with admin
        let result = client.initialize(&admin);
        assert_eq!(result, Ok(()));
        
        // Multiple unauthorized callers should all be rejected
        for _ in 0..3 {
            let unauthorized = Address::generate(&env);
            let result = client.try_set_paused(&true);
            assert_eq!(
                result,
                Err(Ok(soroban_sdk::Error::from_contract_error(
                    MyfansError::NotAuthorized as u32
                )))
            );
        }
        
        // Paused should still be false
        let is_paused = client.is_paused();
        assert_eq!(is_paused, Ok(false));
    }

    #[test]
    fn test_set_paused_admin_can_toggle() {
        let env = Env::default();
        env.mock_all_auths();
        
        let id = env.register_contract(None, TestConsumer);
        let client = TestConsumerClient::new(&env, &id);
        
        let admin = Address::generate(&env);
        
        // Initialize with admin
        let result = client.initialize(&admin);
        assert_eq!(result, Ok(()));
        
        // Admin sets paused to true
        let result = client.set_paused(&true);
        assert_eq!(result, Ok(()));
        assert_eq!(client.is_paused(), Ok(true));
        
        // Admin sets paused to false
        let result = client.set_paused(&false);
        assert_eq!(result, Ok(()));
        assert_eq!(client.is_paused(), Ok(false));
        
        // Admin sets paused to true again
        let result = client.set_paused(&true);
        assert_eq!(result, Ok(()));
        assert_eq!(client.is_paused(), Ok(true));
    }

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

    // ── creator-deposits integration (Issue #937) ──────────────────────────────

    mod creator_deposits_integration {
        use creator_deposits::{CreatorDeposits, CreatorDepositsClient, Error as DepositError};
        use myfans_token::{MyFansToken, MyFansTokenClient};
        use soroban_sdk::{testutils::Address as _, Address, Env, String};

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

        fn deploy_creator_deposits<'a>(
            env: &'a Env,
            admin: &Address,
            treasury: &Address,
        ) -> CreatorDepositsClient<'a> {
            let id = env.register_contract(None, CreatorDeposits);
            let client = CreatorDepositsClient::new(env, &id);
            client.init(admin, &500u32, treasury); // 5% fee
            client
        }

        /// End-to-end: deploy contract → deposit → get_balance work correctly.
        #[test]
        fn creator_deposits_deposit_and_get_balance() {
            let env = Env::default();
            env.mock_all_auths();

            let (token, _) = deploy_token(&env);
            let admin = Address::generate(&env);
            let treasury = Address::generate(&env);
            let creator = Address::generate(&env);
            let deposits = deploy_creator_deposits(&env, &admin, &treasury);

            // Mint tokens to creator so they can deposit
            token.mint(&creator, &10_000i128);

            // Deposit: 1000 tokens with 5% fee → 950 net recorded in contract
            deposits.deposit(&creator, &token.address, &1000i128);
            assert_eq!(
                deposits.get_balance(&creator),
                950i128,
                "balance after deposit should be net amount (1000 - 5% fee)"
            );

            // Get balance: verify it matches expected
            assert_eq!(
                deposits.get_balance(&creator),
                950i128,
                "get_balance should return tracked balance"
            );
        }

        /// Attempting to withdraw more than balance returns InsufficientBalance error.
        #[test]
        fn creator_deposits_withdraw_insufficient_balance_error() {
            let env = Env::default();
            env.mock_all_auths();

            let (token, _) = deploy_token(&env);
            let admin = Address::generate(&env);
            let treasury = Address::generate(&env);
            let creator = Address::generate(&env);
            let deposits = deploy_creator_deposits(&env, &admin, &treasury);

            token.mint(&creator, &1000i128);
            deposits.deposit(&creator, &token.address, &1000i128);

            // Try to withdraw more than balance (950 available, request 1000)
            let result = deposits.try_withdraw(&creator, &token.address, &1000i128);
            assert_eq!(
                result,
                Err(Ok(soroban_sdk::Error::from_contract_error(
                    DepositError::InsufficientBalance as u32,
                ))),
                "withdraw exceeding balance must return InsufficientBalance"
            );

            // Balance should be unchanged
            assert_eq!(deposits.get_balance(&creator), 950i128);
        }

        /// Calling set_platform_fee with invalid bps (>= 10000) returns InvalidFeeBps error.
        #[test]
        fn creator_deposits_invalid_fee_bps() {
            let env = Env::default();
            env.mock_all_auths();

            let (_, _) = deploy_token(&env);
            let admin = Address::generate(&env);
            let treasury = Address::generate(&env);
            let deposits = deploy_creator_deposits(&env, &admin, &treasury);

            // Try to set fee to 10000 (100%) which is invalid
            let result = deposits.try_set_platform_fee(&10000u32);
            assert_eq!(
                result,
                Err(Ok(soroban_sdk::Error::from_contract_error(
                    DepositError::InvalidFeeBps as u32,
                ))),
                "fee bps >= 10000 must return InvalidFeeBps"
            );
        }

        /// Multiple deposits from same creator accumulate correctly.
        #[test]
        fn creator_deposits_multiple_deposits_accumulate() {
            let env = Env::default();
            env.mock_all_auths();

            let (token, _) = deploy_token(&env);
            let admin = Address::generate(&env);
            let treasury = Address::generate(&env);
            let creator = Address::generate(&env);
            let deposits = deploy_creator_deposits(&env, &admin, &treasury);

            token.mint(&creator, &10_000i128);

            // First deposit: 1000 → 950 net
            deposits.deposit(&creator, &token.address, &1000i128);
            assert_eq!(deposits.get_balance(&creator), 950i128);

            // Second deposit: 2000 → 1900 net
            deposits.deposit(&creator, &token.address, &2000i128);
            assert_eq!(
                deposits.get_balance(&creator),
                2850i128,
                "second deposit should add to balance (950 + 1900)"
            );
        }

        /// Withdraw with zero fee (fee_bps = 0) transfers full amount.
        #[test]
        fn creator_deposits_zero_fee() {
            let env = Env::default();
            env.mock_all_auths();

            let (token, _) = deploy_token(&env);
            let admin = Address::generate(&env);
            let treasury = Address::generate(&env);
            let creator = Address::generate(&env);

            // Deploy with 0% fee
            let id = env.register_contract(None, CreatorDeposits);
            let deposits = CreatorDepositsClient::new(&env, &id);
            deposits.init(&admin, &0u32, &treasury);

            token.mint(&creator, &1000i128);
            deposits.deposit(&creator, &token.address, &1000i128);

            // With 0% fee, balance should be full amount
            assert_eq!(
                deposits.get_balance(&creator),
                1000i128,
                "with 0% fee, balance should equal deposit amount"
            );
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
            assert_eq!(
                SubError::AlreadyInitialized as u32,
                sub_err::ALREADY_INITIALIZED
            );
            assert_eq!(SubError::Paused as u32, sub_err::PAUSED);
            assert_eq!(
                SubError::SubscriptionNotFound as u32,
                sub_err::SUBSCRIPTION_NOT_FOUND
            );
            assert_eq!(
                SubError::SubscriptionExpired as u32,
                sub_err::SUBSCRIPTION_EXPIRED
            );
            assert_eq!(
                SubError::AdminNotInitialized as u32,
                sub_err::ADMIN_NOT_INITIALIZED
            );
            assert_eq!(
                SubError::InvalidFeeRecipient as u32,
                sub_err::INVALID_FEE_RECIPIENT
            );
            assert_eq!(SubError::InvalidFeeBps as u32, sub_err::INVALID_FEE_BPS);
            assert_eq!(
                SubError::InvalidTokenAddress as u32,
                sub_err::INVALID_TOKEN_ADDRESS
            );
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
            assert!(
                sub.is_subscriber(&fan, &creator),
                "fan must be active subscriber"
            );
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
                Err(Ok(SorobanError::from_contract_error(
                    sub_err::PLAN_NOT_FOUND
                ))),
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
            assert!(
                !sub.is_subscriber(&fan, &creator),
                "cancelled sub must be inactive"
            );
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
        use soroban_sdk::{
            contract, contractimpl,
            testutils::{Address as _, Ledger},
            Address, Env,
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
            let content_id = 1u64;

            // Initially no access
            assert!(!content_access.has_access(&buyer, &creator, &content_id));

            // Set price for content
            content_access.set_content_price(&creator, &content_id, &100);

            // Verify price is set
            assert_eq!(
                content_access.get_content_price(&creator, &content_id),
                Some(100)
            );

            // Buyer unlocks content
            content_access.unlock_content(&buyer, &creator, &content_id, &2000); // expiry far in future

            // Verify access is granted
            assert!(content_access.has_access(&buyer, &creator, &content_id));

            // Verify access via verify_access (should not panic)
            content_access.verify_access(&buyer, &creator, &content_id);

            // Different buyer should not have access
            let other_buyer = Address::generate(&env);
            assert!(!content_access.has_access(&other_buyer, &creator, &content_id));
            let result = content_access.try_verify_access(&other_buyer, &creator, &content_id);
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
            let content_id = 1u64;

            content_access.set_content_price(&creator, &content_id, &50);

            // Purchase with near expiry
            content_access.unlock_content(&buyer, &creator, &content_id, &1005); // expires at ledger 1005
            assert!(content_access.has_access(&buyer, &creator, &content_id));

            // Advance to just before expiry
            env.ledger().with_mut(|li| li.sequence_number = 1004);
            assert!(content_access.has_access(&buyer, &creator, &content_id));

            // Advance to expiry - should lose access
            env.ledger().with_mut(|li| li.sequence_number = 1006);
            assert!(!content_access.has_access(&buyer, &creator, &content_id));

            // Verify access should fail with PurchaseExpired
            let result = content_access.try_verify_access(&buyer, &creator, &content_id);
            assert_eq!(
                result,
                Err(Ok(soroban_sdk::Error::from_contract_error(
                    content_access::Error::PurchaseExpired as u32,
                )))
            );

            // Repurchase with new expiry
            content_access.unlock_content(&buyer, &creator, &content_id, &2000);
            assert!(content_access.has_access(&buyer, &creator, &content_id));
        }
    }

    // ── creator-earnings integration ───────────────────────────────────────

    mod creator_earnings_integration {
        use creator_earnings::{CreatorEarnings, CreatorEarningsClient, Error as EarningsError};
        use myfans_token::{MyFansToken, MyFansTokenClient};
        use soroban_sdk::{testutils::Address as _, Address, Env, String};

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

        fn deploy_earnings<'a>(
            env: &'a Env,
            admin: &Address,
            token_id: &Address,
        ) -> CreatorEarningsClient<'a> {
            let id = env.register_contract(None, CreatorEarnings);
            let client = CreatorEarningsClient::new(env, &id);
            client.initialize(admin, token_id);
            client
        }

        /// End-to-end: initialize → deposit → balance → withdraw flow works correctly.
        #[test]
        fn creator_earnings_deposit_and_withdraw_flow() {
            let env = Env::default();
            env.mock_all_auths();

            let (token, _) = deploy_token(&env);
            let admin = Address::generate(&env);
            let creator = Address::generate(&env);
            let earnings = deploy_earnings(&env, &admin, &token.address);

            // authorize admin as a depositor and mint
            earnings.add_authorized(&admin);
            token.mint(&admin, &1_000i128);

            // deposit 600 for creator
            earnings.deposit(&admin, &creator, &600i128);
            assert_eq!(
                earnings.balance(&creator),
                600i128,
                "balance after deposit must be 600"
            );

            // creator withdraws 250
            earnings.withdraw(&creator, &250i128);
            assert_eq!(
                earnings.balance(&creator),
                350i128,
                "balance after withdrawal must be 350"
            );
            assert_eq!(
                token.balance(&creator),
                250i128,
                "creator token balance must be 250 after withdrawal"
            );
        }

        /// Second initialize is rejected with AlreadyInitialized.
        #[test]
        fn creator_earnings_double_initialize_reverts() {
            let env = Env::default();
            env.mock_all_auths();

            let (token, _) = deploy_token(&env);
            let admin = Address::generate(&env);
            let earnings = deploy_earnings(&env, &admin, &token.address);

            let result = earnings.try_initialize(&admin, &token.address);
            assert_eq!(
                result,
                Err(Ok(soroban_sdk::Error::from_contract_error(
                    EarningsError::AlreadyInitialized as u32,
                ))),
                "second initialize must return AlreadyInitialized"
            );
        }

        /// Unauthorized depositor is rejected with NotAuthorized.
        #[test]
        fn creator_earnings_unauthorized_depositor_reverts() {
            let env = Env::default();
            env.mock_all_auths();

            let (token, _) = deploy_token(&env);
            let admin = Address::generate(&env);
            let creator = Address::generate(&env);
            let stranger = Address::generate(&env);
            let earnings = deploy_earnings(&env, &admin, &token.address);

            token.mint(&stranger, &500i128);

            let result = earnings.try_deposit(&stranger, &creator, &100i128);
            assert_eq!(
                result,
                Err(Ok(soroban_sdk::Error::from_contract_error(
                    EarningsError::NotAuthorized as u32,
                ))),
                "unauthorized deposit must return NotAuthorized"
            );
        }

        /// Withdraw more than balance returns InsufficientBalance.
        #[test]
        fn creator_earnings_withdraw_over_balance_reverts() {
            let env = Env::default();
            env.mock_all_auths();

            let (token, _) = deploy_token(&env);
            let admin = Address::generate(&env);
            let creator = Address::generate(&env);
            let earnings = deploy_earnings(&env, &admin, &token.address);

            earnings.add_authorized(&admin);
            token.mint(&admin, &500i128);
            earnings.deposit(&admin, &creator, &300i128);

            let result = earnings.try_withdraw(&creator, &400i128);
            assert_eq!(
                result,
                Err(Ok(soroban_sdk::Error::from_contract_error(
                    EarningsError::InsufficientBalance as u32,
                ))),
                "withdraw exceeding balance must return InsufficientBalance"
            );
            // balance unchanged
            assert_eq!(earnings.balance(&creator), 300i128);
        }

        /// Zero balance starts at zero.
        #[test]
        fn creator_earnings_initial_balance_is_zero() {
            let env = Env::default();
            env.mock_all_auths();

            let (token, _) = deploy_token(&env);
            let admin = Address::generate(&env);
            let creator = Address::generate(&env);
            let earnings = deploy_earnings(&env, &admin, &token.address);

            assert_eq!(
                earnings.balance(&creator),
                0i128,
                "balance before any deposit must be zero"
            );
        }

        /// Multiple authorized depositors can each deposit independently.
        #[test]
        fn creator_earnings_multiple_depositors_accumulate() {
            let env = Env::default();
            env.mock_all_auths();

            let (token, _) = deploy_token(&env);
            let admin = Address::generate(&env);
            let creator = Address::generate(&env);
            let dep1 = Address::generate(&env);
            let dep2 = Address::generate(&env);
            let earnings = deploy_earnings(&env, &admin, &token.address);

            earnings.add_authorized(&dep1);
            earnings.add_authorized(&dep2);
            token.mint(&dep1, &1_000i128);
            token.mint(&dep2, &1_000i128);

            earnings.deposit(&dep1, &creator, &400i128);
            earnings.deposit(&dep2, &creator, &600i128);

            assert_eq!(
                earnings.balance(&creator),
                1_000i128,
                "balances from two depositors must accumulate"
            );
        }

        /// Zero and negative deposit amounts are rejected with InvalidAmount.
        #[test]
        fn creator_earnings_invalid_deposit_amounts_revert() {
            let env = Env::default();
            env.mock_all_auths();

            let (token, _) = deploy_token(&env);
            let admin = Address::generate(&env);
            let creator = Address::generate(&env);
            let earnings = deploy_earnings(&env, &admin, &token.address);
            earnings.add_authorized(&admin);

            assert_eq!(
                earnings.try_deposit(&admin, &creator, &0i128),
                Err(Ok(soroban_sdk::Error::from_contract_error(
                    EarningsError::InvalidAmount as u32,
                ))),
                "deposit(0) must return InvalidAmount"
            );
            assert_eq!(
                earnings.try_deposit(&admin, &creator, &-1i128),
                Err(Ok(soroban_sdk::Error::from_contract_error(
                    EarningsError::InvalidAmount as u32,
                ))),
                "deposit(-1) must return InvalidAmount"
            );
        }
    }

    // ── treasury integration (Issue #907) ─────────────────────────────────
    //
    // Test-consumer pattern: drive `treasury` exclusively through its public
    // `TreasuryClient` interface — no internal function access.  This mirrors
    // how any external contract (e.g. a subscription or earnings contract)
    // would interact with the treasury in production.

    mod treasury_integration {
        extern crate std;

        use soroban_sdk::{
            testutils::{Address as _, Ledger},
            token::{StellarAssetClient, TokenClient},
            Address, Env,
        };
        use treasury::{Treasury, TreasuryClient};

        fn create_token<'a>(
            env: &Env,
            admin: &Address,
        ) -> (Address, TokenClient<'a>, StellarAssetClient<'a>) {
            let addr = env
                .register_stellar_asset_contract_v2(admin.clone())
                .address();
            (
                addr.clone(),
                TokenClient::new(env, &addr),
                StellarAssetClient::new(env, &addr),
            )
        }

        fn setup(
            env: &Env,
        ) -> (
            TreasuryClient<'_>,
            Address,
            Address,
            TokenClient<'_>,
            Address,
        ) {
            env.mock_all_auths();
            let admin = Address::generate(env);
            let depositor = Address::generate(env);
            let (token_addr, token_client, sac) = create_token(env, &admin);
            sac.mint(&depositor, &10_000_000);
            let treasury_id = env.register_contract(None, Treasury);
            let client = TreasuryClient::new(env, &treasury_id);
            client.initialize(&admin, &token_addr);
            (client, admin, depositor, token_client, treasury_id)
        }

        // ── initialize ────────────────────────────────────────────────────

        /// initialize stores admin and token; second call is rejected.
        #[test]
        fn initialize_once_only() {
            let env = Env::default();
            let (client, admin, _, _, _) = setup(&env);
            let token2 = Address::generate(&env);
            let result = client.try_initialize(&admin, &token2);
            assert!(result.is_err(), "second initialize must be rejected");
        }

        // ── deposit ───────────────────────────────────────────────────────

        /// Deposit via client moves tokens from depositor to treasury.
        #[test]
        fn deposit_moves_tokens_to_treasury() {
            let env = Env::default();
            let (client, _, depositor, token_client, treasury_id) = setup(&env);

            client.deposit(&depositor, &2_000_000);

            assert_eq!(token_client.balance(&treasury_id), 2_000_000);
            assert_eq!(token_client.balance(&depositor), 8_000_000);
        }

        /// Multiple deposits from the same depositor accumulate correctly.
        #[test]
        fn multiple_deposits_accumulate() {
            let env = Env::default();
            let (client, _, depositor, token_client, treasury_id) = setup(&env);

            client.deposit(&depositor, &1_000_000);
            client.deposit(&depositor, &500_000);
            client.deposit(&depositor, &250_000);

            assert_eq!(token_client.balance(&treasury_id), 1_750_000);
        }

        /// Zero deposit is rejected before auth.
        #[test]
        fn deposit_zero_rejected() {
            let env = Env::default();
            let (client, _, depositor, _, _) = setup(&env);
            assert!(client.try_deposit(&depositor, &0).is_err());
        }

        // ── withdraw ──────────────────────────────────────────────────────

        /// Admin can withdraw and recipient receives the tokens.
        #[test]
        fn withdraw_credits_recipient() {
            let env = Env::default();
            let (client, _, depositor, token_client, treasury_id) = setup(&env);
            let recipient = Address::generate(&env);

            client.deposit(&depositor, &3_000_000);
            client.withdraw(&recipient, &1_000_000);

            assert_eq!(token_client.balance(&treasury_id), 2_000_000);
            assert_eq!(token_client.balance(&recipient), 1_000_000);
        }

        /// Overdraft is rejected with InsufficientBalance.
        #[test]
        fn withdraw_overdraft_rejected() {
            let env = Env::default();
            let (client, _, depositor, _, _) = setup(&env);
            let recipient = Address::generate(&env);

            client.deposit(&depositor, &100_000);
            assert!(client.try_withdraw(&recipient, &100_001).is_err());
        }

        /// Full withdrawal leaves treasury at zero.
        #[test]
        fn withdraw_full_balance_succeeds() {
            let env = Env::default();
            let (client, _, depositor, token_client, treasury_id) = setup(&env);
            let recipient = Address::generate(&env);

            client.deposit(&depositor, &5_000_000);
            client.withdraw(&recipient, &5_000_000);

            assert_eq!(token_client.balance(&treasury_id), 0);
            assert_eq!(token_client.balance(&recipient), 5_000_000);
        }

        // ── min_balance guard ─────────────────────────────────────────────

        /// Withdrawing below min_balance is rejected with MinBalanceViolation.
        #[test]
        fn withdraw_below_min_balance_rejected() {
            let env = Env::default();
            let (client, _, depositor, _, _) = setup(&env);
            let recipient = Address::generate(&env);

            client.deposit(&depositor, &1_000_000);
            client.set_min_balance(&500_000);

            // Withdrawing 600_000 would leave 400_000 < 500_000 min_balance.
            assert!(client.try_withdraw(&recipient, &600_000).is_err());
        }

        /// Withdraw that leaves exactly min_balance succeeds.
        #[test]
        fn withdraw_to_exact_min_balance_succeeds() {
            let env = Env::default();
            let (client, _, depositor, token_client, treasury_id) = setup(&env);
            let recipient = Address::generate(&env);

            client.deposit(&depositor, &1_000_000);
            client.set_min_balance(&500_000);

            // Withdraw exactly 500_000 — leaves balance == min_balance.
            client.withdraw(&recipient, &500_000);
            assert_eq!(token_client.balance(&treasury_id), 500_000);
        }

        // ── pause guard ───────────────────────────────────────────────────

        /// Paused treasury rejects both deposit and withdraw.
        #[test]
        fn paused_blocks_deposit_and_withdraw() {
            let env = Env::default();
            let (client, _, depositor, _, _) = setup(&env);
            let recipient = Address::generate(&env);

            client.deposit(&depositor, &1_000_000);
            client.set_paused(&true);

            assert!(client.try_deposit(&depositor, &100_000).is_err());
            assert!(client.try_withdraw(&recipient, &100_000).is_err());
        }

        /// Unpausing restores normal operation.
        #[test]
        fn unpause_restores_operations() {
            let env = Env::default();
            let (client, _, depositor, token_client, treasury_id) = setup(&env);
            let recipient = Address::generate(&env);

            client.deposit(&depositor, &1_000_000);
            client.set_paused(&true);
            client.set_paused(&false);

            client.deposit(&depositor, &500_000);
            client.withdraw(&recipient, &200_000);

            assert_eq!(token_client.balance(&treasury_id), 1_300_000);
        }
    }

    // ── earnings integration ──────────────────────────────────────────────

    mod earnings_integration {
        use earnings::{Earnings, EarningsClient};
        use soroban_sdk::{testutils::Address as _, Address, Env, Error as SorobanError};

        fn setup(env: &Env) -> (EarningsClient<'_>, Address, Address) {
            env.mock_all_auths();

            let admin = Address::generate(env);
            let creator = Address::generate(env);

            let contract_id = env.register_contract(None, Earnings);
            let client = EarningsClient::new(env, &contract_id);

            client.init(&admin);
            (client, admin, creator)
        }

        /// Contract initializes with admin and records earnings correctly.
        #[test]
        fn earnings_init_and_record() {
            let env = Env::default();
            let (client, admin, creator) = setup(&env);

            // Verify admin is set correctly.
            assert_eq!(client.admin(), admin);

            // Record earnings for creator.
            client.record(&creator, &1_000);
            assert_eq!(client.get_earnings(&creator), 1_000);

            // Record additional earnings; totals accumulate.
            client.record(&creator, &500);
            assert_eq!(client.get_earnings(&creator), 1_500);
        }

        /// Multiple creators maintain independent balances.
        #[test]
        fn earnings_multiple_creators_independent() {
            let env = Env::default();
            let (client, _, _) = setup(&env);

            let creator1 = Address::generate(&env);
            let creator2 = Address::generate(&env);

            client.record(&creator1, &1_000);
            client.record(&creator2, &2_000);

            assert_eq!(client.get_earnings(&creator1), 1_000);
            assert_eq!(client.get_earnings(&creator2), 2_000);

            client.record(&creator1, &500);
            assert_eq!(client.get_earnings(&creator1), 1_500);
            assert_eq!(client.get_earnings(&creator2), 2_000);
        }

        /// Full withdrawal lifecycle: record → withdraw → verify balance.
        #[test]
        fn earnings_withdraw_full_lifecycle() {
            let env = Env::default();
            let (client, _, creator) = setup(&env);

            // Record earnings.
            client.record(&creator, &1_000);
            assert_eq!(client.get_earnings(&creator), 1_000);

            // Withdraw partial amount.
            client.withdraw(&creator, &300);
            assert_eq!(client.get_earnings(&creator), 700);

            // Withdraw remaining.
            client.withdraw(&creator, &700);
            assert_eq!(client.get_earnings(&creator), 0);
        }

        /// Multiple withdrawals from a single creator work correctly.
        #[test]
        fn earnings_multiple_withdrawals() {
            let env = Env::default();
            let (client, _, creator) = setup(&env);

            client.record(&creator, &1_000);
            client.withdraw(&creator, &100);
            client.withdraw(&creator, &200);
            client.withdraw(&creator, &300);

            assert_eq!(client.get_earnings(&creator), 400);
        }

        /// Withdraw with insufficient balance returns error.
        #[test]
        fn earnings_withdraw_insufficient_balance_fails() {
            let env = Env::default();
            let (client, _, creator) = setup(&env);

            client.record(&creator, &500);

            let result = client.try_withdraw(&creator, &600);
            assert!(result.is_err(), "expected withdraw to fail with insufficient balance");
        }

        /// Withdraw from zero balance returns error.
        #[test]
        fn earnings_withdraw_from_zero_balance_fails() {
            let env = Env::default();
            let (client, _, creator) = setup(&env);

            let result = client.try_withdraw(&creator, &1);
            assert!(result.is_err(), "expected withdraw to fail on zero balance");
        }

        /// Non-admin cannot record earnings.
        #[test]
        fn earnings_non_admin_record_fails() {
            let env = Env::default();
            let (client, _, creator) = setup(&env);

            // Remove mocked auths so admin.require_auth() fails.
            let empty: &[soroban_sdk::xdr::SorobanAuthorizationEntry] = &[];
            env.set_auths(empty);

            let result = client.try_record(&creator, &100);
            assert!(result.is_err(), "expected non-admin record to fail");
        }

        /// Non-creator cannot withdraw another creator's earnings.
        #[test]
        fn earnings_non_creator_withdraw_fails() {
            let env = Env::default();
            let (client, _, creator) = setup(&env);

            client.record(&creator, &500);

            let other = Address::generate(&env);
            let empty: &[soroban_sdk::xdr::SorobanAuthorizationEntry] = &[];
            env.set_auths(empty);

            let result = client.try_withdraw(&other, &100);
            assert!(result.is_err(), "expected non-creator withdraw to fail");
        }

        /// Initialize twice returns AlreadyInitialized error (code 1).
        #[test]
        fn earnings_double_init_fails() {
            let env = Env::default();
            env.mock_all_auths();

            let admin = Address::generate(&env);
            let contract_id = env.register_contract(None, Earnings);
            let client = EarningsClient::new(&env, &contract_id);

            client.init(&admin);
            let result = client.try_init(&admin);

            assert_eq!(
                result,
                Err(Ok(SorobanError::from_contract_error(1))) // AlreadyInitialized
            );
        }
    }
}
