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
}
