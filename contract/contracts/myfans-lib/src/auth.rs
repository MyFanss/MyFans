use soroban_sdk::{panic_with_error, Address, Env, Symbol};

use crate::{events, MyfansError};

/// Enforces a caller authorization requirement.
///
/// If the caller does not match the expected address, this emits a
/// `UnauthorizedCallerEvent` and then reverts with `MyfansError::NotAuthorized`.
pub fn require_authorized(env: &Env, caller: &Address, expected: &Address, action: &Symbol) {
    if caller != expected {
        emit_unauthorized_caller_event(env, caller, action);
        panic_with_error!(env, MyfansError::NotAuthorized);
    }
}

/// Emits a shared unauthorized-caller event for public indexers.
pub fn emit_unauthorized_caller_event(env: &Env, caller: &Address, action: &Symbol) {
    let event = events::UnauthorizedCallerEvent {
        caller: caller.clone(),
        action: action.clone(),
    };
    env.events().publish((Symbol::new(env, "unauthorized_caller"),), event);
}

/// Emits a shared primary state change event for on-chain indexing.
pub fn emit_primary_state_change_event(
    env: &Env,
    action: &Symbol,
    subject: &Address,
    changed_by: &Address,
) {
    let event = events::PrimaryStateChangeEvent {
        action: action.clone(),
        subject: subject.clone(),
        changed_by: changed_by.clone(),
    };
    env.events().publish((Symbol::new(env, "primary_state_change"),), event);
}
