//! Dummy seed data for snapshot/restore tests.
//!
//! These constants represent realistic fixture values used across
//! `test_subscription_state_after_snapshot_restore` and
//! `test_cancel_after_snapshot_restore`. Centralising them here makes
//! it easy to update all snapshot tests in one place.

/// Default subscription plan amount in stroops (1000 = 0.0001 XLM equivalent in tests).
pub const DUMMY_PLAN_AMOUNT: i128 = 1_000;

/// Default plan interval in days (30-day billing cycle).
pub const DUMMY_INTERVAL_DAYS: u32 = 30;

/// Default fan starting balance minted before each snapshot test.
pub const DUMMY_FAN_BALANCE: i128 = 10_000;

/// Default protocol fee in basis points (500 bps = 5%).
pub const DUMMY_FEE_BPS: u32 = 500;

/// Default subscription price used in `init` (matches DUMMY_PLAN_AMOUNT).
pub const DUMMY_PRICE: i128 = 1_000;

/// Ledgers per day on Stellar (one ledger every ~5 s → 17 280 ledgers/day).
pub const LEDGERS_PER_DAY: u32 = 17_280;

/// Expected expiry offset in ledgers for a 30-day plan.
/// `expiry = start_sequence + DUMMY_INTERVAL_DAYS * LEDGERS_PER_DAY`
pub const DUMMY_EXPIRY_OFFSET: u64 = (DUMMY_INTERVAL_DAYS as u64) * (LEDGERS_PER_DAY as u64);

/// Dummy content IDs used in cross-contract unlock tests.
pub const DUMMY_CONTENT_ID_1: u64 = 101;
pub const DUMMY_CONTENT_ID_2: u64 = 202;

/// Dummy content prices (in stroops).
pub const DUMMY_CONTENT_PRICE_1: i128 = 500;
pub const DUMMY_CONTENT_PRICE_2: i128 = 300;

/// Cancel reason codes (mirrors contract convention).
pub const CANCEL_REASON_USER_INITIATED: u32 = 0;
pub const CANCEL_REASON_TOO_EXPENSIVE: u32 = 1;
pub const CANCEL_REASON_CONTENT_QUALITY: u32 = 2;
pub const CANCEL_REASON_SWITCHING_CREATOR: u32 = 3;
pub const CANCEL_REASON_OTHER: u32 = 4;
