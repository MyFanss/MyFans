/// Main contract implementation
#[starknet::contract]
mod MyFans {
    use core::num::traits::Zero;
    use core::traits::Into;
    use myfans::interfaces::IMyFans::IMyFans;
    use starknet::storage::Map;
    use starknet::{
        ClassHash, ContractAddress, get_block_timestamp, get_caller_address, get_contract_address,
    };
    use crate::interfaces::IERC20::{IERC20Dispatcher, IERC20DispatcherTrait};

    #[storage]
    struct Storage {}
    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {}

    #[constructor]
    fn constructor(ref self: ContractState) {}

    #[abi(embed_v0)]
    impl MyFansImpl of IMyFans<ContractState> {}
}
