use myfans::components::user_component::types::User;
use starknet::ContractAddress;

#[starknet::interface]
pub trait IUser<TContractState> {
    // /// @notice Check if a user is registered
    // fn is_registered(self: @TContractState, user: ContractAddress) -> bool;

    // /// @notice Register a new user with a username and role(s)
    // /// @param role can be 'creator', 'fan', or both (comma-separated or predefined enum value)
    fn create_account(ref self: TContractState, username: felt252) -> u256;

    fn get_username_from_address(ref self: TContractState, address: ContractAddress) -> felt252;

    fn get_address_from_username(ref self: TContractState, username: felt252) -> ContractAddress;

    // /// @notice Follow another user
    fn follow_user(ref self: TContractState, follow_address: ContractAddress) -> bool;

    // /// @notice unfFollow another user
    fn unfollow_user(ref self: TContractState, unfollow_address: ContractAddress) -> bool;

    // /// @notice Get the full profile of a user
    fn get_user_profile(ref self: TContractState, user: ContractAddress) -> User;

    /// @notice Get the list of addresses the user is following
    fn get_following(self: @TContractState, user: ContractAddress) -> Span<ContractAddress>;

    /// @notice Get the list of followers for a user
    fn get_followers(self: @TContractState, user: ContractAddress) -> Span<ContractAddress>;

    // @dev this block another user
    // @param user: the address to block
    fn block_user(ref self: TContractState, user: ContractAddress) -> bool;

    // @dev this unblock an already blocked user
    // @param user: the address to unblock
    fn unblock_user(ref self: TContractState, user: ContractAddress) -> bool;

    // @dev this give the total number of blocked users by a user 
    fn get_user_blocked_count(self: @TContractState) -> u256;
}
