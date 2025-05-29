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
    
    // Import components
    use myfans::components::content_component::content::ContentComponent;
    use myfans::components::content_component::interface::IContent;

    // Define components
    component!(path: ContentComponent, storage: content_storage, event: ContentEvent);

    #[storage]
    struct Storage {
        #[substorage(v0)]
        content_storage: ContentComponent::Storage,
    }
    
    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        ContentEvent: ContentComponent::Event,
    }

    #[constructor]
    fn constructor(ref self: ContractState) {}

    #[abi(embed_v0)]
    impl MyFansImpl of IMyFans<ContractState> {}
    
    // Implement content interface
    #[abi(embed_v0)]
    impl ContentImpl = ContentComponent::ContentImpl<ContractState>;
}
