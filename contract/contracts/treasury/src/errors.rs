use soroban_sdk::contracterror;

#[contracterror]
#[derive(Clone, Copy, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum TreasuryError {
    NegativeMinBalance = 1,
    Paused = 2,
    InsufficientBalance = 3,
    MinBalanceViolation = 4,
    NotInitialized = 5,
    InvalidAmount = 6,
    AlreadyInitialized = 7,
}
