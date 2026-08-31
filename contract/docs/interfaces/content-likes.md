# Content Likes (contracts/content-likes/src/lib.rs)

Like/unlike with pagination.

## Methods

| Method | Args | Returns | Auth | Example Invoke | Expected Events |
|--------|------|---------|------|---------------|-----------------|
| `like` | `user: Address, content_id: u32` | `()` (idempotent) | user | `soroban contract invoke ... like -- USER 123` | `("liked", content_id) -> user` |
| `unlike` | `user: Address, content_id: u32` | `()` | user | `soroban contract invoke ... unlike -- USER 123` | `("unliked", content_id) -> user` |
| `like_count` | `content_id: u32` | `u32` | none | `soroban contract invoke ... like_count -- 123` | None |
| `has_liked` | `user: Address, content_id: u32` | `bool` | none | `soroban contract invoke ... has_liked -- USER 123` | None |
| `list_likes_by_user` | `user: Address, cursor: u32, limit: u32` | `(Vec<u32>, bool)` | none | `soroban contract invoke ... list_likes_by_user -- USER 0 10` | None |

## Overview
Idempotent likes; bounded pagination (max 100). Map storage per content.

