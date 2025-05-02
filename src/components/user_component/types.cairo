use starknet::ContractAddress;

/// @notice Struct containing all data for a creator account
#[derive(Drop, Serde, starknet::Store)]
pub struct User {
    #[key]
    pub user_address: ContractAddress, // Creator's wallet address
    pub id: u256,
    pub username: felt252, // Unique username
    pub followers: u256,
    pub following: u256,
    pub registered_at: u64, // Timestamp of registration
    pub updated_at: u64,
    pub is_creator: bool // Role flag for creator
}

