use starknet::ContractAddress;

#[derive(Copy, Drop, Serde, starknet::Store)]
pub struct Content {
    // Unique identifier for the content
    pub id: u256,
    // Owner/creator of the content
    pub creator: ContractAddress,
    // IPFS hash or other reference to the content
    pub content_uri: felt252,
    // Title of the content
    pub title: felt252,
    // Optional description
    pub description: felt252,
    // Timestamp when content was created
    pub created_at: u64,
    // Timestamp when content was last updated
    pub updated_at: u64,
    // Flag to track if content is active or deleted
    pub is_active: bool,
} 