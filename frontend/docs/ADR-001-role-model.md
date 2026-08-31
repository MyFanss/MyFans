# ADR-001 — Creator vs Fan Role Model

**Status:** Accepted  
**Date:** 2026-08-31  
**Issue:** [#1659 Onboarding fan vs creator split](https://github.com/MyFanss/MyFans/issues/1659)

---

## Context

MyFans has two distinct user roles: **creator** (publishes content, earns revenue) and **fan**
(subscribes to creators, consumes content).  The onboarding flow exposes three choices:

| Intent    | Meaning |
|-----------|---------|
| `creator` | Pure creator account |
| `fan`     | Pure fan account |
| `both`    | Creator who also subscribes to other creators |

The role stored in the backend is `is_creator: boolean` on the `users` table.  A fan
has `is_creator: false`; a creator (or "both") has `is_creator: true`.

A previous implementation routed *all* completed-onboarding users to `/dashboard`.  This
caused fans to land on a page gated by `RouteGuard` and `fetchMe`, which then redirected
them to `/discover` after an extra round-trip.  It also caused confusion: fans had no
dashboard, and the redirect flash was jarring.

---

## Decision

### 1. Roles are effectively mutually exclusive at the nav/routing level

The `is_creator` flag is the canonical role signal:

* `is_creator: true` → creator nav, `/dashboard` is the post-auth home
* `is_creator: false` → fan nav, `/discover` (or `/subscriptions`) is the post-auth home

The `both` intent during onboarding maps to `is_creator: true`.  A "both" user is a
creator who is *also allowed* to subscribe — they just happen to be a creator first.

### 2. Deep-link after onboarding is role-specific

| Onboarding intent | Redirect after completion |
|-------------------|---------------------------|
| `creator`         | `/dashboard`              |
| `fan`             | `/discover`               |
| `both`            | `/dashboard`              |
| `null`            | `/discover` (safe default) |

This eliminates the redundant redirect loop previously visible for fan accounts.

### 3. `/dashboard` is blocked for fans

`RouteGuard` already calls `fetchMe()` and checks `me.is_creator`; fans attempting to
open `/dashboard` are redirected to `/discover`.  The new server middleware (#1658)
provides an earlier redirect for logged-out users.

Fans **cannot** open `/dashboard/earnings` (or any sub-route) — the redirect guard
applies to all paths matching `/dashboard/**`.

### 4. Creators can subscribe to other creators

A creator with `is_creator: true` can still navigate to `/discover`, browse creator
pages, and complete the subscribe flow.  The subscription code path (`/subscribe`,
`/checkout`, `/subscriptions`) carries no `is_creator` restriction.

### 5. Fan onboarding path (`/onboarding/fan`)

`/onboarding/fan` is the short "wallet → browse → subscribe" quickstart for fans.
It is intentionally separate from `/onboarding` (the full creator setup).  The two
paths must remain independent:

* `/onboarding` → intended for creators / "both" intents; sets `is_creator = true`
* `/onboarding/fan` → intended for fans; sets `is_creator = false`

Users who complete `/onboarding/fan` are sent to `/discover`.
Users who complete `/onboarding` with `creator` or `both` intent are sent to `/dashboard`.
Users who complete `/onboarding` with `fan` intent are sent to `/discover`.

---

## Alternatives considered

### A — Dual roles with a bitmask

Store `roles: string[]` or `role_flags: integer` so a user can be simultaneously
creator and fan without needing the `both` pseudo-intent.

**Rejected for now.** The `is_creator` boolean matches the current backend schema
and satisfies all known requirements.  Dual roles add significant API surface area and
frontend complexity.  The `both` intent maps cleanly to `is_creator: true` + fan
subscription permission without schema changes.  Re-evaluate if agency-managed
accounts or per-content role switching become requirements.

### B — Frontend-only role derived from wallet / onboarding localStorage

Derive the role entirely client-side without a `/users/me` call.

**Rejected.** A stale localStorage value could grant a fan access to creator routes.
The `fetchMe()` call in `RouteGuard` is the authoritative check.  Middleware (#1658)
adds a lightweight first-pass guard using the `authToken` cookie.

---

## Consequences

* Fans land on `/discover` immediately after onboarding — no redirect loop.
* Creators land on `/dashboard` immediately after onboarding.
* Fans who attempt to access `/dashboard/**` are still redirected by `RouteGuard`.
* The `both` intent is effectively an alias for `creator`; no extra nav or routing
  work is needed.
* Future work: if agency-managed accounts or per-organisation multi-role is required,
  revisit this ADR and consider a `roles[]` array in the backend schema.
