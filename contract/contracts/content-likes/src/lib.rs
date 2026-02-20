#![no_std]
use soroban_sdk::{contract, contractimpl, Address, Env, Map, Symbol};

#[contract]
pub struct ContentLikes;

#[contractimpl]
impl ContentLikes {
    /// Like a content item (idempotent)
    /// 
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `user` - Address of the user liking the content
    /// * `content_id` - ID of the content being liked
    /// 
    /// # Behavior
    /// - User must authorize the transaction
    /// - Adds user to the liked map for this content
    /// - Increments the like count
    /// - If user already liked, this is a no-op (idempotent)
    pub fn like(env: Env, user: Address, content_id: u32) {
        user.require_auth();

        let like_map_key = ("likes", content_id);
        let count_key = ("count", content_id);

        // Get existing like map or create new one
        let mut likes: Map<Address, bool> = env
            .storage()
            .instance()
            .get(&like_map_key)
            .unwrap_or_else(|| Map::new(&env));

        // Check if already liked (idempotent)
        let already_liked = likes.get(user.clone()).is_some();

        if !already_liked {
            // Add user to map
            likes.set(user.clone(), true);
            env.storage().instance().set(&like_map_key, &likes);

            // Increment count
            let current_count: u32 = env
                .storage()
                .instance()
                .get(&count_key)
                .unwrap_or(0);
            env.storage()
                .instance()
                .set(&count_key, &(current_count + 1));

            // Publish event
            env.events()
                .publish((Symbol::new(&env, "liked"), content_id), user);
        }
    }

    /// Unlike a content item
    /// 
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `user` - Address of the user unliking the content
    /// * `content_id` - ID of the content being unliked
    /// 
    /// # Behavior
    /// - User must authorize the transaction
    /// - Removes user from the liked map
    /// - Decrements the like count
    /// - Reverts if user hasn't liked the content
    pub fn unlike(env: Env, user: Address, content_id: u32) {
        user.require_auth();

        let like_map_key = ("likes", content_id);
        let count_key = ("count", content_id);

        // Get existing like map
        let mut likes: Map<Address, bool> = env
            .storage()
            .instance()
            .get(&like_map_key)
            .unwrap_or_else(|| Map::new(&env));

        // Verify user has liked (revert if not)
        if likes.get(user.clone()).is_none() {
            panic!("User has not liked this content");
        }

        // Remove user from map
        likes.remove(user.clone());
        env.storage().instance().set(&like_map_key, &likes);

        // Decrement count
        let current_count: u32 = env
            .storage()
            .instance()
            .get(&count_key)
            .unwrap_or(0);
        if current_count > 0 {
            env.storage()
                .instance()
                .set(&count_key, &(current_count - 1));
        }

        // Publish event
        env.events()
            .publish((Symbol::new(&env, "unliked"), content_id), user);
    }

    /// Get the total like count for a content item
    /// 
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `content_id` - ID of the content
    /// 
    /// # Returns
    /// Total number of likes for this content (0 if never liked)
    pub fn like_count(env: Env, content_id: u32) -> u32 {
        let count_key = ("count", content_id);
        env.storage().instance().get(&count_key).unwrap_or(0)
    }

    /// Check if a user has liked a content item
    /// 
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `user` - Address of the user
    /// * `content_id` - ID of the content
    /// 
    /// # Returns
    /// true if user has liked the content, false otherwise
    pub fn has_liked(env: Env, user: Address, content_id: u32) -> bool {
        let like_map_key = ("likes", content_id);
        let likes: Map<Address, bool> = env
            .storage()
            .instance()
            .get(&like_map_key)
            .unwrap_or_else(|| Map::new(&env));

        likes.get(user).is_some()
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::testutils::Address as _;

    #[test]
    fn test_like_and_unlike() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, ContentLikes);
        let client = ContentLikesClient::new(&env, &contract_id);

        let user = Address::generate(&env);
        let content_id = 1u32;

        // Initially no likes
        assert_eq!(client.like_count(&content_id), 0);
        assert!(!client.has_liked(&user, &content_id));

