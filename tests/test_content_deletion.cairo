#[cfg(test)]
mod content_deletion_tests {
    use core::array::ArrayTrait;
    use myfans::components::content_component::interface::{
        IContentDispatcher, IContentDispatcherTrait,
    };
    use snforge_std::{
        ContractClassTrait, DeclareResultTrait, declare, start_cheat_caller_address,
        stop_cheat_caller_address,
    };
    use starknet::ContractAddress;

    fn deploy_myfans() -> ContractAddress {
        let declare_result = declare("MyFans");
        assert(declare_result.is_ok(), 'Contract declaration failed');

        let contract_class = declare_result.unwrap().contract_class();
        let mut calldata = array![];
        let (contract_address, _) = contract_class.deploy(@calldata).unwrap();

        contract_address
    }

    #[test]
    #[should_panic(expected: ('Not the content creator',))]
    fn test_delete_by_non_creator_fails() {
        let contract_address = deploy_myfans();
        let content_dispatcher = IContentDispatcher { contract_address };

        let creator_address: ContractAddress = 12345.try_into().unwrap();
        let other_user: ContractAddress = 67890.try_into().unwrap();

        // 1. Create content as creator
        start_cheat_caller_address(contract_address, creator_address);
        let content_id = content_dispatcher
            .create_content('ipfs://QmTest', 'Test Content', 'Description');
        stop_cheat_caller_address(creator_address);

        // 2. Try to delete content as non-creator (should fail)
        start_cheat_caller_address(contract_address, other_user);
        content_dispatcher.delete_content(content_id);
        stop_cheat_caller_address(other_user);
    }

    #[test]
    fn test_delete_by_creator_succeeds() {
        let contract_address = deploy_myfans();
        let content_dispatcher = IContentDispatcher { contract_address };

        let creator_address: ContractAddress = 12345.try_into().unwrap();

        // 1. Create content as creator
        start_cheat_caller_address(contract_address, creator_address);
        let content_id = content_dispatcher
            .create_content('ipfs://QmTest', 'Test Content', 'Description');

        // 2. Delete content as creator
        let deletion_result = content_dispatcher.delete_content(content_id);
        stop_cheat_caller_address(creator_address);

        // 3. Verify deletion was successful
        assert(deletion_result == true, 'Deletion should succeed');

        // 4. Verify content is no longer accessible through existence check
        let exists = content_dispatcher.content_exists(content_id);
        assert(exists == false, 'Content not deleted');

        // 5. Verify content doesn't appear in creator's content list
        let creator_content = content_dispatcher.get_creator_content(creator_address);
        assert(creator_content.len() == 0, 'Content still in list');
    }

    #[test]
    #[should_panic(expected: ('Content already deleted',))]
    fn test_delete_already_deleted_content_integration() {
        let contract_address = deploy_myfans();
        let content_dispatcher = IContentDispatcher { contract_address };

        let creator_address: ContractAddress = 12345.try_into().unwrap();

        // Create content
        start_cheat_caller_address(contract_address, creator_address);
        let content_id = content_dispatcher
            .create_content('ipfs://QmTest', 'Test Content', 'Description');

        // Delete content
        content_dispatcher.delete_content(content_id);

        // Try to delete again (should fail)
        content_dispatcher.delete_content(content_id);
        stop_cheat_caller_address(creator_address);
    }
}
