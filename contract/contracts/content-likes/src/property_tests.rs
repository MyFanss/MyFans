//! Property-based tests for the content-likes contract invariants.
//!
//! Run with: `cargo test -p content-likes prop_`

#[cfg(test)]
mod props {
    extern crate std;

    use crate::{ContentLikes, ContentLikesClient, Error};
    use proptest::prelude::*;
    use soroban_sdk::{testutils::Address as _, Address, Env, Error as SorobanError};
    use std::vec::Vec as StdVec;

    const USER_COUNT: usize = 3;
    const CONTENT_IDS: [u32; 4] = [11, 22, 33, 44];
    const CONTENT_COUNT: usize = CONTENT_IDS.len();

    fn assert_invariants(
        client: &ContentLikesClient<'_>,
        users: &[Address; USER_COUNT],
        model: &[[bool; CONTENT_COUNT]; USER_COUNT],
        expected_lists: &[StdVec<u32>; USER_COUNT],
    ) {
        for (content_idx, content_id) in CONTENT_IDS.iter().enumerate() {
            let expected_count = model
                .iter()
                .filter(|user_likes| user_likes[content_idx])
                .count() as u32;
            assert_eq!(
                client.like_count(content_id),
                expected_count,
                "like_count must match the number of users who liked content {}",
                content_id
            );

            for (user_idx, user) in users.iter().enumerate() {
                assert_eq!(
                    client.has_liked(user, content_id),
                    model[user_idx][content_idx],
                    "has_liked must match the modeled state for user {} and content {}",
                    user_idx,
                    content_id
                );
            }
        }

        for (user_idx, user) in users.iter().enumerate() {
            let (page, next_cursor) = client.list_likes_by_user(user, &0, &100);
            assert_eq!(
                next_cursor, 0,
                "a large enough page limit should return all items in one page"
            );
            assert_eq!(page.len(), expected_lists[user_idx].len() as u32);
            for (item_idx, expected_content_id) in expected_lists[user_idx].iter().enumerate() {
                assert_eq!(page.get(item_idx as u32).unwrap(), *expected_content_id);
            }
        }
    }

    proptest! {
        #![proptest_config(ProptestConfig::with_cases(16))]

        /// Random like/unlike sequences must preserve the contract's core invariants:
        /// counts, per-user indexes, and boolean membership all stay in sync.
        #[test]
        fn prop_like_unlike_sequences_preserve_invariants(
            ops in prop::collection::vec((0usize..USER_COUNT, 0usize..CONTENT_COUNT, 0u8..=1u8), 1..24)
        ) {
            let env = Env::default();
            env.mock_all_auths();

            let contract_id = env.register_contract(None, ContentLikes);
            let client = ContentLikesClient::new(&env, &contract_id);

            let users: [Address; USER_COUNT] = core::array::from_fn(|_| Address::generate(&env));
            let mut model = [[false; CONTENT_COUNT]; USER_COUNT];
            let mut expected_lists: [StdVec<u32>; USER_COUNT] = core::array::from_fn(|_| StdVec::new());

            for (user_idx, content_idx, op_kind) in ops {
                let user = &users[user_idx];
                let content_id = CONTENT_IDS[content_idx];

                match op_kind {
                    0 => {
                        client.like(user, &content_id);
                        if !model[user_idx][content_idx] {
                            model[user_idx][content_idx] = true;
                            expected_lists[user_idx].push(content_id);
                        }
                    }
                    _ => {
                        if model[user_idx][content_idx] {
                            client.unlike(user, &content_id);
                            model[user_idx][content_idx] = false;
                            expected_lists[user_idx].retain(|liked_id| *liked_id != content_id);
                        } else {
                            prop_assert_eq!(
                                client.try_unlike(user, &content_id),
                                Err(Ok(SorobanError::from_contract_error(
                                    Error::NotLiked as u32,
                                ))),
                                "unlike without a prior like must fail cleanly"
                            );
                        }
                    }
                }

                assert_invariants(&client, &users, &model, &expected_lists);
            }
        }

    }
}
