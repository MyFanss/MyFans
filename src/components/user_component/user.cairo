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
    use super::IUser;

    #[storage]
    pub struct Storage {
        user: Map<ContractAddress, User>,
        user_address: Map<ContractAddress, felt252>,
        username: Map<felt252, ContractAddress>,
        users_id: Map<u256, ContractAddress>,
        username_exists: Map<felt252, bool>,
        id_count: u256,
        following_map: Map<(ContractAddress, ContractAddress), bool>,
        user_following: Map<(ContractAddress, u256), ContractAddress>, // who a user is following
        following_count: Map<ContractAddress, u256>,
        user_followers: Map<(ContractAddress, u256), ContractAddress>, // who follows a user
        follower_count: Map<ContractAddress, u256>,
        is_blocked: Map<(ContractAddress, ContractAddress), bool>,
        user_follower_before_block: Map<(ContractAddress, ContractAddress), bool>,
        blocked_count: Map<ContractAddress, u256>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        UserCreated: UserCreated,
        UserUpdated: UserUpdated,
        UserBlocked: UserBlocked,
        UserUnblocked: UserUnblocked
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

    #[derive(Drop, starknet::Event)]
    struct UserBlocked {
        #[key]
        blocker: ContractAddress,
        #[key]
        blocked: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    struct UserUnblocked {
        #[key]
        blocker: ContractAddress,
        #[key]
        blocked: ContractAddress,
    }

    #[embeddable_as(UserImpl)]
    impl UserComponentImpl<
        TContractState, +HasComponent<TContractState>,
    > of super::IUser<ComponentState<TContractState>> {
        fn get_username_from_address(
            ref self: ComponentState<TContractState>, address: ContractAddress,
        ) -> felt252 {
            self.user_address.read(address)
        }

        fn get_address_from_username(
            ref self: ComponentState<TContractState>, username: felt252,
        ) -> ContractAddress {
            self.username.read(username)
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

            self.emit(Event::UserCreated(UserCreated { user: caller, username }));

            id
        }

        fn follow_user(
            ref self: ComponentState<TContractState>, follow_address: ContractAddress,
        ) -> bool {
            let caller = get_caller_address();

            // Prevent users from following themselves
            assert(caller != follow_address, 'Cannot follow yourself');

            // Check if caller is already following the target user
            let already_following = self.following_map.read((caller, follow_address));
            assert(!already_following, 'Already following user');

            // Get current following and follower counts
            let caller_following_count = self.following_count.read(caller);
            let followee_follower_count = self.follower_count.read(follow_address);

            // Update the following list for the caller
            self.user_following.write((caller, caller_following_count), follow_address);
            self.following_count.write(caller, caller_following_count + 1);

            // Update the follower list for the followee
            self.user_followers.write((follow_address, followee_follower_count), caller);
            self.follower_count.write(follow_address, followee_follower_count + 1);

            // Mark that the caller is now following the followee
            self.following_map.write((caller, follow_address), true);

            // Update caller's user profile
            let mut caller_user = self.get_user_profile(caller);
            caller_user.following += 1;
            caller_user.updated_at = get_block_timestamp();
            self.user.write(caller, caller_user);

            // Update followee's user profile
            let mut followee_user = self.get_user_profile(follow_address);
            followee_user.followers += 1;
            followee_user.updated_at = get_block_timestamp();
            self.user.write(follow_address, followee_user);

            true
        }


        fn unfollow_user(
            ref self: ComponentState<TContractState>, unfollow_address: ContractAddress,
        ) -> bool {
            let caller = get_caller_address();

            // Prevent users from unfollowing themselves
            // assert(caller != unfollow_address, 'Cannot unfollow yourself');

            // // Ensure the caller is actually following the user
            // let is_following = self.following_map.read((caller, unfollow_address));
            // assert(is_following, 'Not currently following user');

            // // Decrease follow counts in user profiles
            // let mut caller_user = self.get_user_profile(caller);
            // caller_user.following -= 1;
            // caller_user.updated_at = get_block_timestamp();
            // self.user.write(caller, caller_user);

            // let mut unfollowed_user = self.get_user_profile(unfollow_address);
            // unfollowed_user.followers -= 1;
            // unfollowed_user.updated_at = get_block_timestamp();
            // self.user.write(unfollow_address, unfollowed_user);

            // // Update follow map to indicate unfollow
            // self.following_map.write((caller, unfollow_address), false);

            self._unfollow_user(caller, unfollow_address);

            // NOTE: You might also want to remove the entry from `user_following` and
            // `user_followers` if required

            true
        }


        /// @notice Get the list of addresses the user is following
        fn get_following(
            self: @ComponentState<TContractState>, user: ContractAddress,
        ) -> Span<ContractAddress> {
            let count = self.following_count.read(user);
            let mut following_list: Array<ContractAddress> = ArrayTrait::new();

            // iterate i from 0 up to (but not including) count
            for i in 0..count {
                let following = self.user_following.read((user, i));
                following_list.append(following);
            }

            following_list.span()
        }

        /// @notice Get the list of followers for a user
        fn get_followers(
            self: @ComponentState<TContractState>, user: ContractAddress,
        ) -> Span<ContractAddress> {
            let count = self.follower_count.read(user);
            let mut follower_list: Array<ContractAddress> = ArrayTrait::new();

            // iterate i from 0 up to (but not including) count
            for i in 0..count {
                let follower = self.user_followers.read((user, i));
                follower_list.append(follower);
            }

            follower_list.span()
        }


        fn get_user_profile(
            ref self: ComponentState<TContractState>, user: ContractAddress,
        ) -> User {
            self.user.read(user)
        }

        fn block_user(ref self: ComponentState<TContractState>, user: ContractAddress) -> bool {
            let caller: ContractAddress = get_caller_address();
            let zero_address = contract_address_const::<'0x0'>();


            assert!(caller != user, "caller cannot block self");
            // confirm user is not blocked before
            let is_userblocked: bool = self.is_blocked.read((caller, user));
            assert!(!is_userblocked, "user already blocked");
            assert!(user != zero_address, "zero address not allowed");

            //check if user caller is following user
            let is_caller_following_user: bool = self.following_map.read((caller, user));

            if (is_caller_following_user) {
                self._unfollow_user(caller, user);
                self.user_follower_before_block.write((caller, user), true);
            }

            // update the state
            self.is_blocked.write((caller, user), true);
            // increment the number of caller blocked
            let number_of_blocked: u256 = self.blocked_count.read(caller);
            self.blocked_count.write(caller, (number_of_blocked + 1));


            // emit an event
            self.emit(Event::UserBlocked(UserBlocked {
                blocker: caller,
                blocked: user
            }));
            
            false
        }


        fn unblock_user(ref self: ComponentState<TContractState>, user: ContractAddress) -> bool {
            let caller: ContractAddress = get_caller_address();

            assert!(caller != user, "action cannot be carried out on self");
            let is_userblocked: bool = self.is_blocked.read((caller, user));
            assert!(is_userblocked, "user is not blocked");

            // check if previously a follower
            let is_user_follower: bool = self.user_follower_before_block.read((caller, user));
            self.is_blocked.write((caller, user), false);

            let number_of_blocked: u256 = self.blocked_count.read(caller);
            self.blocked_count.write(caller, (number_of_blocked - 1));
            if(is_user_follower) {
                // follow the user back
                self.follow_user(user);
            }

            self.emit(Event::UserUnblocked(UserUnblocked{
                blocker: caller,
                blocked: user
            }));
            true
        }

        // @dev this give the total number of blocked users by a user
        fn get_user_blocked_count(self: @ComponentState<TContractState>) -> u256 {
            let caller: ContractAddress = get_caller_address();

            return self.blocked_count.read(caller);
        }
    }

     #[generate_trait]
    impl InternalImpl<
        TContractState, +HasComponent<TContractState>,
    > of InternalImplTrait<TContractState> {
        fn _unfollow_user(
            ref self: ComponentState<TContractState>, caller: ContractAddress, unfollow_address: ContractAddress,
        ) {
            assert(caller != unfollow_address, 'Cannot unfollow yourself');

            // Ensure the caller is actually following the user
            let is_following = self.following_map.read((caller, unfollow_address));
            assert(is_following, 'Not currently following user');

            // Decrease follow counts in user profiles
            let mut caller_user = self.get_user_profile(caller);
            caller_user.following -= 1;
            caller_user.updated_at = get_block_timestamp();
            self.user.write(caller, caller_user);

            let mut unfollowed_user = self.get_user_profile(unfollow_address);
            unfollowed_user.followers -= 1;
            unfollowed_user.updated_at = get_block_timestamp();
            self.user.write(unfollow_address, unfollowed_user);

            // Update follow map to indicate unfollow
            self.following_map.write((caller, unfollow_address), false);
        }
    }
}
