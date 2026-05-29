#![no_std]
use soroban_sdk::{
    contract, contracterror, contractimpl, panic_with_error, Address, Env, Map, Symbol, Vec,
};

const MAX_PAGE_LIMIT: u32 = 100;

/// Per-contract error codes for the **content-likes** contract.
///
/// These discriminants are stable and form part of the public client API.
/// Do **not** renumber existing variants; add new ones at the end.
///
/// | Code | Variant |
/// |------|---------|
/// | 1 | `NotLiked` |
#[contracterror]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Error {
    /// Code 1 – user has not liked this content; `unlike` was called without a prior `like`.
    NotLiked = 1,
}

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
            let current_count: u32 = env.storage().instance().get(&count_key).unwrap_or(0);
            env.storage()
                .instance()
                .set(&count_key, &(current_count + 1));

            // Maintain user_likes index for list_likes_by_user
            let user_likes_key = ("user_likes", user.clone());
            let mut list: Vec<u32> = env
                .storage()
                .instance()
                .get(&user_likes_key)
                .unwrap_or_else(|| Vec::new(&env));
            list.push_back(content_id);
            env.storage().instance().set(&user_likes_key, &list);

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
            panic_with_error!(&env, Error::NotLiked);
        }

        // Remove user from map
        likes.remove(user.clone());
        env.storage().instance().set(&like_map_key, &likes);

        // Decrement count
        let current_count: u32 = env.storage().instance().get(&count_key).unwrap_or(0);
        if current_count > 0 {
            env.storage()
                .instance()
                .set(&count_key, &(current_count - 1));
        }

        // Maintain user_likes index: remove content_id from user's list
        let user_likes_key = ("user_likes", user.clone());
        let list: Vec<u32> = env
            .storage()
            .instance()
            .get(&user_likes_key)
            .unwrap_or_else(|| Vec::new(&env));
        let mut new_list = Vec::new(&env);
        for i in 0..list.len() {
            let id = list.get(i).unwrap();
            if id != content_id {
                new_list.push_back(id);
            }
        }
        env.storage().instance().set(&user_likes_key, &new_list);

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

    /// List content IDs liked by a user with pagination (bounded iteration).
    ///
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `user` - Address of the user
    /// * `cursor` - Index to start from (0 for first page)
    /// * `limit` - Max number of items to return (capped at MAX_PAGE_LIMIT)
    ///
    /// # Returns
    /// (page of content_ids, next_cursor) — `next_cursor` is 0 when there is no next page
    pub fn list_likes_by_user(env: Env, user: Address, cursor: u32, limit: u32) -> (Vec<u32>, u32) {
        let limit = core::cmp::min(limit, MAX_PAGE_LIMIT);
        let user_likes_key = ("user_likes", user);
        let list: Vec<u32> = env
            .storage()
            .instance()
            .get(&user_likes_key)
            .unwrap_or_else(|| Vec::new(&env));

        let len = list.len();
        if cursor >= len || limit == 0 {
            return (Vec::new(&env), 0);
        }

        let end = core::cmp::min(cursor + limit, len);
        let mut page = Vec::new(&env);
        for i in cursor..end {
            page.push_back(list.get(i).unwrap());
        }
        let next_cursor = if end < len { end } else { 0 };
        (page, next_cursor)
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Error as SorobanError};

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
    fn test_unlike_when_not_liked_reverts() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, ContentLikes);
        let client = ContentLikesClient::new(&env, &contract_id);

        let user = Address::generate(&env);
        let content_id = 5u32;

        // Try to unlike without liking first
        let result = client.try_unlike(&user, &content_id);
        assert_eq!(
            result,
            Err(Ok(SorobanError::from_contract_error(
                Error::NotLiked as u32,
            )))
        );
    }

    #[test]
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
        let result = client.try_unlike(&user, &content_id);
        assert_eq!(
            result,
            Err(Ok(SorobanError::from_contract_error(
                Error::NotLiked as u32,
            )))
        );
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

    #[test]
    fn test_list_likes_by_user_empty() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, ContentLikes);
        let client = ContentLikesClient::new(&env, &contract_id);

        let user = Address::generate(&env);

        let (page, next_cursor) = client.list_likes_by_user(&user, &0, &10);
        assert_eq!(page.len(), 0);
        assert_eq!(next_cursor, 0);
    }

    #[test]
    fn test_list_likes_by_user_one_page() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, ContentLikes);
        let client = ContentLikesClient::new(&env, &contract_id);

        let user = Address::generate(&env);
        client.like(&user, &1u32);
        client.like(&user, &2u32);
        client.like(&user, &3u32);

        let (page, next_cursor) = client.list_likes_by_user(&user, &0, &10);
        assert_eq!(page.len(), 3);
        assert_eq!(page.get(0).unwrap(), 1);
        assert_eq!(page.get(1).unwrap(), 2);
        assert_eq!(page.get(2).unwrap(), 3);
        assert_eq!(next_cursor, 0);
    }

    #[test]
    fn test_list_likes_by_user_over_limit_clamped() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, ContentLikes);
        let client = ContentLikesClient::new(&env, &contract_id);

        let user = Address::generate(&env);
        client.like(&user, &1u32);
        client.like(&user, &2u32);

        // Request limit > MAX_PAGE_LIMIT (100); contract clamps to 100, we get 2 items
        let (page, next_cursor) = client.list_likes_by_user(&user, &0, &1000);
        assert_eq!(page.len(), 2);
        assert_eq!(next_cursor, 0);
    }

    #[test]
    fn test_list_likes_by_user_pagination_boundary() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, ContentLikes);
        let client = ContentLikesClient::new(&env, &contract_id);

        let user = Address::generate(&env);
        for id in 1u32..=5 {
            client.like(&user, &id);
        }

        let (page1, next1) = client.list_likes_by_user(&user, &0, &2);
        assert_eq!(page1.len(), 2);
        assert_eq!(page1.get(0).unwrap(), 1);
        assert_eq!(page1.get(1).unwrap(), 2);
        assert_eq!(next1, 2);

        let (page2, next2) = client.list_likes_by_user(&user, &next1, &2);
        assert_eq!(page2.len(), 2);
        assert_eq!(page2.get(0).unwrap(), 3);
        assert_eq!(page2.get(1).unwrap(), 4);
        assert_eq!(next2, 4);

        let (page3, next3) = client.list_likes_by_user(&user, &next2, &2);
        assert_eq!(page3.len(), 1);
        assert_eq!(page3.get(0).unwrap(), 5);
        assert_eq!(next3, 0);
    }

    #[test]
    fn test_list_likes_by_user_unlike_updates_list() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, ContentLikes);
        let client = ContentLikesClient::new(&env, &contract_id);

        let user = Address::generate(&env);
        client.like(&user, &10u32);
        client.like(&user, &20u32);
        client.unlike(&user, &10u32);

        let (page, next_cursor) = client.list_likes_by_user(&user, &0, &10);
        assert_eq!(page.len(), 1);
        assert_eq!(page.get(0).unwrap(), 20);
        assert_eq!(next_cursor, 0);
        assert!(client.has_liked(&user, &20u32));
        assert!(!client.has_liked(&user, &10u32));
    }

    // ── Issue #924 – Snapshot/Restore Consistency Test ──────────────────────
    //
    // This test verifies that the contract's state remains consistent and readable
    // after a series of like/unlike operations across snapshot/restore boundaries.
    // It ensures:
    // 1. Like counts are preserved across snapshot/restore
    // 2. User like lists are preserved and queryable
    // 3. Individual like status (has_liked) is consistent
    // 4. Pagination state is correct after restore
    // 5. Multiple users' likes remain independent
    #[test]
    fn test_snapshot_restore_consistency() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, ContentLikes);
        let client = ContentLikesClient::new(&env, &contract_id);

        // ── Setup: Create multiple users and content ────────────────────────
        let user1 = Address::generate(&env);
        let user2 = Address::generate(&env);
        let user3 = Address::generate(&env);

        // ── Phase 1: Perform initial operations ────────────────────────────
        // User1 likes content 1, 2, 3
        client.like(&user1, &1u32);
        client.like(&user1, &2u32);
        client.like(&user1, &3u32);

        // User2 likes content 1, 2
        client.like(&user2, &1u32);
        client.like(&user2, &2u32);

        // User3 likes content 1
        client.like(&user3, &1u32);

        // ── Snapshot Phase 1: Capture state before restore ──────────────────
        let snapshot_content1_count = client.like_count(&1u32);
        let snapshot_content2_count = client.like_count(&2u32);
        let snapshot_content3_count = client.like_count(&3u32);

        let snapshot_user1_likes_content1 = client.has_liked(&user1, &1u32);
        let snapshot_user1_likes_content2 = client.has_liked(&user1, &2u32);
        let snapshot_user1_likes_content3 = client.has_liked(&user1, &3u32);

        let snapshot_user2_likes_content1 = client.has_liked(&user2, &1u32);
        let snapshot_user2_likes_content2 = client.has_liked(&user2, &2u32);

        let snapshot_user3_likes_content1 = client.has_liked(&user3, &1u32);

        let (snapshot_user1_page, snapshot_user1_next) =
            client.list_likes_by_user(&user1, &0, &10);
        let (snapshot_user2_page, snapshot_user2_next) =
            client.list_likes_by_user(&user2, &0, &10);
        let (snapshot_user3_page, snapshot_user3_next) =
            client.list_likes_by_user(&user3, &0, &10);

        // ── Perform additional operations before restore ────────────────────
        client.unlike(&user1, &2u32);
        client.like(&user2, &3u32);

        // ── Restore from snapshot ──────────────────────────────────────────
        let sc_contract: soroban_sdk::ScAddress = contract_id.clone().into();
        let sc_user1: soroban_sdk::ScAddress = user1.clone().into();
        let sc_user2: soroban_sdk::ScAddress = user2.clone().into();
        let sc_user3: soroban_sdk::ScAddress = user3.clone().into();

        let snapshot = env.to_snapshot();
        let env2 = Env::from_snapshot(snapshot);
        env2.mock_all_auths();

        let contract_id2: Address =
            Address::try_from_val(&env2, &sc_contract).unwrap();
        let user1_2: Address = Address::try_from_val(&env2, &sc_user1).unwrap();
        let user2_2: Address = Address::try_from_val(&env2, &sc_user2).unwrap();
        let user3_2: Address = Address::try_from_val(&env2, &sc_user3).unwrap();

        env2.register_contract(Some(&contract_id2), ContentLikes);
        let client2 = ContentLikesClient::new(&env2, &contract_id2);

        // ── Verify state after restore ─────────────────────────────────────
        // Content like counts should match snapshot
        assert_eq!(
            client2.like_count(&1u32),
            snapshot_content1_count,
            "content 1 like count mismatch after restore"
        );
        assert_eq!(
            client2.like_count(&2u32),
            snapshot_content2_count,
            "content 2 like count mismatch after restore"
        );
        assert_eq!(
            client2.like_count(&3u32),
            snapshot_content3_count,
            "content 3 like count mismatch after restore"
        );

        // User1 like status should match snapshot
        assert_eq!(
            client2.has_liked(&user1_2, &1u32),
            snapshot_user1_likes_content1,
            "user1 content1 like status mismatch after restore"
        );
        assert_eq!(
            client2.has_liked(&user1_2, &2u32),
            snapshot_user1_likes_content2,
            "user1 content2 like status mismatch after restore"
        );
        assert_eq!(
            client2.has_liked(&user1_2, &3u32),
            snapshot_user1_likes_content3,
            "user1 content3 like status mismatch after restore"
        );

        // User2 like status should match snapshot
        assert_eq!(
            client2.has_liked(&user2_2, &1u32),
            snapshot_user2_likes_content1,
            "user2 content1 like status mismatch after restore"
        );
        assert_eq!(
            client2.has_liked(&user2_2, &2u32),
            snapshot_user2_likes_content2,
            "user2 content2 like status mismatch after restore"
        );

        // User3 like status should match snapshot
        assert_eq!(
            client2.has_liked(&user3_2, &1u32),
            snapshot_user3_likes_content1,
            "user3 content1 like status mismatch after restore"
        );

        // User1 pagination should match snapshot
        let (restored_user1_page, restored_user1_next) =
            client2.list_likes_by_user(&user1_2, &0, &10);
        assert_eq!(
            restored_user1_page.len(),
            snapshot_user1_page.len(),
            "user1 page length mismatch after restore"
        );
        for i in 0..restored_user1_page.len() {
            assert_eq!(
                restored_user1_page.get(i).unwrap(),
                snapshot_user1_page.get(i).unwrap(),
                "user1 page content mismatch at index {} after restore",
                i
            );
        }
        assert_eq!(
            restored_user1_next, snapshot_user1_next,
            "user1 next cursor mismatch after restore"
        );

        // User2 pagination should match snapshot
        let (restored_user2_page, restored_user2_next) =
            client2.list_likes_by_user(&user2_2, &0, &10);
        assert_eq!(
            restored_user2_page.len(),
            snapshot_user2_page.len(),
            "user2 page length mismatch after restore"
        );
        for i in 0..restored_user2_page.len() {
            assert_eq!(
                restored_user2_page.get(i).unwrap(),
                snapshot_user2_page.get(i).unwrap(),
                "user2 page content mismatch at index {} after restore",
                i
            );
        }
        assert_eq!(
            restored_user2_next, snapshot_user2_next,
            "user2 next cursor mismatch after restore"
        );

        // User3 pagination should match snapshot
        let (restored_user3_page, restored_user3_next) =
            client2.list_likes_by_user(&user3_2, &0, &10);
        assert_eq!(
            restored_user3_page.len(),
            snapshot_user3_page.len(),
            "user3 page length mismatch after restore"
        );
        for i in 0..restored_user3_page.len() {
            assert_eq!(
                restored_user3_page.get(i).unwrap(),
                snapshot_user3_page.get(i).unwrap(),
                "user3 page content mismatch at index {} after restore",
                i
            );
        }
        assert_eq!(
            restored_user3_next, snapshot_user3_next,
            "user3 next cursor mismatch after restore"
        );
    }
}
