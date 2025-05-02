#[starknet::contract]
mod MockCreateUser {
    use myfans::components::user_component::user::UserComponent;

    component!(path: UserComponent, storage: pet_storage, event: UserEvent);

    #[storage]
    struct Storage {
        #[substorage(v0)]
        pet_storage: UserComponent::Storage,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        UserEvent: UserComponent::Event,
    }


    #[abi(embed_v0)]
    impl UserImpl = UserComponent::UserImpl<ContractState>;
}

