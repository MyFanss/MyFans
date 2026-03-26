

# API Versioning Migration Guide

## What changed

All public endpoints are now served under `/v1/`. Unversioned paths issue a
`301 Moved Permanently` redirect to their `/v1/` counterpart so existing
clients continue to work without any immediate changes.

| Before | After | Behaviour |
|--------|-------|-----------|
| `GET /creators` | `GET /v1/creators` | 301 redirect |
| `GET /creators/:id` | `GET /v1/creators/:id` | 301 redirect |
| `POST /creators` | `POST /v1/creators` | 301 redirect |
| `PUT /creators/:id` | `PUT /v1/creators/:id` | 301 redirect |
| `DELETE /creators/:id` | `DELETE /v1/creators/:id` | 301 redirect |

> **Action required:** Update your client base URLs before the next major
> release when unversioned redirects will be removed.

---

## How it works

NestJS `VersioningType.URI` is enabled in `main.ts` with `defaultVersion: '1'`.
Each controller is decorated with `@Controller({ path: '...', version: '1' })`.

A lightweight `CreatorsRedirectController` (version-neutral) catches any
requests hitting the old unversioned paths and issues a `301` redirect.

```
GET /creators          → 301 → /v1/creators
GET /creators/abc-123  → 301 → /v1/creators/abc-123
```

---