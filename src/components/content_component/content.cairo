use myfans::components::content_component::interface::IContent;

#[starknet::component]
pub mod ContentComponent {
    use core::array::ArrayTrait;
    use myfans::components::content_component::types::Content;
    use starknet::storage::{
        Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess,
        StoragePointerWriteAccess,
    };
    use starknet::{ContractAddress, get_block_timestamp, get_caller_address};

    #[storage]
    pub struct Storage {
        // Mapping from content ID to Content struct
        content: Map<u256, Content>,
        // Mapping from creator to their content IDs (one-to-one)
        creator_content_mapping: Map<(ContractAddress, u256), bool>,
        // Counter for content IDs
        content_count: u256,
        // Counter for creator's content
        creator_content_count: Map<ContractAddress, u256>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        ContentCreated: ContentCreated,
        ContentDeleted: ContentDeleted,
        ContentUpdated: ContentUpdated,
    }

    #[derive(Drop, starknet::Event)]
    struct ContentCreated {
        #[key]
        content_id: u256,
        #[key]
        creator: ContractAddress,
        content_uri: felt252,
    }

    #[derive(Drop, starknet::Event)]
    struct ContentDeleted {
        #[key]
        content_id: u256,
        #[key]
        creator: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    struct ContentUpdated {
        #[key]
        content_id: u256,
        #[key]
        creator: ContractAddress,
    }

    #[embeddable_as(ContentImpl)]
    impl ContentComponentImpl<
        TContractState, +HasComponent<TContractState>,
    > of super::IContent<ComponentState<TContractState>> {
        fn create_content(
            ref self: ComponentState<TContractState>,
            content_uri: felt252,
            title: felt252,
            description: felt252,
        ) -> u256 {
            // Get caller address (must be a registered creator)
            let caller = get_caller_address();

            // Increment content counter and use as new content ID
            let content_id = self.content_count.read() + 1;

            // Get current timestamp
            let timestamp = get_block_timestamp();

            // Create new content
            let content = Content {
                id: content_id,
                creator: caller,
                content_uri: content_uri,
                title: title,
                description: description,
                created_at: timestamp,
                updated_at: timestamp,
                is_active: true,
            };

            // Store content
            self.content.write(content_id, content);

            // Update content count
            self.content_count.write(content_id);

            // Get creator's content count
            let creator_content_count = self.creator_content_count.read(caller);

            // Update creator's content count
            self.creator_content_count.write(caller, creator_content_count + 1);

            // Add content ID to creator's content mapping
            self.creator_content_mapping.write((caller, content_id), true);

            // Emit event
            self
                .emit(
                    Event::ContentCreated(
                        ContentCreated {
                            content_id: content_id, creator: caller, content_uri: content_uri,
                        },
                    ),
                );

            content_id
        }

        fn get_content(ref self: ComponentState<TContractState>, content_id: u256) -> Content {
            let content = self.content.read(content_id);

            // Verify content exists and is active
            assert(content.id == content_id, 'Content does not exist');
            assert(content.is_active, 'Content has been deleted');

            content
        }

        fn content_exists(ref self: ComponentState<TContractState>, content_id: u256) -> bool {
            let content = self.content.read(content_id);

            // Check if content exists and is active
            content.id == content_id && content.is_active
        }

        fn get_creator_content(
            ref self: ComponentState<TContractState>, creator: ContractAddress,
        ) -> Array<u256> {
            let mut active_content = ArrayTrait::new();
            let content_count = self.content_count.read();

            // Iterate through all content IDs
            let mut i: u256 = 1;
            loop {
                if i > content_count {
                    break;
                }

                // Check if content belongs to creator and is active
                let belongs_to_creator = self.creator_content_mapping.read((creator, i));

                if belongs_to_creator {
                    let content = self.content.read(i);

                    if content.is_active {
                        active_content.append(i);
                    }
                }

                i += 1;
            }

            active_content
        }

        fn delete_content(ref self: ComponentState<TContractState>, content_id: u256) -> bool {
            // Get caller address
            let caller = get_caller_address();

            // Get content
            let mut content = self.content.read(content_id);

            // Verify content exists
            assert(content.id == content_id, 'Content does not exist');

            // Verify content is active
            assert(content.is_active, 'Content already deleted');

            // Verify caller is the content creator
            assert(content.creator == caller, 'Not the content creator');

            // Mark content as deleted
            content.is_active = false;
            content.updated_at = get_block_timestamp();

            // Update content in storage
            self.content.write(content_id, content);

            // Emit event
            self
                .emit(
                    Event::ContentDeleted(
                        ContentDeleted { content_id: content_id, creator: caller },
                    ),
                );

            true
        }
    }
}
