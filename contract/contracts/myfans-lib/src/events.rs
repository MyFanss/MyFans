use soroban_sdk::{contracttype, Address, Symbol};

/// Event emitted when a restricted action is attempted by an unauthorized caller.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct UnauthorizedCallerEvent {
    pub caller: Address,
    pub action: Symbol,
}

/// Event emitted for shared primary state changes across MyFans contracts.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PrimaryStateChangeEvent {
    pub action: Symbol,
    pub subject: Address,
    pub changed_by: Address,
}
