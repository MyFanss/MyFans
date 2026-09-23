# Demo / component-story routes

A handful of pages exist only to exercise components in isolation:

| Route                | Purpose                                            |
| -------------------- | ------------------------------------------------- |
| `/wallet-demo`       | Wallet connection modal walkthrough              |
| `/error-test`        | Trips the error boundary on demand               |
| `/ui`                | Form inputs, badges, status indicators showcase  |
| `/subscribe-example` | Feature-flag gating example                      |
| `/settings-demo`     | Settings shell + social links form               |

These are **not** part of the product. They leak internal components, confuse
SEO, and widen the attack surface (`/error-test` throws on purpose), so they
must never be reachable in a production deployment.

> `/pending` is **not** a demo. It is the real pending-transaction status page
> (`PendingStatusClient`, backed by `lib/transaction-history`) that
> `/checkout/[id]` redirects to after a checkout, so it ships in production.

## How gating works

Each demo page is a file named `page.demo.tsx` (not `page.tsx`).

`next.config.ts` only registers the `demo.tsx` page extension when demos are
enabled:

```
demos enabled  =  NODE_ENV !== 'production'
              OR  NEXT_PUBLIC_FLAG_DEMOS === 'true'
```

- **Local dev / `next dev`** — enabled. Routes work normally.
- **Preview / staging** — set `NEXT_PUBLIC_FLAG_DEMOS=true` in the environment
  to build them into that deployment.
- **Production** — disabled. The `demo.tsx` files are not treated as routes,
  are not compiled, and the paths return the standard 404 page.

Two extra layers back this up:

1. `middleware.ts` sends `X-Robots-Tag: noindex, nofollow` for demo paths
   whenever they are enabled, and rewrites them to the 404 page when they are
   not.
2. `src/app/wallet-demo/page.demo.tsx` calls `notFound()` via
   `demoRoutesEnabled()` from `src/lib/demo-routes.ts`.

## CI check

`npm run check:demo-routes` (`scripts/check-demo-routes.mjs`) runs after
`next build` in CI and fails if any demo route made it into `.next/` — compiled
segment, route manifest, or static HTML. It no-ops when demos are enabled.

## Adding a new demo page

1. Create `src/app/<route>/page.demo.tsx`.
2. Add `<route>` to `DEMO_ROUTES` in `src/lib/demo-routes.ts` **and** in
   `scripts/check-demo-routes.mjs`.
3. Add a row to the table above.

## Out of scope

Storybook hosting — these routes are the lightweight substitute for now.