        // User likes content
        client.like(&user, &content_id);
        assert_eq!(client.like_count(&content_id), 1);
        assert!(client.has_liked(&user, &content_id));

        // User unlikes content
        client.unlike(&user, &content_id);
        assert_eq!(client.like_count(&content_id), 0);
        assert!(!client.has_liked(&user, &content_id));
    }

    #[test]
    fn test_like_count_accuracy() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, ContentLikes);
        let client = ContentLikesClient::new(&env, &contract_id);

        let user1 = Address::generate(&env);
        let user2 = Address::generate(&env);
        let user3 = Address::generate(&env);
        let content_id = 42u32;

        // Three users like the same content
        client.like(&user1, &content_id);
        assert_eq!(client.like_count(&content_id), 1);

        client.like(&user2, &content_id);
        assert_eq!(client.like_count(&content_id), 2);

        client.like(&user3, &content_id);
        assert_eq!(client.like_count(&content_id), 3);

        // One user unlikes
        client.unlike(&user2, &content_id);
        assert_eq!(client.like_count(&content_id), 2);

        // Verify remaining users still have liked
        assert!(client.has_liked(&user1, &content_id));
        assert!(!client.has_liked(&user2, &content_id));
        assert!(client.has_liked(&user3, &content_id));
    }

    #[test]
    fn test_double_like_idempotent() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, ContentLikes);
        let client = ContentLikesClient::new(&env, &contract_id);

        let user = Address::generate(&env);
        let content_id = 99u32;

        // Like once
        client.like(&user, &content_id);
        assert_eq!(client.like_count(&content_id), 1);

        // Like again (should be no-op)
        client.like(&user, &content_id);
        assert_eq!(client.like_count(&content_id), 1);

        // Like a third time (still no-op)
        client.like(&user, &content_id);
        assert_eq!(client.like_count(&content_id), 1);

        // Verify user still has liked
        assert!(client.has_liked(&user, &content_id));
    }

    #[test]
    #[should_panic(expected = "User has not liked this content")]
    fn test_unlike_when_not_liked_reverts() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, ContentLikes);
        let client = ContentLikesClient::new(&env, &contract_id);

        let user = Address::generate(&env);
        let content_id = 5u32;

        // Try to unlike without liking first
        client.unlike(&user, &content_id);
    }

    #[test]
    #[should_panic(expected = "User has not liked this content")]
    fn test_unlike_twice_reverts() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, ContentLikes);
        let client = ContentLikesClient::new(&env, &contract_id);

        let user = Address::generate(&env);
        let content_id = 7u32;

        // Like and unlike
        client.like(&user, &content_id);
        client.unlike(&user, &content_id);

        // Try to unlike again (should panic)
        client.unlike(&user, &content_id);
    }

    #[test]
    fn test_multiple_content_items() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, ContentLikes);
        let client = ContentLikesClient::new(&env, &contract_id);

        let user = Address::generate(&env);

        // Like different content items
        client.like(&user, &1u32);
        client.like(&user, &2u32);
        client.like(&user, &3u32);

        // Verify counts are independent
        assert_eq!(client.like_count(&1u32), 1);
        assert_eq!(client.like_count(&2u32), 1);
        assert_eq!(client.like_count(&3u32), 1);

        // Verify user has liked all
        assert!(client.has_liked(&user, &1u32));
        assert!(client.has_liked(&user, &2u32));
        assert!(client.has_liked(&user, &3u32));

        // Unlike one
        client.unlike(&user, &2u32);

        // Verify only that one is affected
        assert_eq!(client.like_count(&1u32), 1);
        assert_eq!(client.like_count(&2u32), 0);
        assert_eq!(client.like_count(&3u32), 1);
    }

    #[test]
    fn test_zero_likes_queries() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, ContentLikes);
        let client = ContentLikesClient::new(&env, &contract_id);

        let user = Address::generate(&env);
        let content_id = 100u32;

        // Query content that was never liked
        assert_eq!(client.like_count(&content_id), 0);
        assert!(!client.has_liked(&user, &content_id));
    }
}
