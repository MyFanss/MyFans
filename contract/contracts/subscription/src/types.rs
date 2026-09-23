//! Shared types, storage keys, and event schema for the subscription contract.
//!
//! The event topic + body schema defined here is frozen and consumed by the
//! backend poller (`TARGET_EVENTS`) and the CI fixture script
//! `contract/scripts/check-subscription-event-fixture.test.mjs`. Do not change
//! topic symbols or body field ordering without updating that fixture.

use soroban_sdk::{contracterror, contracttype, Address, Symbol};

/// Maximum protocol fee, in basis points (10%).
///
/// `init` and the admin fee setter MUST reject any value above this cap;
/// `10_000` (100%) is never allowed.
pub const MAX_FEE_BPS: u32 = 1000;

/// Basis-point denominator used when splitting payments.
pub const BPS_DENOMINATOR: u32 = 10_000;

/// Typed errors returned by the subscription contract.
///
/// Kept explicit (rather than panicking) so callers and the indexer can
/// distinguish failure modes without parsing panic strings.
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum SubscriptionError {
    /// Contract has already been initialized.
    AlreadyInitialized = 1,
    /// Contract has not been initialized yet.
    NotInitialized = 2,
    /// Caller is not authorized for this operation.
    Unauthorized = 3,
    /// Contract is paused; mutating entrypoints are blocked.
    Paused = 4,
    /// Fee basis points exceed `MAX_FEE_BPS`.
    FeeTooHigh = 5,
    /// Plan does not exist.
    PlanNotFound = 6,
    /// Plan amount or interval is zero.
    InvalidPlan = 7,
    /// Subscription does not exist for the given (fan, creator) pair.
    NotSubscribed = 8,
    /// Subscription is already active; renew instead of subscribing again.
    AlreadySubscribed = 9,
    /// Asset passed by the caller does not match the plan asset.
    AssetMismatch = 10,
    /// Ledger arithmetic would overflow `u64`.
    LedgerOverflow = 11,
    /// `fee_recipient` is not the configured treasury contract id.
    InvalidFeeRecipient = 12,
}

/// A creator subscription plan.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Plan {
    /// Creator that owns the plan and receives the post-fee payout.
    pub creator: Address,
    /// Token contract used for payment.
    pub asset: Address,
    /// Amount charged per period, in the asset's smallest unit.
    pub amount: i128,
    /// Period length in ledgers. Must be non-zero.
    pub interval: u64,
    /// Whether the plan accepts new subscribers.
    pub active: bool,
}

/// An active subscription record for a (fan, creator) pair.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Subscription {
    /// Fan that pays for the subscription.
    pub fan: Address,
    /// Creator the fan is subscribed to.
    pub creator: Address,
    /// Ledger at which the current period expires.
    pub expires_at: u64,
    /// Ledger at which the subscription was cancelled, if any.
    pub cancelled_at: Option<u64>,
}

/// Frozen event topic symbols.
///
/// These symbols are the contract's public event interface. The backend poller
/// filters on them and the CI fixture asserts they stay stable.
pub mod topics {
    use soroban_sdk::{symbol_short, Symbol};

    /// Emitted by `init`.
    pub fn init() -> Symbol {
        symbol_short!("init")
    }

    /// Emitted by `create_plan`.
    pub fn plan_created() -> Symbol {
        symbol_short!("plan_crt")
    }

    /// Emitted by `subscribe`.
    pub fn subscribed() -> Symbol {
        symbol_short!("subscr")
    }

    /// Emitted by `renew` / `extend_subscription`.
    pub fn renewed() -> Symbol {
        symbol_short!("renew")
    }

    /// Emitted by `cancel`.
    pub fn cancelled() -> Symbol {
        symbol_short!("cancel")
    }

    /// Emitted by `pause` / `unpause`.
    pub fn paused() -> Symbol {
        symbol_short!("paused")
    }

    /// Emitted by the admin fee setter.
    pub fn fee_updated() -> Symbol {
        symbol_short!("fee_upd")
    }
}

/// Frozen event body schema.
///
/// Field order is part of the contract: the backend decodes bodies positionally
/// and the CI fixture pins the shape. Add new fields only at the end and bump
/// the fixture in the same change.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PlanCreatedEvent {
    pub creator: Address,
    pub asset: Address,
    pub amount: i128,
    pub interval: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SubscribedEvent {
    pub fan: Address,
    pub creator: Address,
    pub amount: i128,
    pub fee: i128,
    pub expires_at: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RenewedEvent {
    pub fan: Address,
    pub creator: Address,
    pub amount: i128,
    pub fee: i128,
    pub expires_at: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CancelledEvent {
    pub fan: Address,
    pub creator: Address,
    pub cancelled_at: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PausedEvent {
    pub paused: bool,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FeeUpdatedEvent {
    pub protocol_fee_bps: u32,
    pub fee_recipient: Address,
}

/// Storage keys used by the subscription contract.
///
/// Every key MUST be documented in `contract/STORAGE_KEYS.md` before merge.
/// Instance keys hold singleton config; Persistent keys hold per-plan and
/// per-subscription records.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    /// Instance: contract admin address.
    Admin,
    /// Instance: protocol fee in basis points (<= `MAX_FEE_BPS`).
    ProtocolFeeBps,
    /// Instance: treasury contract id that receives the protocol fee.
    FeeRecipient,
    /// Instance: pause flag blocking mutating entrypoints.
    Paused,
    /// Persistent: plan keyed by (creator, plan id).
    Plan(Address, u64),
    /// Persistent: subscription keyed by (fan, creator).
    Subscription(Address, Address),
}

/// Split `amount` into (fee, remainder) using `fee_bps`.
///
/// Returns the protocol fee routed to the treasury and the remainder paid to
/// the creator. Callers MUST validate `fee_bps <= MAX_FEE_BPS` before use.
pub fn split_fee(amount: i128, fee_bps: u32) -> (i128, i128) {
    let fee = amount * (fee_bps as i128) / (BPS_DENOMINATOR as i128);
    (fee, amount - fee)
}

/// Checked ledger addition used by renew/extend.
///
/// Returns `LedgerOverflow` instead of wrapping when the new expiry would
/// exceed `u64::MAX`.
pub fn checked_expiry(current: u64, interval: u64) -> Result<u64, SubscriptionError> {
    current
        .checked_add(interval)
        .ok_or(SubscriptionError::LedgerOverflow)
}
