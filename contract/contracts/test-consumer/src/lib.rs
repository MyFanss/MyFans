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

    /// Returns the numeric discriminant of a `MyfansError` variant.
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
}

/// Compile-time assertions that every `error_codes` constant matches the
/// corresponding contract `Error` discriminant.  These tests catch any
/// accidental renumbering in either the contract or the constants module.
#[cfg(test)]
mod error_code_stability {
    use myfans_lib::error_codes;

    // ── subscription ──────────────────────────────────────────────────────
    #[test]
    fn subscription_codes_match() {
        use subscription::Error;
        assert_eq!(error_codes::subscription::ALREADY_INITIALIZED,   Error::AlreadyInitialized   as u32);
        assert_eq!(error_codes::subscription::PAUSED,                 Error::Paused               as u32);
        assert_eq!(error_codes::subscription::SUBSCRIPTION_NOT_FOUND, Error::SubscriptionNotFound as u32);
        assert_eq!(error_codes::subscription::SUBSCRIPTION_EXPIRED,   Error::SubscriptionExpired  as u32);
        assert_eq!(error_codes::subscription::ADMIN_NOT_INITIALIZED,  Error::AdminNotInitialized  as u32);
        assert_eq!(error_codes::subscription::INVALID_FEE_RECIPIENT,  Error::InvalidFeeRecipient  as u32);
        assert_eq!(error_codes::subscription::INVALID_FEE_BPS,        Error::InvalidFeeBps        as u32);
        assert_eq!(error_codes::subscription::INVALID_TOKEN_ADDRESS,  Error::InvalidTokenAddress  as u32);
        assert_eq!(error_codes::subscription::INVALID_PRICE,          Error::InvalidPrice         as u32);
    }

    // ── content-access ────────────────────────────────────────────────────
    #[test]
    fn content_access_codes_match() {
        use content_access::Error;
        assert_eq!(error_codes::content_access::ALREADY_INITIALIZED,   Error::AlreadyInitialized as u32);
        assert_eq!(error_codes::content_access::CONTENT_PRICE_NOT_SET, Error::ContentPriceNotSet as u32);
        assert_eq!(error_codes::content_access::NOT_INITIALIZED,        Error::NotInitialized     as u32);
        assert_eq!(error_codes::content_access::PURCHASE_EXPIRED,       Error::PurchaseExpired    as u32);
        assert_eq!(error_codes::content_access::NOT_BUYER,              Error::NotBuyer           as u32);
    }

    // ── content-likes ─────────────────────────────────────────────────────
    #[test]
    fn content_likes_codes_match() {
        use content_likes::Error;
        assert_eq!(error_codes::content_likes::NOT_LIKED, Error::NotLiked as u32);
    }

    // ── creator-registry ──────────────────────────────────────────────────
    #[test]
    fn creator_registry_codes_match() {
        use creator_registry::Error;
        assert_eq!(error_codes::creator_registry::ALREADY_INITIALIZED, Error::AlreadyInitialized as u32);
        assert_eq!(error_codes::creator_registry::NOT_INITIALIZED,      Error::NotInitialized     as u32);
        assert_eq!(error_codes::creator_registry::UNAUTHORIZED,         Error::Unauthorized       as u32);
        assert_eq!(error_codes::creator_registry::RATE_LIMITED,         Error::RateLimited        as u32);
        assert_eq!(error_codes::creator_registry::ALREADY_REGISTERED,   Error::AlreadyRegistered  as u32);
        assert_eq!(error_codes::creator_registry::NOT_REGISTERED,       Error::NotRegistered      as u32);
        assert_eq!(error_codes::creator_registry::INVALID_AMOUNT,       Error::InvalidAmount      as u32);
    }

