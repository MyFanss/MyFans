#[cfg(test)]
mod tests {
    use myfans::components::user_component::interface::{IUserDispatcher, IUserDispatcherTrait};
    use snforge_std::{
        ContractClassTrait, DeclareResultTrait, declare, start_cheat_caller_address,
        stop_cheat_caller_address,
    };
    use starknet::ContractAddress;

    fn setup() -> ContractAddress {
        let declare_result = declare("MockCreateUser");
        assert(declare_result.is_ok(), 'Contract declaration failed');
        // Deploy
        let contract_class = declare_result.unwrap().contract_class();
        let mut calldata = array![];
        let (contract_address, _) = contract_class.deploy(@calldata).unwrap();

        contract_address
    }

    #[test]
    fn test_create_account() {
        let contract_address = setup();
        let dispatcher = IUserDispatcher { contract_address };

        let user_address: ContractAddress = 12345.try_into().unwrap();

        // Test input values

        let username = 'jaiboi';

        start_cheat_caller_address(contract_address, user_address);
        dispatcher.create_account(username);
        stop_cheat_caller_address(user_address);

        // Retrieve the account to verify it was stored correctly
        let user = dispatcher.get_user_profile(user_address);

        assert(user.is_creator, 'registration failed');
        assert(user.id == 1, 'Id mismatch');
        assert(user.username == username, 'username mismatch');
    }

    #[test]
    #[should_panic(expected: ('Already Registered',))]
    fn test_one_user_create_account_twice_different_username() {
        let contract_address = setup();
        let dispatcher = IUserDispatcher { contract_address };

        let user_address: ContractAddress = 12345.try_into().unwrap();

        // Test input values

        let username = 'ajidokwu';
        let username1 = 'james';

        start_cheat_caller_address(contract_address, user_address);
        dispatcher.create_account(username);
        dispatcher.create_account(username1);
        stop_cheat_caller_address(user_address);

        // Retrieve the account to verify it was stored correctly
        let user = dispatcher.get_user_profile(user_address);
    }
    #[test]
    #[should_panic(expected: ('Username taken',))]
    fn test_create_account_twice_same_username() {
        let contract_address = setup();
        let dispatcher = IUserDispatcher { contract_address };

        let user_address: ContractAddress = 12345.try_into().unwrap();

        // Test input values

        let username = 'ajidokwu';

        start_cheat_caller_address(contract_address, user_address);
        dispatcher.create_account(username);
        dispatcher.create_account(username);
        stop_cheat_caller_address(user_address);
    }

    #[test]
    #[should_panic(expected: ('Username taken',))]
    fn test_different_users_create_account_with_same_username() {
        let contract_address = setup();
        let dispatcher = IUserDispatcher { contract_address };

        let user_address: ContractAddress = 12345.try_into().unwrap();

        let second_address: ContractAddress = 652352.try_into().unwrap();

        // Test input values

        let username = 'ajidokwu';

        start_cheat_caller_address(contract_address, user_address);
        dispatcher.create_account(username);
        stop_cheat_caller_address(user_address);

        start_cheat_caller_address(contract_address, second_address);
        dispatcher.create_account(username);
        stop_cheat_caller_address(user_address);
    }

    #[test]
    fn test_create_2_accounts() {
        let contract_address = setup();
        let dispatcher = IUserDispatcher { contract_address };

        let user_address: ContractAddress = 12345.try_into().unwrap();

        let second_address: ContractAddress = 652352.try_into().unwrap();

        // Test input values

        let username = 'ajidokwu';

        let username1 = 'jaiboi';

        start_cheat_caller_address(contract_address, user_address);
        dispatcher.create_account(username);
        stop_cheat_caller_address(user_address);

        start_cheat_caller_address(contract_address, second_address);
        dispatcher.create_account(username1);
        stop_cheat_caller_address(user_address);

        // Retrieve the account to verify it was stored correctly
        let user = dispatcher.get_user_profile(second_address);

        assert(user.is_creator, 'registration failed');
        assert(user.id == 2, 'Id mismatch');
        assert(user.username == username1, 'username mismatch');
    }
    #[test]
    fn test_follow_accounts() {
        let contract_address = setup();
        let dispatcher = IUserDispatcher { contract_address };

        let user_address: ContractAddress = 12345.try_into().unwrap();

        let second_address: ContractAddress = 652352.try_into().unwrap();

        // Test input values

        let username = 'ajidokwu';

        let username1 = 'jaiboi';

        start_cheat_caller_address(contract_address, user_address);
        dispatcher.create_account(username);
        stop_cheat_caller_address(user_address);

        start_cheat_caller_address(contract_address, second_address);
        dispatcher.create_account(username1);
        stop_cheat_caller_address(user_address);

        start_cheat_caller_address(contract_address, user_address);
        dispatcher.follow_user(second_address);
        stop_cheat_caller_address(user_address);
        // Retrieve the account to verify it was stored correctly
        let user = dispatcher.get_user_profile(second_address);
        assert(user.followers == 1, 'follow error');
    }
    #[test]
    fn test_unfollow_accounts() {
        let contract_address = setup();
        let dispatcher = IUserDispatcher { contract_address };

        let user_address: ContractAddress = 12345.try_into().unwrap();

        let second_address: ContractAddress = 652352.try_into().unwrap();

        // Test input values

        let username = 'ajidokwu';

        let username1 = 'jaiboi';

        start_cheat_caller_address(contract_address, user_address);
        dispatcher.create_account(username);
        stop_cheat_caller_address(user_address);

        start_cheat_caller_address(contract_address, second_address);
        dispatcher.create_account(username1);
        stop_cheat_caller_address(user_address);

        start_cheat_caller_address(contract_address, user_address);
        dispatcher.follow_user(second_address);
        stop_cheat_caller_address(user_address);
        // Retrieve the account to verify it was stored correctly
        let user = dispatcher.get_user_profile(second_address);
        assert(user.followers == 1, 'follow error');

        start_cheat_caller_address(contract_address, user_address);
        dispatcher.unfollow_user(second_address);
        stop_cheat_caller_address(user_address);
        // Retrieve the account to verify it was stored correctly
        let user1 = dispatcher.get_user_profile(second_address);
        assert(user1.followers == 0, 'follow error');
    }
    #[test]
    #[should_panic(expected: ('Already following user',))]
    fn test_follow_account_twice() {
        let contract_address = setup();
        let dispatcher = IUserDispatcher { contract_address };

        let user_address: ContractAddress = 12345.try_into().unwrap();

        let second_address: ContractAddress = 652352.try_into().unwrap();

        // Test input values

        let username = 'ajidokwu';

        let username1 = 'jaiboi';

        start_cheat_caller_address(contract_address, user_address);
        dispatcher.create_account(username);
        stop_cheat_caller_address(user_address);

        start_cheat_caller_address(contract_address, second_address);
        dispatcher.create_account(username1);
        stop_cheat_caller_address(user_address);

        start_cheat_caller_address(contract_address, user_address);
        dispatcher.follow_user(second_address);
        dispatcher.follow_user(second_address);
        stop_cheat_caller_address(user_address);
    }
}
