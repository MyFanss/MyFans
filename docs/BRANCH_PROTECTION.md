# Branch Protection & Required Checks

Canonical list of required status checks for `main` and `release/**`
(Issue #1847). Branch protection that names a check no job produces is
theater: the PR waits forever, and someone eventually deletes the rule to
unblock it. So the names below are **verified by CI**, not just documented.

## How check names work

A GitHub Actions job reports a status check whose name is the job's `name:`
value — exactly, including case, spaces, the em dash (`—`) and any
parentheses. It is **not** the job id and **not** `Workflow / job`.

The source of truth is [`.github/required-checks.json`](../.github/required-checks.json).
[`scripts/ci/verify-required-checks.mjs`](../scripts/ci/verify-required-checks.mjs)
runs in the `Repo — required checks alignment` job on every PR and fails when:

- a required job is missing from its workflow, or its `name:` differs from the listed name
- a workflow is structurally broken (no top-level `name:`, `on:` or `jobs:`)
- the workflow doesn't run on `pull_request` for the protected branch, or has a `paths` / `paths-ignore` filter, so the check might never report
- a required job uses `continue-on-error` or a job-level `if:` (a skipped job counts as passing, so it could pass silently)
- two jobs anywhere report the same name (the context would be ambiguous)
- a required name is missing from this document

## Required checks — `main`

| Check name (exact) | Workflow | Job id | Gates |
| --- | --- | --- | --- |
| `Repo — required checks alignment` | `.github/workflows/ci.yml` | `required-checks-alignment` | This list, the workflows, and this doc stay in sync; CI script unit tests |
| `Frontend — eslint` | `.github/workflows/ci.yml` | `frontend-eslint` | `npm run lint` in `frontend/` — zero ESLint errors |
| `Frontend — vitest` | `.github/workflows/ci.yml` | `frontend-vitest` | `npm test` (`vitest run`) in `frontend/` |
| `Frontend — storybook build` | `.github/workflows/ci.yml` | `storybook-build` | `npm run build-storybook`, so broken stories fail the PR (Issue #1842) |
| `npm audit — backend (high)` | `.github/workflows/security-audit.yml` | `npm-audit-backend` | No unignored high/critical advisory in backend production deps |
| `npm audit — frontend (high)` | `.github/workflows/security-audit.yml` | `npm-audit-frontend` | No unignored high/critical advisory in frontend production deps |
| `cargo audit — contract` | `.github/workflows/security-audit.yml` | `cargo-audit` | No unignored RustSec vulnerability in `contract/Cargo.lock` |

## Required checks — `release/**`

Everything on `main` except the alignment job, plus the fail-closed smoke gate:

| Check name (exact) | Workflow | Job id | Gates |
| --- | --- | --- | --- |
| `Frontend — eslint` | `.github/workflows/ci.yml` | `frontend-eslint` | as above |
| `Frontend — vitest` | `.github/workflows/ci.yml` | `frontend-vitest` | as above |
| `Frontend — storybook build` | `.github/workflows/ci.yml` | `storybook-build` | as above |
| `npm audit — backend (high)` | `.github/workflows/security-audit.yml` | `npm-audit-backend` | as above |
| `npm audit — frontend (high)` | `.github/workflows/security-audit.yml` | `npm-audit-frontend` | as above |
| `cargo audit — contract` | `.github/workflows/security-audit.yml` | `cargo-audit` | as above |
| `Futurenet smoke — contract ID gate` | `.github/workflows/futurenet-smoke.yml` | `gate` | Every contract ID is present and valid in release context (Issue #1848) |

`Futurenet smoke — invoke contract getters` is **not** required: it only runs
when the gate says IDs are valid, and a skipped job would report as passing.
The gate job is what fails closed.

## Not yet required

These jobs run in CI but fail today for reasons that predate #1847. They
stay out of the required set until they're green; making them required now
would block every PR. Promote a job by adding it to
`.github/required-checks.json` and the tables above in the same PR that
fixes it.

| Check name | Why it isn't required yet |
| --- | --- |
| `Backend — unit tests` | `npm run lint:check` / `openapi:check` scripts don't exist; `backend/` has both `jest.config.js` and a `jest` key in `package.json`; `src/` imports packages that aren't declared (`typeorm`, `@nestjs/throttler`, `@nestjs/swagger`, …) |
| `Backend — e2e tests (Postgres)` | Same backend dependency gaps; depends on `Backend — unit tests` |
| `Security — hardening + csrf e2e` | Same backend dependency gaps; the default jest `rootDir` is `src`, so `test/*.e2e-spec.ts` isn't matched |
| `Frontend — Freighter test vectors` | `frontend/package.json` has no `test:vectors` script |
| `Frontend — demo routes gate` | `check-demo-routes.mjs` needs a `.next/` build, and the job doesn't run `next build` |
| `Staging — parity check` | `frontend/scripts/check-staging-parity.mjs` doesn't exist |
| `Contract — tests + wasm build` | `contract/Cargo.toml` lists 12 workspace members but only `myfans-token`, `subscription` and `treasury` exist, so the workspace doesn't load |
| `Contract — ABI snapshot drift` | Needs the workspace to build and the `stellar` CLI installed |
| `Contract — interface docs drift` | `subscription.md`, `treasury-contracts.md` and `treasury-src.md` have drifted from the source |

## Audit exceptions (`.auditignore`)

Audits gate merges, so noise can't be handled with `continue-on-error`. Each
package has an `.auditignore` (`backend/`, `frontend/`, `contract/`) read by
`scripts/ci/npm-audit-gate.mjs` / `scripts/ci/cargo-audit-gate.mjs`:

```
<ADVISORY-ID>: <reason> <tracking issue URL> [expires YYYY-MM-DD]
```

- `ADVISORY-ID` is the GHSA id (npm, preferred), `NPM-<id>`, or `RUSTSEC-YYYY-NNNN`.
- A GitHub issue URL is **required**. Entries without one, duplicates, and expired entries fail the gate.
- Exceptions that npm / cargo audit no longer report are flagged, so you know to delete them.
- `npm audit` covers production dependencies (`--omit=dev`) at high and critical severity.
- `cargo audit` blocks every RustSec *vulnerability*, because many carry no CVSS score. Unmaintained, unsound and yanked warnings are annotated but don't gate.
- If the audit tool itself errors (corrupt lockfile, advisory DB unreachable), the gate fails. It never passes silently.

Run locally:

```bash
(cd frontend && node ../scripts/ci/npm-audit-gate.mjs --audit-level=high --omit=dev)
(cd backend  && node ../scripts/ci/npm-audit-gate.mjs --audit-level=high --omit=dev)
(cd contract && node ../scripts/ci/cargo-audit-gate.mjs)   # needs: cargo install cargo-audit
```

## Applying the rules on GitHub

Use a repository ruleset per target (Settings → Rules → Rulesets), or the API.
Checks only show up in the picker after they've run once on a PR.

```bash
# main — contexts must match the table above exactly
gh api -X POST repos/MyFanss/MyFans/rulesets --input - <<'EOF'
{
  "name": "main required checks",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["refs/heads/main"], "exclude": [] } },
  "rules": [
    { "type": "pull_request", "parameters": {
        "required_approving_review_count": 1, "dismiss_stale_reviews_on_push": true,
        "require_code_owner_review": true, "require_last_push_approval": false,
        "required_review_thread_resolution": false } },
    { "type": "required_status_checks", "parameters": {
        "strict_required_status_checks_policy": true,
        "required_status_checks": [
          { "context": "Repo — required checks alignment" },
          { "context": "Frontend — eslint" },
          { "context": "Frontend — vitest" },
          { "context": "Frontend — storybook build" },
          { "context": "npm audit — backend (high)" },
          { "context": "npm audit — frontend (high)" },
          { "context": "cargo audit — contract" }
        ] } }
  ]
}
EOF
```

For `release/**`, use `"include": ["refs/heads/release/**"]` and the release
table's contexts.

## Verifying the live rules

```bash
node scripts/ci/verify-required-checks.mjs                  # local: config ↔ workflows ↔ this doc
node scripts/ci/verify-required-checks.mjs --remote         # also compare with GitHub (uses `gh`)
node scripts/ci/verify-required-checks.mjs --remote --repo=MyFanss/MyFans
```

`--remote` reads `repos/{repo}/rules/branches/{branch}` (rulesets) and, for
`main`, classic branch protection. It reports contexts that are configured
here but not enforced on GitHub, and contexts GitHub requires that no longer
exist here. Run it after changing rulesets and before a release.

## Renaming or adding a required check

1. Change the job's `name:` in the workflow.
2. Update `.github/required-checks.json` and the tables in this document in the same PR.
3. After merge, update the ruleset on GitHub. Until you do, the old name stays pending on every PR.
4. Run `node scripts/ci/verify-required-checks.mjs --remote` to confirm.

## Security rules for required jobs

- No `continue-on-error` on a required job or any of its steps.
- No job-level `if:` on a required job. Put the policy decision inside a step that exits non-zero.
- No `paths` / `paths-ignore` on workflows that contain required jobs.
- Secrets are never echoed. The contract-ID gate prints key names and statuses only, and smoke logs are redacted before they're uploaded as artifacts.

Package-specific notes: [`backend/docs/BRANCH_PROTECTION.md`](../backend/docs/BRANCH_PROTECTION.md),
[`contract/docs/BRANCH_PROTECTION.md`](../contract/docs/BRANCH_PROTECTION.md).
