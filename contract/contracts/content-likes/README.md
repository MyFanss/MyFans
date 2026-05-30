# Content Likes Contract

On-chain storage for content like counts and user preferences.

## Overview

This contract manages user likes for content items, storing:
- Like/unlike state per (user, content_id) pair
- Aggregate like count per content_id
- Efficient queries for like status and counts

---

## Error Codes

| Code | Variant | Description |
|------|---------|-------------|
| 1 | `NotLiked` | User has not liked this content; `unlike` was called without a prior `like` |

---

## Public Functions

### `like`

```rust
pub fn like(env: Env, user: Address, content_id: u32)
```

Like a content item. Adds user to the liked set for this content and increments the like count.

**Parameters:**
- `env` - Soroban environment
- `user` - Address of the user liking the content
- `content_id` - ID of the content being liked

**Authorization:** User must sign the transaction.

**Behavior:**
- Idempotent: second like is a no-op (no double-counting)
- Increments like count only on first like
- Maintains user's like list for pagination

**Events:** Publishes `liked` event with topics `(liked, content_id)` and data `user`

**Panics:** Never panics; always succeeds (idempotent).

---

### `unlike`

```rust
pub fn unlike(env: Env, user: Address, content_id: u32)
```

Unlike a content item. Removes user from the liked set and decrements the like count.

**Parameters:**
- `env` - Soroban environment
- `user` - Address of the user unliking the content
- `content_id` - ID of the content being unliked

**Authorization:** User must sign the transaction.

**Behavior:**
- Removes user from liked set
- Decrements like count
- Updates user's like list

**Events:** Publishes `unliked` event with topics `(unliked, content_id)` and data `user`

**Panics:** With `NotLiked` (code 1) if user hasn't liked the content.

---

### `like_count`

```rust
pub fn like_count(env: Env, content_id: u32) -> u32
```

Get the total like count for a content item.

**Parameters:**
- `env` - Soroban environment
- `content_id` - ID of the content

**Returns:** Total number of likes for this content (0 if never liked).

**Authorization:** None required. Public query.

**Complexity:** O(1) — direct storage lookup.

---

### `has_liked`

```rust
pub fn has_liked(env: Env, user: Address, content_id: u32) -> bool
```

Check if a user has liked a content item.

**Parameters:**
- `env` - Soroban environment
- `user` - Address of the user
- `content_id` - ID of the content

**Returns:** `true` if user has liked the content, `false` otherwise.

**Authorization:** None required. Public query.

**Complexity:** O(log n) where n = likes on this content (map lookup).

---

### `list_likes_by_user`

```rust
pub fn list_likes_by_user(env: Env, user: Address, cursor: u32, limit: u32) -> (Vec<u32>, u32)
```

List content IDs liked by a user with pagination.

**Parameters:**
- `env` - Soroban environment
- `user` - Address of the user
- `cursor` - Index to start from (0 for first page)
- `limit` - Max number of items to return (capped at 100)

**Returns:** Tuple of `(page of content_ids, next_cursor)`
- `next_cursor` is 0 when there is no next page
- `next_cursor` equals the index to pass for the next call

**Authorization:** None required. Public query.

**Behavior:**
- Limit is automatically capped at `MAX_PAGE_LIMIT` (100)
- Returns empty page if cursor >= total likes or limit is 0
- Enables efficient pagination through large like lists

**Complexity:** O(limit) — linear scan of the requested page.

**Example:**
```rust
// Get first 10 likes
let (page1, next1) = client.list_likes_by_user(&user, &0, &10);

// Get next 10 likes
if next1 > 0 {
    let (page2, next2) = client.list_likes_by_user(&user, &next1, &10);
}
```

---

## Events Reference

| Event | Topics | Data |
|-------|--------|------|
| `liked` | `(liked, content_id)` | `user: Address` |
| `unliked` | `(unliked, content_id)` | `user: Address` |

---

## Storage Model

**Keys:**
- `("likes", content_id)` → `Map<Address, bool>` — Set of users who liked this content
- `("count", content_id)` → `u32` — Aggregate count of likes
- `("user_likes", user)` → `Vec<u32>` — List of content IDs liked by user (for pagination)

**Rationale:**
- Separate count storage enables O(1) `like_count()` queries
- Map membership enables O(log n) `has_liked()` checks
- User likes vector enables efficient pagination without iteration over all content

## Usage Example

```rust
let user = Address::generate(&env);
let content_id = 42u32;

// User likes content
client.like(&user, &content_id);

// Check if user has liked
assert!(client.has_liked(&user, &content_id));

// Get like count
assert_eq!(client.like_count(&content_id), 1);

// List user's likes
let (page, next_cursor) = client.list_likes_by_user(&user, &0, &10);
assert_eq!(page.len(), 1);
assert_eq!(page.get(0).unwrap(), 42);

// Unlike content
client.unlike(&user, &content_id);
assert!(!client.has_liked(&user, &content_id));
assert_eq!(client.like_count(&content_id), 0);
```

---

## Gas Considerations

**Current Implementation:**
- Stores (user, content_id) pairs in a Map per content_id
- Map operations: O(log n) where n = likes on that content
- Suitable for content with moderate like counts (< 10k)

**Complexity Analysis:**
| Operation | Complexity | Notes |
|-----------|-----------|-------|
| `like()` | O(log n) | Map insert, n = likes on content |
| `unlike()` | O(log n) | Map remove |
| `like_count()` | O(1) | Direct lookup |
| `has_liked()` | O(log n) | Map contains check |
| `list_likes_by_user()` | O(limit) | Linear scan of page |

**Scaling Strategies:**
1. **Sharding by content_id**: Distribute likes across multiple contracts
2. **Pagination**: Return likes in batches for large content (built-in via `list_likes_by_user`)
3. **Off-chain indexing**: Store only counts on-chain, index likes off-chain
4. **Bloom filters**: Approximate membership for very large sets

**Current Limits:**
- Soroban storage: ~1MB per contract instance
- Map operations: O(log n) complexity
- Recommended: < 100k total likes per contract instance

---

## Interface Docs

Full method reference: [../docs/interfaces/content-likes.md](../docs/interfaces/content-likes.md)

---

## Testing

Run tests with:
```bash
cargo test --lib
```

### Test Coverage

Unit tests (`src/lib.rs`):
- **Like and unlike operations**: Basic like/unlike flow
- **Idempotent like behavior**: Second like is no-op
- **Count accuracy**: Multiple users, independent counts
- **Revert on unlike when not liked**: Error handling
- **Multiple content items**: Likes are independent per content
- **Zero likes queries**: Uninitialized content returns 0
- **Pagination**: Cursor-based pagination with limit capping
- **Pagination boundary**: Multi-page traversal
- **Unlike updates list**: User like list consistency
- **Snapshot/restore consistency** (Issue #924): State integrity across environment boundaries

---

## Integration

This contract works with:
- Backend services (to index likes and serve analytics)
- Frontend (to display like counts and user like status)
- Other contracts (to gate content based on like counts)
