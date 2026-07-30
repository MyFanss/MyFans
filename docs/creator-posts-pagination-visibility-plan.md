# Plan: Consistent Pagination + Visibility Filter for Creator Posts

## Problem

`content.controller.ts`'s `GET creator/:creatorId` listing (backed by
`content.service.ts#findByCreator`) already paginates via `PaginationDto`,
but has no way to filter by visibility (published/gated/draft) — callers
always get every post back regardless of `is_published` or
`subscription_tier`, which is inconsistent with how a creator vs. a fan
should see the listing.

## Solution (this change)

Adds `CreatorPostsQueryDto` (`backend/src/content/dto/creator-posts-query.dto.ts`),
extending the existing `PaginationDto` with a `visibility` filter:
`public` | `subscribers` | `draft` | `all` (default, matching current
behavior so nothing breaks for existing callers).

## Wiring (follow-up, not in this change)

1. `content.controller.ts`: swap `@Query() pagination: PaginationDto` for
   `@Query() query: CreatorPostsQueryDto` on the `creator/:creatorId` route.
2. `content.service.ts#findByCreator`: add a `where` clause on
   `is_published` / `subscription_tier` based on `query.visibility`,
   mirroring the existing query builder pattern already used for cursor
   pagination in that method.
