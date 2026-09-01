# Gated content: teaser vs full access

The `/content/[id]` page is the gated media surface. What a viewer sees is
decided by the **backend**, never by client-side state.

## Data flow

1. `page.tsx` (server component) calls `getContentById(id)`
   (`src/lib/api/content.ts` → `GET /v1/content/:id`).
   - `null` (a `404` from the API) → `notFound()`.
2. The content payload carries the lock signal:
   - `locked === true` → gated (authoritative).
   - otherwise `isGated` is the fallback flag.
   - `hasAccess` (optional) — if the detail endpoint already evaluated
     access for this viewer, it is trusted and step 3 is skipped.
3. `client-content.tsx` resolves access via `getContentAccess(id)`
   (`GET /v1/content/:id/access`). This **replaces** the old mock, which was
   a `setTimeout` plus a `localStorage` subscription flag.
   - Fails **closed**: any `401` / `404` / `5xx` / network error →
     `{ hasAccess: false }`. A transient failure can never reveal gated
     media.

## What "locked" hides

`GatedContentViewer` only renders the real asset URL (`contentUrl`, i.e. the
IPFS gateway URL) in its **unlocked** branch. A locked viewer sees the
blurred thumbnail + lock overlay — the IPFS URL is never sent to the DOM.

Interactive controls follow the same gate:

- **Like / Share** — hidden while locked (`canInteract={isUnlocked}` on
  `GatedContentViewer`).
- **Comments** — the `ContentComments` section is only mounted when
  `isUnlocked`. A locked viewer sees no thread and no composer.

### Comments policy

Comments are part of the subscriber-only surface, not the teaser. Rationale:
comment threads routinely contain spoilers, creator replies, and
subscriber-only context, so exposing them on the public teaser would leak
the value of the gated content. They appear only after the server grants
access. This is covered by tests in
`src/app/content/[id]/unlock-flow.test.tsx`.

## Subscribing

The subscribe CTA routes to the real flow (`/subscribe/[creatorId]`). There
is no client-side "unlock" — access only changes once the backend says so
on the next `getContentAccess` call.

## Related

- `src/lib/api/content.ts` — `getContentById`, `getContentAccess` (fail-closed).
- `src/components/GatedContentViewer.tsx` — teaser/full rendering, `canInteract`.
- `src/app/content/[id]/client-content.tsx` — access resolution + gating.
