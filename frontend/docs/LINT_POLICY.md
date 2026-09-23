# Frontend Lint Warning Policy

This document describes how ESLint warnings are treated in the MyFans frontend
CI pipeline and what to do when the linter emits a warning.

---

## Policy: zero warnings in CI

The `frontend-lint-test` CI job runs ESLint with:

```bash
npm run lint -- --max-warnings 0
```

This means **any ESLint warning causes CI to fail**, not just errors. The
rationale is that a warning today is a silent error tomorrow — allowing
warnings to accumulate makes the codebase progressively harder to maintain and
masks real problems.

`continue-on-error` is **not** set on the lint step. Lint failures block merge.

---

## What counts as a warning vs. an error

ESLint rule severity is configured in `frontend/eslint.config.mjs`. The
general guideline:

| Severity | Use for |
|---|---|
| `error` (2) | Must-fix: type safety, security, accessibility (a11y), broken imports |
| `warn` (1) | Should-fix: code style, unused variables, deprecated APIs |
| `off` (0) | Intentionally disabled with a comment explaining why |

Because CI enforces zero warnings, **`warn`** rules carry the same merge-blocking
weight as `error` rules in practice. This is intentional — it keeps the
codebase clean without requiring a noisy mass-conversion of all warns to errors.

---

## What to do when you get a lint failure in CI

### Option A — Fix the issue (preferred)

Most lint warnings are straightforward to fix (remove an unused import, add
an `alt` attribute, etc.). Fix it before merging.

### Option B — Disable for a specific line

If a lint rule must be suppressed for a legitimate reason, disable it inline
with a comment explaining why:

```ts
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- third-party SDK returns untyped response
const result: any = await sdk.call();
```

**Never** use `/* eslint-disable */` (whole-file disable) without a follow-up
issue to fix the root cause.

### Option C — Change the rule severity

If a rule is consistently producing false positives for this codebase, open a
PR to change its severity in `eslint.config.mjs` and explain the decision in
the PR description.

---

## Vitest unit tests

The CI job also runs:

```bash
npm test   # → vitest run
```

`vitest run` exits non-zero on any failing test. `continue-on-error` is not
set. Failed tests block merge.

---

## CI job summary

The `frontend-lint-test` job runs three steps in order:

1. **ESLint** (`npm run lint -- --max-warnings 0`) — zero warnings allowed
2. **Vitest** (`npm test`) — all tests must pass
3. **Next.js build** (`npm run build`) — production build must succeed

All three steps must pass for the job to be green. A failure in any step
blocks merge.

---

## Related

- `.github/workflows/ci.yml` — CI workflow definition
- `frontend/eslint.config.mjs` — ESLint rule configuration
- `frontend/vitest.config.ts` — Vitest configuration