    // ── treasury ──────────────────────────────────────────────────────────
    #[test]
    fn treasury_codes_match() {
        use treasury::Error;
        assert_eq!(error_codes::treasury::NEGATIVE_MIN_BALANCE,  Error::NegativeMinBalance  as u32);
        assert_eq!(error_codes::treasury::PAUSED,                Error::Paused              as u32);
        assert_eq!(error_codes::treasury::INSUFFICIENT_BALANCE,  Error::InsufficientBalance as u32);
        assert_eq!(error_codes::treasury::MIN_BALANCE_VIOLATION, Error::MinBalanceViolation as u32);
        assert_eq!(error_codes::treasury::NOT_INITIALIZED,       Error::NotInitialized      as u32);
        assert_eq!(error_codes::treasury::INVALID_AMOUNT,        Error::InvalidAmount       as u32);
    }

    // ── earnings ──────────────────────────────────────────────────────────
    #[test]
    fn earnings_codes_match() {
        use earnings::Error;
        assert_eq!(error_codes::earnings::ALREADY_INITIALIZED, Error::AlreadyInitialized as u32);
    }

    // ── creator-earnings ──────────────────────────────────────────────────
    #[test]
    fn creator_earnings_codes_match() {
        use creator_earnings::Error;
        assert_eq!(error_codes::creator_earnings::NOT_INITIALIZED,      Error::NotInitialized      as u32);
        assert_eq!(error_codes::creator_earnings::NOT_AUTHORIZED,       Error::NotAuthorized       as u32);
        assert_eq!(error_codes::creator_earnings::INSUFFICIENT_BALANCE, Error::InsufficientBalance as u32);
        assert_eq!(error_codes::creator_earnings::ALREADY_INITIALIZED,  Error::AlreadyInitialized  as u32);
        assert_eq!(error_codes::creator_earnings::INVALID_AMOUNT,       Error::InvalidAmount       as u32);
    }

    // ── creator-deposits ──────────────────────────────────────────────────
    #[test]
    fn creator_deposits_codes_match() {
        use creator_deposits::Error;
        assert_eq!(error_codes::creator_deposits::INVALID_FEE_BPS,      Error::InvalidFeeBps      as u32);
        assert_eq!(error_codes::creator_deposits::INSUFFICIENT_BALANCE, Error::InsufficientBalance as u32);
    }

    // ── myfans-contract ───────────────────────────────────────────────────
    #[test]
    fn myfans_contract_codes_match() {
        use myfans_contract::Error;
        assert_eq!(error_codes::myfans_contract::CREATOR_ALREADY_REGISTERED,  Error::CreatorAlreadyRegistered  as u32);
        assert_eq!(error_codes::myfans_contract::NOT_INITIALIZED,             Error::NotInitialized            as u32);
        assert_eq!(error_codes::myfans_contract::CREATOR_NOT_REGISTERED,      Error::CreatorNotRegistered      as u32);
        assert_eq!(error_codes::myfans_contract::PAUSED,                      Error::Paused                    as u32);
        assert_eq!(error_codes::myfans_contract::SUBSCRIPTION_DOES_NOT_EXIST, Error::SubscriptionDoesNotExist  as u32);
        assert_eq!(error_codes::myfans_contract::ADMIN_NOT_INITIALIZED,       Error::AdminNotInitialized       as u32);
    }

    // ── myfans-token ──────────────────────────────────────────────────────
    #[test]
    fn myfans_token_codes_match() {
        use myfans_token::Error;
        assert_eq!(error_codes::myfans_token::INSUFFICIENT_BALANCE,   Error::InsufficientBalance   as u32);
        assert_eq!(error_codes::myfans_token::INSUFFICIENT_ALLOWANCE, Error::InsufficientAllowance as u32);
        assert_eq!(error_codes::myfans_token::ALLOWANCE_EXPIRED,      Error::AllowanceExpired      as u32);
        assert_eq!(error_codes::myfans_token::INVALID_AMOUNT,         Error::InvalidAmount         as u32);
        assert_eq!(error_codes::myfans_token::INVALID_EXPIRATION,     Error::InvalidExpiration     as u32);
        assert_eq!(error_codes::myfans_token::NO_ALLOWANCE,           Error::NoAllowance           as u32);
        assert_eq!(error_codes::myfans_token::UNAUTHORIZED,           Error::Unauthorized          as u32);
    }
}
