#[starknet::contract]
mod MockContent {
    use myfans::components::content_component::content::ContentComponent;

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

    #[abi(embed_v0)]
    impl ContentImpl = ContentComponent::ContentImpl<ContractState>;
} 