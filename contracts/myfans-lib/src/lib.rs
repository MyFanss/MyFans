#![no_std]

//! Shared library for the MyFans Soroban workspace.
//!
//! This crate exposes the common error type used by every member contract so
//! that error codes stay consistent across the workspace and can be surfaced
//! by ABI tooling. It intentionally contains no contract logic.

use soroban_sdk::contracterror;

/// Common error codes shared by all MyFans contracts.
///
/// Codes are grouped by concern so that a given contract can reuse the
/// relevant range without colliding with another contract's codes.
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum MyFansError {
    /// The contract has already been initialized.
    AlreadyInitialized = 1,
    /// The contract has not been initialized yet.
    NotInitialized = 2,
    /// The caller is not authorized to perform the operation.
    Unauthorized = 3,
    /// A required argument was missing or invalid.
    InvalidArgument = 4,
    /// The requested resource was not found.
    NotFound = 5,
    /// The operation would exceed an allowed limit.
    LimitExceeded = 6,
    /// The operation is not supported by this contract.
    NotSupported = 7,
    /// An arithmetic operation overflowed.
    Overflow = 8,
    /// The contract is paused and cannot process the operation.
    Paused = 9,
}

/// Convenience alias used by member contracts.
pub type Result<T, E = MyFansError> = core::result::Result<T, E>;
