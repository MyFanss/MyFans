# Playwright Flake Triage

This repo already encodes its baseline retry and timeout behavior in [`frontend/playwright.config.ts`](../playwright.config.ts):

- `npm run test:e2e` runs `playwright test`
- tests live under `frontend/e2e`
- retries are `2` in CI and `0` locally
- traces are captured on the first retry
- CI runs with a single worker
- local runs reuse an existing app at `http://localhost:3000` when available

Use this guide when a UI test fails intermittently instead of failing deterministically.

## Start With The Failure Mode

### Timeout symptoms

Typical timeout failures in this repo usually mean one of these:

1. The Next.js app never became healthy at `http://localhost:3000`
2. A page transition or async UI state did not settle before the assertion ran
3. A test depends on network state, wallet state, or cached browser state that was not reset
4. The test passed on retry because trace collection slowed the flow enough to hide a race

### Retry-only passes

If a test fails once and passes on retry, do not treat that as healthy. In this config, retry success is a flake signal, not proof that the test is stable.

## Likely Causes In This Repository

- Shared state leakage across tests in `frontend/e2e`
- Assertions that fire before skeleton loaders, pending states, or hydration complete
- Environment-sensitive behavior behind `CI`, local dev server reuse, or API availability
- Responsive or animation-driven timing differences
- Tests that depend on wallet or transaction UI settling in a specific order

## Debugging Steps

1. Re-run the single spec first.

```bash
cd frontend
npm run test:e2e -- e2e/subscribe-flow-complete.spec.ts
```

2. Re-run the single test file multiple times to check whether the failure is actually flaky.

```bash
cd frontend
npx playwright test e2e/subscribe-flow-complete.spec.ts --repeat-each=5
```

3. Reproduce under CI-like constraints when the problem looks concurrency-related.

```bash
cd frontend
CI=1 npx playwright test e2e/subscribe-flow-complete.spec.ts --workers=1
```

4. Inspect the HTML report and retry trace after a failure.

```bash
cd frontend
npx playwright show-report
```

5. If the failure looks startup-related, verify the app boots cleanly with the same command Playwright uses.

```bash
cd frontend
npm run dev
```

## What To Look For In The Trace

- A selector check running before the page finishes rendering
- A click happening while the target is covered, disabled, or still animating
- A redirect or route transition that never completes
- A request or UI state that only appears on retry
- Differences between first-run and retry screenshots around loading, wallet, or transaction states

## Triage Rules

- If the first failure and retry failure match exactly, treat it as a real regression first, not a flake
- If only CI fails, compare worker count, retry behavior, and startup timing before touching assertions
- If only local runs fail, check for stale dev servers, browser storage, and leftover report artifacts
- If a fix only works by adding a large timeout, assume the underlying race still exists

## Manual Verification Checklist

- Run the affected spec directly with `npm run test:e2e -- <spec>`
- Re-run the same spec at least 5 times with `--repeat-each=5`
- Confirm whether the failure reproduces with `CI=1` and `--workers=1`
- Open the Playwright HTML report and inspect the retry trace
- Verify the frontend starts cleanly on `http://localhost:3000`
- Record whether the issue was a startup problem, race condition, shared state leak, or real product regression
