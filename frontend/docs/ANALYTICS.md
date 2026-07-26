# Frontend analytics

Consent-gated telemetry for MyFans. Events are **never** sent unless the user
has accepted telemetry (`localStorage.telemetry_consent === "true"`), managed
via the consent banner and Settings → Account.

## Adapter

`src/lib/analytics.ts` exposes:

| Export | Purpose |
|--------|---------|
| `analytics.trackEvent` / `identifyUser` | Public API used by the app |
| `noopProvider` | Discard events |
| `consoleProvider` | `console.debug` only (local inspection) |
| `realProvider` | PostHog (`window.posthog`) or HTTP endpoint |
| `setAnalyticsProvider` | Test / runtime override |

## Choosing a provider

Set `NEXT_PUBLIC_ANALYTICS_PROVIDER` to one of:

| Value | Behavior |
|-------|----------|
| `noop` | No-op (default in **production** when unset) |
| `console` | Console debug (default in **development** when unset) |
| `real` | Real provider (see below) |

### Real provider configuration

When `NEXT_PUBLIC_ANALYTICS_PROVIDER=real`:

1. If `window.posthog` is available (e.g. PostHog snippet loaded), events go there.
2. Else if `NEXT_PUBLIC_ANALYTICS_ENDPOINT` is set, events are `POST`ed as JSON:
   `{ type, event|userId, properties|traits, ts }`.
3. Else in non-production, falls back to the console provider.

## Consent rules

- Missing or `"false"` consent → no provider calls (blocked in dev with a debug log).
- `"true"` consent → event forwarded to the active provider.
- Analytics failures must not break UI (network errors are swallowed).

## Example

```ts
import { analytics } from '@/lib/analytics';

analytics.trackEvent('plan_created', { planId: 'abc' });
analytics.identifyUser(userId, { role: 'creator' });
```
