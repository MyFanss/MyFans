use myfans::components::content_component::types::Content;
use starknet::ContractAddress;

#[starknet::interface]
pub trait IContent<TContractState> {
    /// @notice Create new content
    /// @param content_uri IPFS hash or other reference to the content
    /// @param title Title of the content
    /// @param description Description of the content
    /// @return Content ID
    fn create_content(
        ref self: TContractState, 
        content_uri: felt252, 
        title: felt252, 
        description: felt252
    ) -> u256;

    /// @notice Get content by ID
    /// @param content_id The ID of the content to retrieve
    /// @return Content details
    fn get_content(ref self: TContractState, content_id: u256) -> Content;
    
    /// @notice Check if content exists and is active
    /// @param content_id The ID of the content to check
    /// @return True if content exists and is active
    fn content_exists(ref self: TContractState, content_id: u256) -> bool;
    
    /// @notice Get creator's content
    /// @param creator The address of the creator
    /// @return Array of content IDs
    fn get_creator_content(ref self: TContractState, creator: ContractAddress) -> Array<u256>;
    
    /// @notice Delete content - can only be called by the content creator
    /// @param content_id The ID of the content to delete
    /// @return True if deletion was successful
    fn delete_content(ref self: TContractState, content_id: u256) -> bool;
} 