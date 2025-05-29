#[cfg(test)]
mod tests {
    use core::array::ArrayTrait;
    use myfans::components::content_component::interface::{
        IContentDispatcher, IContentDispatcherTrait,
    };
    use snforge_std::{
        ContractClassTrait, DeclareResultTrait, declare, start_cheat_caller_address,
        stop_cheat_caller_address,
    };
    use starknet::ContractAddress;

    fn setup() -> ContractAddress {
        let declare_result = declare("MockContent");
        assert(declare_result.is_ok(), 'Contract declaration failed');
        // Deploy
        let contract_class = declare_result.unwrap().contract_class();
        let mut calldata = array![];
        let (contract_address, _) = contract_class.deploy(@calldata).unwrap();

        contract_address
    }

    #[test]
    fn test_create_and_get_content() {
        let contract_address = setup();
        let dispatcher = IContentDispatcher { contract_address };

        let creator_address: ContractAddress = 12345.try_into().unwrap();

        // Test input values
        let content_uri = 'ipfs://QmContent';
        let title = 'My First Content';
        let description = 'Test description';

        // Create content as creator
        start_cheat_caller_address(contract_address, creator_address);
        let content_id = dispatcher.create_content(content_uri, title, description);
        stop_cheat_caller_address(creator_address);

        // Verify content ID is 1 (first content)
        assert(content_id == 1, 'Content ID should be 1');

        // Get content and verify details
        let content = dispatcher.get_content(content_id);
        assert(content.id == content_id, 'Content ID mismatch');
        assert(content.creator == creator_address, 'Creator mismatch');
        assert(content.content_uri == content_uri, 'Content URI mismatch');
        assert(content.title == title, 'Title mismatch');
        assert(content.description == description, 'Description mismatch');
        assert(content.is_active == true, 'Content should be active');
    }

    #[test]
    fn test_get_creator_content() {
        let contract_address = setup();
        let dispatcher = IContentDispatcher { contract_address };

        let creator_address: ContractAddress = 12345.try_into().unwrap();

        // Create multiple content items
        start_cheat_caller_address(contract_address, creator_address);
        dispatcher.create_content('ipfs://content1', 'Title 1', 'Description 1');
        dispatcher.create_content('ipfs://content2', 'Title 2', 'Description 2');
        dispatcher.create_content('ipfs://content3', 'Title 3', 'Description 3');
        stop_cheat_caller_address(creator_address);

        // Get creator's content
        let creator_content = dispatcher.get_creator_content(creator_address);

        // Verify content count
        assert(creator_content.len() == 3, 'Should have 3 content items');

        // Verify content IDs
        assert(*creator_content.at(0) == 1, 'First content ID should be 1');
        assert(*creator_content.at(1) == 2, 'Second content ID should be 2');
        assert(*creator_content.at(2) == 3, 'Third content ID should be 3');
    }

    #[test]
    fn test_delete_content_by_creator() {
        let contract_address = setup();
        let dispatcher = IContentDispatcher { contract_address };

        let creator_address: ContractAddress = 12345.try_into().unwrap();

        // Create content
        start_cheat_caller_address(contract_address, creator_address);
        let content_id = dispatcher.create_content('ipfs://content', 'Title', 'Description');

        // Delete content as creator
        let result = dispatcher.delete_content(content_id);
        stop_cheat_caller_address(creator_address);

        // Verify deletion was successful
        assert(result == true, 'Deletion should succeed');

        // Check content existence
        let exists = dispatcher.content_exists(content_id);
        assert(exists == false, 'Content not deleted');

        // Get creator's content
        let creator_content = dispatcher.get_creator_content(creator_address);

        // Verify deleted content is not returned
        assert(creator_content.len() == 0, 'No content should be returned');
    }

    #[test]
    #[should_panic(expected: ('Not the content creator',))]
    fn test_delete_content_by_non_creator_fails() {
        let contract_address = setup();
        let dispatcher = IContentDispatcher { contract_address };

        let creator_address: ContractAddress = 12345.try_into().unwrap();
        let other_address: ContractAddress = 67890.try_into().unwrap();

        // Create content as creator
        start_cheat_caller_address(contract_address, creator_address);
        let content_id = dispatcher.create_content('ipfs://content', 'Title', 'Description');
        stop_cheat_caller_address(creator_address);

        // Try to delete content as non-creator (should fail)
        start_cheat_caller_address(contract_address, other_address);
        dispatcher.delete_content(content_id);
        stop_cheat_caller_address(other_address);
    }

    #[test]
    #[should_panic(expected: ('Content does not exist',))]
    fn test_delete_nonexistent_content_fails() {
        let contract_address = setup();
        let dispatcher = IContentDispatcher { contract_address };

        let creator_address: ContractAddress = 12345.try_into().unwrap();

        // Try to delete non-existent content
        start_cheat_caller_address(contract_address, creator_address);
        dispatcher.delete_content(999);
        stop_cheat_caller_address(creator_address);
    }

    #[test]
    #[should_panic(expected: ('Content already deleted',))]
    fn test_delete_already_deleted_content_fails() {
        let contract_address = setup();
        let dispatcher = IContentDispatcher { contract_address };

        let creator_address: ContractAddress = 12345.try_into().unwrap();

        // Create content
        start_cheat_caller_address(contract_address, creator_address);
        let content_id = dispatcher.create_content('ipfs://content', 'Title', 'Description');

        // Delete content
        dispatcher.delete_content(content_id);

        // Try to delete again (should fail)
        dispatcher.delete_content(content_id);
        stop_cheat_caller_address(creator_address);
    }
}
