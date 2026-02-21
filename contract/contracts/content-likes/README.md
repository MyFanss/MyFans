# Content Likes Contract

On-chain storage for content like counts and user preferences.

## Overview

This contract manages user likes for content items, storing:
- Like/unlike state per (user, content_id) pair
- Aggregate like count per content_id
- Efficient queries for like status and counts

## Functions

### `like(env, user, content_id)`
- **Authorization**: User must sign transaction
- **Behavior**: Adds user to liked set for content_id, increments count
- **Idempotent**: Second like is no-op (no double-counting)
- **Events**: Publishes "liked" event

### `unlike(env, user, content_id)`
- **Authorization**: User must sign transaction
- **Behavior**: Removes user from liked set, decrements count
- **Reverts**: If user hasn't liked the content
- **Events**: Publishes "unliked" event

### `like_count(env, content_id) -> u32`
- **Returns**: Total number of likes for content_id
- **No authorization required**: Public query

### `has_liked(env, user, content_id) -> bool`
- **Returns**: Whether user has liked the content
- **No authorization required**: Public query

## Storage Model

**Keys:**
- `LikeSet(content_id)`: Set of users who liked this content
- `LikeCount(content_id)`: Aggregate count of likes

**Rationale:**
- Composite key `(user, content_id)` would require iteration for count queries
- Separate count storage enables O(1) like_count() queries
- Set membership enables O(1) has_liked() checks

## Gas Considerations

**Current Implementation:**
- Stores (user, content_id) pairs in a Set per content_id
- Set operations: O(log n) where n = likes on that content
- Suitable for content with moderate like counts (< 10k)

**Scaling Strategies:**
1. **Sharding by content_id**: Distribute likes across multiple contracts
2. **Pagination**: Return likes in batches for large content
3. **Off-chain indexing**: Store only counts on-chain, index likes off-chain
4. **Bloom filters**: Approximate membership for very large sets

**Current Limits:**
- Soroban storage: ~1MB per contract instance
- Set operations: O(log n) complexity
- Recommended: < 100k total likes per contract instance

## Testing

Run tests with:
```bash
cargo test --lib
```

Coverage:
- Like and unlike operations
- Idempotent like behavior
- Count accuracy
- Revert on unlike when not liked
- Edge cases (zero likes, multiple users)
