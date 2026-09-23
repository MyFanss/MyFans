## Summary

<!-- One or two sentences describing what this PR does and why. -->

## Changes

<!-- Bullet list of the key changes made. -->

-

## Auth Matrix

<!-- Required for any PR that adds or changes a mutating contract entrypoint. -->

- [ ] Every new/changed mutating entrypoint has a row in `contract/AUTH_MATRIX.md`
- [ ] Each row documents signer requirement, valid example, invalid example, and storage effect on deny
- [ ] Read-only/view methods are listed as explicit no-auth rows
- [ ] Admin vs creator vs fan authorization expectations are distinguished per entrypoint
- [ ] Each matrix row has a corresponding automated test in `contract/**/tests/auth_matrix.rs`
- [ ] `contract/REGRESSION_CHECKLIST.md` updated if a new auth-sensitive path was introduced
- [ ] Not applicable — no mutating contract entrypoints touched

## Test Plan

### Automated tests added or updated

<!-- Check all that apply and briefly describe what each covers. -->

- [ ] **Unit tests** (`backend/src/**/*.spec.ts`) — service/guard/decorator logic in isolation
- [ ] **Integration / e2e tests** (`backend/test/**/*.e2e-spec.ts`) — HTTP round-trips with mocked infrastructure
- [ ] **Frontend component tests** (`frontend/src/**/*.test.{ts,tsx}`) — React component behaviour
- [ ] **Frontend e2e tests** (`frontend/e2e/**/*.spec.ts`) — Playwright browser flows
- [ ] **Contract tests** (`contract/`) — Soroban/Rust unit tests via `cargo test`
- [ ] **Auth matrix tests** (`contract/**/tests/auth_matrix.rs`) — one test per `AUTH_MATRIX.md` row
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

## Contract changes (complete if `contract/` is touched)

<!-- Skip this section entirely if the PR does not touch contract/ source or Cargo files. -->

- [ ] **Storage key doc** — `contract/STORAGE_KEYS.md` is consistent with code (no new/changed/removed `DataKey` variant left undocumented).
- [ ] **Interface doc** — `contract/docs/interfaces/` updated for every changed public `fn` signature.
- [ ] **Test vectors** — `contract/test-vectors/contract-args.json` regenerated if arg types or order changed.
- [ ] **AUTH_MATRIX.md** — updated if auth requirements changed.
- [ ] **Upgrade notes** — `contract/docs/UPGRADE_NOTES.md` entry added if storage layout or key semantics changed.
- [ ] **`cargo audit`** — passes locally; any new ignored advisory has a justification comment in `audit.toml`.
- [ ] Full checklist: see [contract/REGRESSION_CHECKLIST.md](../contract/REGRESSION_CHECKLIST.md).

## Notes for reviewers

<!-- Anything that needs extra attention, known limitations, or follow-up work. -->
