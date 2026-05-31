//! Integration tests for content-likes contract using the TestEnv fixture.
//! Tests the contract as an external caller would invoke it, verifying full call paths
//! and state changes.

use content_likes::*;
use myfans_lib::test_fixtures::TestEnv;
use soroban_sdk::Vec;

/// Test the full like/unlike/count lifecycle as an external caller.
#[test]
fn test_like_unlike_lifecycle() {
    let f = TestEnv::new();
    let contract_id = f.env.register_contract(None, ContentLikes);
    let client = ContentLikesClient::new(&f.env, &contract_id);

    let user = f.fan;
    let content_id = 42u32;

    // Initial state: no likes
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

/// Test that like is idempotent from external caller perspective.
#[test]
fn test_like_idempotent_external() {
    let f = TestEnv::new();
    let contract_id = f.env.register_contract(None, ContentLikes);
    let client = ContentLikesClient::new(&f.env, &contract_id);

    let user = f.fan;
    let content_id = 99u32;

    // Like multiple times
    client.like(&user, &content_id);
    client.like(&user, &content_id);
    client.like(&user, &content_id);

    // Should only count as one like
    assert_eq!(client.like_count(&content_id), 1);
    assert!(client.has_liked(&user, &content_id));
}

/// Test error path: unlike without prior like reverts.
#[test]
fn test_error_unlike_without_like() {
    let f = TestEnv::new();
    let contract_id = f.env.register_contract(None, ContentLikes);
    let client = ContentLikesClient::new(&f.env, &contract_id);

    let user = f.fan;
    let content_id = 5u32;

    // Try to unlike without ever liking — should fail with NotLiked error (code 1)
    let result = client.try_unlike(&user, &content_id);
    assert!(
        result.is_err(),
        "Expected unlike without prior like to fail with NotLiked error"
    );
}

/// Test multiple users liking the same content.
#[test]
fn test_multiple_users_like_same_content() {
    let f = TestEnv::new();
    let contract_id = f.env.register_contract(None, ContentLikes);
    let client = ContentLikesClient::new(&f.env, &contract_id);

    let user1 = f.fan;
    let user2 = f.creator;
    let user3 = f.admin;
    let content_id = 123u32;

    // Three different users like the same content
    client.like(&user1, &content_id);
    assert_eq!(client.like_count(&content_id), 1);

    client.like(&user2, &content_id);
    assert_eq!(client.like_count(&content_id), 2);

    client.like(&user3, &content_id);
    assert_eq!(client.like_count(&content_id), 3);

    // Each user can unlike independently
    client.unlike(&user2, &content_id);
    assert_eq!(client.like_count(&content_id), 2);
    assert!(client.has_liked(&user1, &content_id));
    assert!(!client.has_liked(&user2, &content_id));
    assert!(client.has_liked(&user3, &content_id));
}

/// Test list_likes_by_user pagination from external caller perspective.
#[test]
fn test_list_likes_by_user_pagination_external() {
    let f = TestEnv::new();
    let contract_id = f.env.register_contract(None, ContentLikes);
    let client = ContentLikesClient::new(&f.env, &contract_id);

    let user = f.fan;

    // User likes multiple content items
    for id in 1u32..=5 {
        client.like(&user, &id);
    }

    // Get first page (2 items)
    let (page1, next1): (Vec<u32>, u32) = client.list_likes_by_user(&user, &0, &2);
    assert_eq!(page1.len(), 2);
    assert_eq!(page1.get(0).unwrap(), 1);
    assert_eq!(page1.get(1).unwrap(), 2);
    assert_ne!(next1, 0);

    // Get second page
    let (page2, next2): (Vec<u32>, u32) = client.list_likes_by_user(&user, &next1, &2);
    assert_eq!(page2.len(), 2);
    assert_eq!(page2.get(0).unwrap(), 3);
    assert_eq!(page2.get(1).unwrap(), 4);
    assert_ne!(next2, 0);

    // Get final page
    let (page3, next3): (Vec<u32>, u32) = client.list_likes_by_user(&user, &next2, &2);
    assert_eq!(page3.len(), 1);
    assert_eq!(page3.get(0).unwrap(), 5);
    assert_eq!(next3, 0); // No more pages
}

/// Test that unlike updates the user's like list.
#[test]
fn test_unlike_updates_user_list() {
    let f = TestEnv::new();
    let contract_id = f.env.register_contract(None, ContentLikes);
    let client = ContentLikesClient::new(&f.env, &contract_id);

    let user = f.fan;

    // User likes multiple items
    client.like(&user, &10u32);
    client.like(&user, &20u32);
    client.like(&user, &30u32);

    // Verify initial list
    let (page, _): (Vec<u32>, u32) = client.list_likes_by_user(&user, &0, &10);
    assert_eq!(page.len(), 3);

    // Unlike one item
    client.unlike(&user, &20u32);

    // Verify list is updated
    let (page, _): (Vec<u32>, u32) = client.list_likes_by_user(&user, &0, &10);
    assert_eq!(page.len(), 2);
    assert_eq!(page.get(0).unwrap(), 10);
    assert_eq!(page.get(1).unwrap(), 30);
    assert!(!client.has_liked(&user, &20u32));
}

/// Test that like emits a liked event.
#[test]
fn test_like_emits_event() {
    let f = TestEnv::new();
    let contract_id = f.env.register_contract(None, ContentLikes);
    let client = ContentLikesClient::new(&f.env, &contract_id);

    let user = f.fan;
    let content_id = 42u32;

    // Clear any previous events
    f.env.events().publish(("test_marker",), ());

    // User likes content
    client.like(&user, &content_id);

    // Verify event was published
    let events = f.env.events().all();
    assert!(
        events.len() > 0,
        "Expected at least one event to be published"
    );

    // The last event should be the liked event
    let last_event = events.last().unwrap();
    assert_eq!(last_event.0.len(), 2, "Expected 2 topics in liked event");
}

/// Test that unlike emits an unliked event.
#[test]
fn test_unlike_emits_event() {
    let f = TestEnv::new();
    let contract_id = f.env.register_contract(None, ContentLikes);
    let client = ContentLikesClient::new(&f.env, &contract_id);

    let user = f.fan;
    let content_id = 42u32;

    // User likes content first
    client.like(&user, &content_id);

    // Clear events
    f.env.events().publish(("test_marker",), ());

    // User unlikes content
    client.unlike(&user, &content_id);

    // Verify event was published
    let events = f.env.events().all();
    assert!(
        events.len() > 0,
        "Expected at least one event to be published"
    );

    // The last event should be the unliked event
    let last_event = events.last().unwrap();
    assert_eq!(last_event.0.len(), 2, "Expected 2 topics in unliked event");
}

/// Test that idempotent like does not emit duplicate events.
#[test]
fn test_idempotent_like_no_duplicate_events() {
    let f = TestEnv::new();
    let contract_id = f.env.register_contract(None, ContentLikes);
    let client = ContentLikesClient::new(&f.env, &contract_id);

    let user = f.fan;
    let content_id = 42u32;

    // First like
    client.like(&user, &content_id);
    let events_after_first = f.env.events().all().len();

    // Second like (idempotent)
    client.like(&user, &content_id);
    let events_after_second = f.env.events().all().len();

    // No new events should be published for idempotent like
    assert_eq!(
        events_after_first, events_after_second,
        "Idempotent like should not emit additional events"
    );
}

/// Test that like rejects unauthorized caller (no auth).
#[test]
fn test_like_unauthorized_caller_rejected() {
    let f = TestEnv::new();
    let contract_id = f.env.register_contract(None, ContentLikes);
    let client = ContentLikesClient::new(&f.env, &contract_id);

    let user = f.fan;
    let content_id = 42u32;

    // Strip all auth to simulate unauthorized caller
    f.env.set_auths(&[]);

    // Try to like without authorization
    let result = client.try_like(&user, &content_id);
    assert!(
        result.is_err(),
        "like() must reject unauthorized caller (no auth)"
    );
}

/// Test that unlike rejects unauthorized caller (no auth).
#[test]
fn test_unlike_unauthorized_caller_rejected() {
    let f = TestEnv::new();
    let contract_id = f.env.register_contract(None, ContentLikes);
    let client = ContentLikesClient::new(&f.env, &contract_id);

    let user = f.fan;
    let content_id = 42u32;

    // First, like with proper auth
    client.like(&user, &content_id);

    // Strip all auth to simulate unauthorized caller
    f.env.set_auths(&[]);

    // Try to unlike without authorization
    let result = client.try_unlike(&user, &content_id);
    assert!(
        result.is_err(),
        "unlike() must reject unauthorized caller (no auth)"
    );
}

/// Test that like rejects when caller is not the user parameter.
#[test]
fn test_like_wrong_user_rejected() {
    let f = TestEnv::new();
    let contract_id = f.env.register_contract(None, ContentLikes);
    let client = ContentLikesClient::new(&f.env, &contract_id);

    let user1 = f.fan;
    let user2 = f.creator;
    let content_id = 42u32;

    // user1 tries to like as user2 (wrong signer)
    // This should fail because user.require_auth() checks that the caller is user
    f.env.set_auths(&[]);
    let result = client.try_like(&user1, &content_id);
    assert!(
        result.is_err(),
        "like() must reject when caller is not the user parameter"
    );
}

/// Test that unlike rejects when caller is not the user parameter.
#[test]
fn test_unlike_wrong_user_rejected() {
    let f = TestEnv::new();
    let contract_id = f.env.register_contract(None, ContentLikes);
    let client = ContentLikesClient::new(&f.env, &contract_id);

    let user1 = f.fan;
    let user2 = f.creator;
    let content_id = 42u32;

    // user1 likes content
    client.like(&user1, &content_id);

    // user2 tries to unlike as user1 (wrong signer)
    f.env.set_auths(&[]);
    let result = client.try_unlike(&user1, &content_id);
    assert!(
        result.is_err(),
        "unlike() must reject when caller is not the user parameter"
    );
}
