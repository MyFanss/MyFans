## Summary

<!-- One or two sentences describing what this PR does and why. -->

## Changes

<!-- Bullet list of the key changes made. -->

-

## Test Plan

### Automated tests added or updated

<!-- Check all that apply and briefly describe what each covers. -->

- [ ] **Unit tests** (`backend/src/**/*.spec.ts`) — service/guard/decorator logic in isolation
- [ ] **Integration / e2e tests** (`backend/test/**/*.e2e-spec.ts`) — HTTP round-trips with mocked infrastructure
- [ ] **Frontend component tests** (`frontend/src/**/*.test.{ts,tsx}`) — React component behaviour
- [ ] **Frontend e2e tests** (`frontend/e2e/**/*.spec.ts`) — Playwright browser flows
- [ ] **Contract tests** (`contract/`) — Soroban/Rust unit tests via `cargo test`
- [ ] No new tests required — explain why: ___

### How to run the tests locally

```bash
# Backend unit tests
cd backend && npm test

# Backend e2e tests (requires no live DB — uses in-memory mocks)
cd backend && npm run test:e2e

# Frontend component tests
cd frontend && npx vitest run

# Frontend e2e tests (requires dev server on :3000 and API on :3001)
cd frontend && npx playwright test

# Contract tests
cd contract && cargo test
```

### Manual verification checklist

<!-- Tick each item you verified by hand before requesting review. -->

- [ ] Happy path works end-to-end in a local environment
- [ ] Error / edge cases handled gracefully (stale state, invalid input, disconnected wallet)
- [ ] No regressions in closely related API or UI flows
- [ ] Rate-limiting, auth guards, and feature flags behave as expected where touched
- [ ] Linting passes: `cd backend && npm run lint` / `cd frontend && npm run lint`

## Related issues

<!-- Closes #NNN -->

## Notes for reviewers

<!-- Anything that needs extra attention, known limitations, or follow-up work. -->
