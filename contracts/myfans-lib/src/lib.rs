//! Shared error types and utilities for MyFans Soroban contracts.
//!
//! The error codes defined here stay consistent across the workspace and can be
//! surfaced by ABI tooling.
#![no_std]

use soroban_sdk::contracterror;

/// Errors shared across MyFans contracts.
///
/// The numeric discriminants are part of the public ABI and must not be
/// renumbered; they are pinned by the tests below.
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum MyFansError {
    /// The contract has already been initialized.
    AlreadyInitialized = 1,
    /// The contract has not been initialized yet.
    NotInitialized = 2,
    /// The caller is not authorized to perform this action.
    Unauthorized = 3,
    /// The provided amount is invalid.
    InvalidAmount = 4,
    /// The requested resource was not found.
    NotFound = 5,
    /// The operation would overflow.
    Overflow = 6,
    /// The provided input is invalid.
    InvalidInput = 7,
    /// The operation is not allowed in the current state.
    InvalidState = 8,
    /// The contract is paused.
    Paused = 9,
}

/// Convenience result alias defaulting the error type to [`MyFansError`].
pub type Result<T, E = MyFansError> = core::result::Result<T, E>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn error_discriminants_are_stable() {
        assert_eq!(MyFansError::AlreadyInitialized as u32, 1);
        assert_eq!(MyFansError::NotInitialized as u32, 2);
        assert_eq!(MyFansError::Unauthorized as u32, 3);
        assert_eq!(MyFansError::InvalidAmount as u32, 4);
        assert_eq!(MyFansError::NotFound as u32, 5);
        assert_eq!(MyFansError::Overflow as u32, 6);
        assert_eq!(MyFansError::InvalidInput as u32, 7);
        assert_eq!(MyFansError::InvalidState as u32, 8);
        assert_eq!(MyFansError::Paused as u32, 9);
    }

    #[test]
    fn result_alias_defaults_to_myfans_error() {
        let value: Result<()> = Err(MyFansError::Unauthorized);
        assert_eq!(value, Err(MyFansError::Unauthorized));
    }
}
