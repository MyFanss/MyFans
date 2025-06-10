use myfans::myfans::MyFans::Subscription;
use starknet::ContractAddress;

#[starknet::interface]
pub trait IMyFans<TContractState> { // Main contract functionality will be added here
    fn subscribe(ref self: TContractState, creator_address: ContractAddress);
    fn get_subscription_details(
        self: @TContractState, fan_address: ContractAddress, creator_address: ContractAddress,
    ) -> Subscription;
    fn renew_subscription(
        ref self: TContractState, fan_address: ContractAddress, creator_address: ContractAddress,
    );
    fn set_autorenew(ref self: TContractState, creator_address: ContractAddress, enable: bool);
    fn is_subscription_active(
        self: @TContractState, fan_address: ContractAddress, creator: ContractAddress,
    ) -> bool;
}