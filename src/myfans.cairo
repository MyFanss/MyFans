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
        pub autorenew: bool // optional field for auto-renewal
    }

    #[storage]
    struct Storage {

        /// (creator, fan) -> bool (true if fan follows creator)
        follows: Map<(ContractAddress, ContractAddress), bool>,
        /// creator -> follower count
        follower_count: Map<ContractAddress, u128>,
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
        FollowEvent: FollowEvent,
        UnfollowEvent: UnfollowEvent,
    }

     #[derive(Drop, starknet::Event)]
    pub struct FollowEvent {
        follower: ContractAddress,
        creator: ContractAddress,
    }

     #[derive(Drop, starknet::Event)]
    pub struct UnfollowEvent {
        follower: ContractAddress,
        creator: ContractAddress,

    pub enum Event {
        ContentEvent: ContentComponent::Event,
        UserEvent: UserComponent::Event,
        Subscribed: Subscribed,
        Renewed: Renewed,
        AutorenewPreferenceSet: AutorenewPreferenceSet,
    }

    #[derive(Drop, starknet::Event)]
    pub struct Subscribed {
        #[key]
        pub fan: ContractAddress,
        #[key]
        pub creator: ContractAddress,
        pub expiry_time: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct Renewed {
        #[key]
        pub fan: ContractAddress,
        #[key]
        pub creator: ContractAddress,
        pub new_expiry_time: u64,
        pub renewed_by: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    pub struct AutorenewPreferenceSet {
        #[key]
        pub fan: ContractAddress,
        #[key]
        pub creator: ContractAddress,
        pub enabled: bool,

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
                autorenew: false // Default to false
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

        fn renew_subscription(
            ref self: ContractState, fan_address: ContractAddress, creator_address: ContractAddress,
        ) {
            let caller = get_caller_address();
            let mut subscription = self.subscriptions.read((fan_address, creator_address));

            // Assert subscription exists
            assert(subscription.fan != Zero::zero(), 'Subscription not found');
            assert(subscription.creator != Zero::zero(), 'Subscription not found');

            let current_timestamp = get_block_timestamp();
            let duration = self.subscription_duration_seconds.read();
            let fee = self.subscription_fee.read();
            let token_address = self.fee_token_address.read();

            // Relayer can only renew if autorenew is true
            if caller != fan_address {
                assert(subscription.autorenew, 'Autorenew not enabled');
            }

            // Handle fee transfer - requires fan to have approved the contract or relayer
            let token_dispatcher = IERC20Dispatcher { contract_address: token_address };
            let success = token_dispatcher.transfer_from(fan_address, get_contract_address(), fee);
            assert(success, 'Fee transfer failed');

            // Calculate new expiry time. If expired, renew from current timestamp. If not, extend
            // from expiry.
            let renewal_start_time = if current_timestamp > subscription.expiry_time {
                current_timestamp
            } else {
                subscription.expiry_time
            };

            subscription
                .start_time = renewal_start_time; // Update start time to actual renewal start
            subscription.expiry_time = renewal_start_time + duration;
            subscription.is_active = true; // Ensure subscription is active

            // Update subscription in storage
            self.subscriptions.write((fan_address, creator_address), subscription);

            // Emit Renewed event
            self
                .emit(
                    Event::Renewed(
                        Renewed {
                            fan: fan_address,
                            creator: creator_address,
                            new_expiry_time: subscription.expiry_time,
                            renewed_by: caller,
                        },
                    ),
                );
        }

        fn set_autorenew(ref self: ContractState, creator_address: ContractAddress, enable: bool) {
            let fan_address = get_caller_address();
            let mut subscription = self.subscriptions.read((fan_address, creator_address));

            // Assert caller is the fan
            assert(get_caller_address() == fan_address, 'Only fan can set preference');

            // Assert subscription exists
            assert(subscription.fan != Zero::zero(), 'Subscription not found');
            assert(subscription.creator != Zero::zero(), 'Subscription not found');

            // Update autorenew flag
            subscription.autorenew = enable;

            // Write updated subscription back to storage
            self.subscriptions.write((fan_address, creator_address), subscription);

            // Emit event
            self
                .emit(
                    Event::AutorenewPreferenceSet(
                        AutorenewPreferenceSet {
                            fan: fan_address, creator: creator_address, enabled: enable,
                        },
                    ),
                );
        }
    }

    // Implement content interface
    #[abi(embed_v0)]
    impl ContentImpl = ContentComponent::ContentImpl<ContractState>;
    // Implement user interface
    #[abi(embed_v0)]

    impl MyFansImpl of IMyFans<ContractState> {

        fn follow_user(ref self: ContractState, creator_address: ContractAddress) -> bool {
            let caller = get_caller_address();
            let follows = self.follows.read((caller, creator_address));

            assert(follows == false, 'Already following');

            self.follows.write((caller, creator_address), true);
            let count = self.follower_count.read(creator_address);
            self.follower_count.write(creator_address, count + 1);

            self.emit(FollowEvent {
                follower: caller,
                creator: creator_address,
            });

            true
        }
        
        fn unfollow_user(ref self: ContractState, creator_address: ContractAddress) -> bool {
            let caller = get_caller_address();
            let follows = self.follows.read((caller, creator_address));

            assert(follows == true, 'Not following');

            self.follows.write((caller, creator_address), false);
            let count = self.follower_count.read(creator_address);
            assert(count > 0, 'Follower count cannot be negative');
            self.follower_count.write(creator_address, count - 1);

            self.emit(UnfollowEvent {
                follower: caller,
                creator: creator_address,
            });
            true
        }
    }

    impl UserImpl = UserComponent::UserImpl<ContractState>;

}
