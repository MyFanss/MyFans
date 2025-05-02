use myfans::components::user_component::interface::IUser;
#[starknet::component]
pub mod UserComponent {
    use myfans::components::user_component::types::User;
    use starknet::storage::{
        Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess,
        StoragePointerWriteAccess,
    };
    use starknet::{
        ContractAddress, contract_address_const, get_block_timestamp, get_caller_address,
    };


    #[storage]
    pub struct Storage {
        user: Map<ContractAddress, User>,
        user_address: Map<ContractAddress, felt252>,
        username: Map<felt252, ContractAddress>,
        users_id: Map<u256, ContractAddress>,
        username_exists: Map<felt252, bool>,
        id_count: u256,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        UserCreated: UserCreated,
        UserUpdated: UserUpdated,
    }

    #[derive(Drop, starknet::Event)]
    struct UserCreated {
        #[key]
        user: ContractAddress,
        username: felt252,
    }

    #[derive(Drop, starknet::Event)]
    struct UserUpdated {
        #[key]
        owner_address: ContractAddress,
    }


    #[embeddable_as(UserImpl)]
    impl UserComponentImpl<
        TContractState, +HasComponent<TContractState>,
    > of super::IUser<ComponentState<TContractState>> {
        fn get_username_from_address(
            ref self: ComponentState<TContractState>, address: ContractAddress,
        ) -> felt252 {
            let username = self.user_address.read(address);
            username
        }

        fn get_address_from_username(
            ref self: ComponentState<TContractState>, username: felt252,
        ) -> ContractAddress {
            let username = self.username.read(username);
            username
        }


        fn create_account(ref self: ComponentState<TContractState>, username: felt252) -> u256 {
            let caller = get_caller_address();

            let zero_address = contract_address_const::<'0x0'>();
            assert(caller != zero_address, 'Zero Address detected');

            let taken = self.username_exists.read(username);
            assert(!taken, 'Username taken');

            let timestamp = get_block_timestamp();
            let mut user = self.get_user_profile(caller);
            let is_registered = user.is_creator;
            assert(!is_registered, 'Already Registered');

            let id = self.id_count.read() + 1;

            user =
                User {
                    user_address: caller,
                    id: id,
                    username: username,
                    followers: 0,
                    following: 0,
                    registered_at: timestamp,
                    updated_at: timestamp,
                    is_creator: true,
                };

            self.user.write(caller, user);

            self.username_exists.write(username, true);

            self.username.write(username, caller);

            self.user_address.write(caller, username);

            self.users_id.write(id, caller);

            self.id_count.write(id);

            self.emit(Event::UserCreated(UserCreated { user: caller, username: username }));

            id
        }


        fn get_user_profile(
            ref self: ComponentState<TContractState>, user: ContractAddress,
        ) -> User {
            self.user.read(user)
        }
    }
}
