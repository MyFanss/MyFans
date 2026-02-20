#![no_std]

use soroban_sdk::contracttype;

/// Subscription lifecycle status
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum SubscriptionStatus {
    /// Subscription created but payment pending
    Pending = 0,
    /// Subscription active and valid
    Active = 1,
    /// Subscription cancelled by user or creator
    Cancelled = 2,
    /// Subscription expired (payment not renewed)
    Expired = 3,
}

/// Content access type
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum ContentType {
    /// Publicly accessible content
    Free = 0,
    /// Subscription-gated content
    Paid = 1,
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{Env, IntoVal, TryIntoVal, Val};

    #[test]
    fn test_subscription_status_values() {
        assert_eq!(SubscriptionStatus::Pending as u32, 0);
        assert_eq!(SubscriptionStatus::Active as u32, 1);
        assert_eq!(SubscriptionStatus::Cancelled as u32, 2);
        assert_eq!(SubscriptionStatus::Expired as u32, 3);
    }

    #[test]
    fn test_content_type_values() {
        assert_eq!(ContentType::Free as u32, 0);
        assert_eq!(ContentType::Paid as u32, 1);
    }

    #[test]
    fn test_subscription_status_serialization() {
        let env = Env::default();
        
        let pending = SubscriptionStatus::Pending;
        let val: Val = pending.into_val(&env);
        let decoded: SubscriptionStatus = val.try_into_val(&env).unwrap();
        assert_eq!(decoded, SubscriptionStatus::Pending);

        let active = SubscriptionStatus::Active;
        let val: Val = active.into_val(&env);
        let decoded: SubscriptionStatus = val.try_into_val(&env).unwrap();
        assert_eq!(decoded, SubscriptionStatus::Active);

        let cancelled = SubscriptionStatus::Cancelled;
        let val: Val = cancelled.into_val(&env);
        let decoded: SubscriptionStatus = val.try_into_val(&env).unwrap();
        assert_eq!(decoded, SubscriptionStatus::Cancelled);

        let expired = SubscriptionStatus::Expired;
        let val: Val = expired.into_val(&env);
        let decoded: SubscriptionStatus = val.try_into_val(&env).unwrap();
        assert_eq!(decoded, SubscriptionStatus::Expired);
    }

    #[test]
    fn test_content_type_serialization() {
        let env = Env::default();
        
        let free = ContentType::Free;
        let val: Val = free.into_val(&env);
        let decoded: ContentType = val.try_into_val(&env).unwrap();
        assert_eq!(decoded, ContentType::Free);

        let paid = ContentType::Paid;
        let val: Val = paid.into_val(&env);
        let decoded: ContentType = val.try_into_val(&env).unwrap();
        assert_eq!(decoded, ContentType::Paid);
    }

    #[test]
    fn test_enum_equality() {
        assert_eq!(SubscriptionStatus::Active, SubscriptionStatus::Active);
        assert_ne!(SubscriptionStatus::Active, SubscriptionStatus::Pending);
        
        assert_eq!(ContentType::Free, ContentType::Free);
        assert_ne!(ContentType::Free, ContentType::Paid);
    }
}
