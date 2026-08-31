# Pending Page (`/pending`)

**Issue:** [#1660 Pending page: wire to real pending checkouts/txs or remove](https://github.com/MyFanss/MyFans/issues/1660)

## Auth required

The route is **auth-required**. The server middleware (`middleware.ts`) redirects
logged-out requests to `/auth/sign-in?returnUrl=/pending` before the page renders.

## Data source — local transaction store

Transactions are stored in `localStorage` under `myfans.transactions`
(`src/lib/transaction-history.ts`). This store is **seeded by the checkout flow**:
when `CheckoutFlow.tsx` receives a signed transaction hash it calls
`createTrackedTransaction(...)` and redirects to `/pending?checkoutId=<id>`.

`PendingStatusClient` polls this store every 3 seconds.

## No infinite demo spinner

For **real transactions** the checkout flow writes `status: 'confirmed'` or
`status: 'failed'` before redirecting. The page immediately shows the final state.

For **simulated/demo transactions** `pollTrackedTransaction()` advances status to
`'confirmed'` after `simulatedCompletionAt` passes (default 12 s). This only fires
for demo-seeded records and never affects production checkouts.

## Empty state

When no transactions exist in the store the page shows:

> "No tracked transactions yet. Complete a checkout to see live status and history here."

## CTA actions

| State       | Action                          |
|-------------|----------------------------------|
| `confirmed` | "Continue" → `/subscriptions`   |
| `failed`    | "Retry" → `/subscribe`          |
| `pending`   | "Please Wait…" (disabled)        |

## Future: server-side polling

If the backend exposes a `GET /subscriptions/checkout/:id` status endpoint, the
client can fall back to polling it when the local store has no matching record
(e.g. user opens `/pending?checkoutId=X` from a different device). The
`PendingStatus` component interface already maps cleanly to a server response.
