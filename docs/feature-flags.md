# Frontend Feature Flags

Frontend feature flags in `frontend/` are resolved at runtime and fail closed by default. If a flag is missing, the remote endpoint is unavailable, or a value is invalid, the feature stays off.

## Architecture

- Central flag registry: `frontend/src/lib/feature-flags.ts`
- Client provider: `frontend/src/contexts/FeatureFlagsContext.tsx`
- Hook: `frontend/src/hooks/useFeatureFlag.ts`
- Gate component: `frontend/src/components/FeatureGate.tsx`

Resolution order for each flag:

1. Remote JSON from `NEXT_PUBLIC_FEATURE_FLAGS_URL`
2. Environment variable `NEXT_PUBLIC_FLAG_<FLAG_NAME>`
3. `localStorage` override `flags:<flag-name>` when local overrides are allowed
4. Default `false`

## Current Flags

| Flag key | Purpose | Default |
| --- | --- | --- |
| `bookmarks` | Shows bookmark controls on creator discovery and subscribe flows | `false` |
| `earnings_withdrawals` | Enables the earnings withdrawal panel | `false` |
| `earnings_fee_transparency` | Enables the fee transparency card on the earnings page | `false` |

## Remote JSON Format

Point `NEXT_PUBLIC_FEATURE_FLAGS_URL` at a JSON document with either shape:

```json
{
  "bookmarks": true,
  "earnings_withdrawals": false,
  "earnings_fee_transparency": true
}
```

or:

```json
{
  "flags": {
    "bookmarks": true,
    "earnings_withdrawals": false,
    "earnings_fee_transparency": true
  }
}
```

Supported values are booleans and boolean-like strings such as `"true"` and `"false"`.

## Adding A New Flag

1. Add the flag key to `FeatureFlag` in `frontend/src/lib/feature-flags.ts`.
2. Add its `description`, `envKey`, and default `false` entry in the same file.
3. Add the new key to the remote JSON document when you want it managed remotely.
4. Use the flag in UI code with `useFeatureFlag(flag)` or `<FeatureGate flag={flag}>...</FeatureGate>`.
5. Document the flag in the table above.

No other registry file is needed. The central definition in `frontend/src/lib/feature-flags.ts` drives the snapshot returned to the app.

## Local Development Overrides

In local development, set a browser override from the console:

```js
localStorage.setItem('flags:bookmarks', 'true');
window.dispatchEvent(new Event('feature-flags:updated'));
```

To remove it:

```js
localStorage.removeItem('flags:bookmarks');
window.dispatchEvent(new Event('feature-flags:updated'));
```

Environment-variable overrides also work:

```bash
NEXT_PUBLIC_FLAG_BOOKMARKS=true npm run dev
```

## QA And Staging Overrides

Production builds ignore `localStorage` overrides unless you explicitly allow them. For QA or staging, set:

```bash
NEXT_PUBLIC_FEATURE_FLAG_OVERRIDES=true
```

After that, the same `localStorage` keys can be used without rebuilding the app, as long as the running environment already has that variable enabled.

## Why Fail Closed

Feature flags are a rollout control, not a critical dependency. Defaulting to `false` prevents incomplete or unstable UI from appearing when:

- the remote endpoint is down
- a flag is missing from the payload
- the payload contains an invalid value
- client-side overrides are unavailable

That keeps the frontend stable even when flag infrastructure is not.
