/// Main contract implementation
#[starknet::contract]
pub mod MyFans {
    use core::num::traits::Zero;
    use core::traits::Into;

    // Import components
    use myfans::components::content_component::content::ContentComponent;
    use myfans::components::user_component::interface::IUser;
    use myfans::components::user_component::user::UserComponent;
    use myfans::interfaces::IMyFans::IMyFans;
    use starknet::storage::{
        Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess,
        StoragePointerWriteAccess,
    };
    use starknet::{ContractAddress, get_block_timestamp, get_caller_address, get_contract_address};
    use crate::interfaces::IERC20::{IERC20Dispatcher, IERC20DispatcherTrait};


    // Define components
    component!(path: ContentComponent, storage: content_storage, event: ContentEvent);
    component!(path: UserComponent, storage: user_storage, event: UserEvent);

    #[derive(Copy, Drop, Serde, Debug, starknet::Store)]
    pub struct Subscription {
        pub fan: ContractAddress,
        pub creator: ContractAddress,
        pub start_time: u64,
        pub expiry_time: u64,
        pub is_active: bool,
    }

    #[storage]
    struct Storage {
        #[substorage(v0)]
        content_storage: ContentComponent::Storage,
        #[substorage(v0)]
        user_storage: UserComponent::Storage,
        subscriptions: Map<(ContractAddress, ContractAddress), Subscription>,
        subscription_fee: u256,
        subscription_duration_seconds: u64,
        fee_token_address: ContractAddress,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        ContentEvent: ContentComponent::Event,
        UserEvent: UserComponent::Event,
        Subscribed: Subscribed,
    }

    #[derive(Drop, starknet::Event)]
    struct Subscribed {
        #[key]
        fan: ContractAddress,
        #[key]
        creator: ContractAddress,
        expiry_time: u64,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        initial_fee_token_address: ContractAddress,
        initial_subscription_fee: u256,
        initial_subscription_duration_days: u64,
    ) {
        self.fee_token_address.write(initial_fee_token_address);
        self.subscription_fee.write(initial_subscription_fee);
        self.subscription_duration_seconds.write(initial_subscription_duration_days * 24 * 60 * 60);
    }

    #[abi(embed_v0)]
    impl MyFansImpl of IMyFans<ContractState> {
        fn subscribe(ref self: ContractState, creator_address: ContractAddress) {
            let fan_address = get_caller_address();
            assert(fan_address != creator_address, 'Cannot subscribe to self');

            // 1. Verify creator is registered and verified (is_creator)
            let creator_profile = self.user_storage.get_user_profile(creator_address);
            assert(creator_profile.user_address != Zero::zero(), 'Creator not found');
            assert(creator_profile.is_creator, 'Not a verified creator');

            // 2. Check for duplicate active subscriptions
            let current_timestamp = get_block_timestamp();
            let existing_subscription = self.subscriptions.read((fan_address, creator_address));
            if existing_subscription.is_active {
                assert(
                    current_timestamp >= existing_subscription.expiry_time,
                    'Subscription already active',
                );
            }

            // 3. Handle subscription fee transfer
            let fee = self.subscription_fee.read();
            let token_address = self.fee_token_address.read();
            assert(token_address != Zero::zero(), 'Fee token not set');
            assert(fee > 0, 'Subscription fee must be > 0');

            let token_dispatcher = IERC20Dispatcher { contract_address: token_address };
            // Transfer fee from fan to the contract.
            // For splitting fees, this contract would then transfer parts to creator/platform.
            // Fan must have approved this contract to spend `fee` amount of `token_address`.
            let success = token_dispatcher.transfer_from(fan_address, get_contract_address(), fee);
            assert(success, 'Fee transfer failed');

            // 4. Record the subscription
            let start_time = current_timestamp;
            let duration = self.subscription_duration_seconds.read();
            let expiry_time = start_time + duration;

            let new_subscription = Subscription {
                fan: fan_address,
                creator: creator_address,
                start_time: start_time,
                expiry_time: expiry_time,
                is_active: true,
            };
            self.subscriptions.write((fan_address, creator_address), new_subscription);

            // 5. Emit event
            self
                .emit(
                    Event::Subscribed(
                        Subscribed { fan: fan_address, creator: creator_address, expiry_time },
                    ),
                );
        }

        fn get_subscription_details(
            self: @ContractState, fan_address: ContractAddress, creator_address: ContractAddress,
        ) -> Subscription {
            let sub = self.subscriptions.read((fan_address, creator_address));
            sub
        }
    }

    // Implement content interface
    #[abi(embed_v0)]
    impl ContentImpl = ContentComponent::ContentImpl<ContractState>;
    // Implement user interface
    #[abi(embed_v0)]
    impl UserImpl = UserComponent::UserImpl<ContractState>;
}
