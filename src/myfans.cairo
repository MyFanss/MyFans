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
    struct Storage {
        /// (creator, fan) -> bool (true if fan follows creator)
        follows: Map<(ContractAddress, ContractAddress), bool>,
        /// creator -> follower count
        follower_count: Map<ContractAddress, u128>,
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
    }

    #[constructor]
    fn constructor(ref self: ContractState) {}

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
}
