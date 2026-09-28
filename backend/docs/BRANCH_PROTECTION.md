# Branch Protection Rules: Backend

> **See also**: The canonical branch-protection document for the whole repo (all
> required-check names, admin checklist, GitHub CLI command) is at
> [`docs/BRANCH_PROTECTION.md`](../../docs/BRANCH_PROTECTION.md).  This file
> focuses on backend-specific notes.

---

To maintain the stability and security of the MyFans backend, the following branch
protection rules must be applied to the `main` and `develop` branches in GitHub.

## 1. Protect Matching Branches
- **Branch name patterns**: `main`, `develop`

## 2. Pull Request Requirements
- [x] **Require a pull request before merging**
    - [x] **Require approvals**: `1` (Minimum)
    - [x] **Dismiss stale pull request approvals when new commits are pushed**
    - [x] **Require review from Code Owners**: Changes under `backend/` are reviewed
      by the `@MyFanss/backend` team (see `.github/CODEOWNERS`).

## 3. Status Check Requirements

Required check names are maintained in **one place**:
[`.github/required-checks.json`](../../.github/required-checks.json), mirrored in
[`docs/BRANCH_PROTECTION.md`](../../docs/BRANCH_PROTECTION.md) and verified in CI by
`scripts/ci/verify-required-checks.mjs`. Don't copy the list here; it drifts.

Backend-relevant required checks today:

- `npm audit — backend (high)`: high/critical advisories in production
  dependencies fail the PR. Exceptions go in `backend/.auditignore` and need a
  tracking issue link.

The backend test jobs (`Backend — unit tests`, `Backend — e2e tests (Postgres)`,
`Security — hardening + csrf e2e`) run on every PR but are **not yet required**
because they currently fail for pre-existing reasons. See "Not yet required" in
the canonical doc for why. Promote them once they're green.

### Security — hardening + csrf e2e

The `Security — hardening + csrf e2e` check runs on every `pull_request`
(including forks) and executes the hardening suites against a real Postgres
service container:

- `backend/test/security-hardening.e2e-spec.ts`
- `backend/test/csrf.e2e-spec.ts`

Once green, mark it **required** so hardening regressions can't merge. Don't
skip this job on fork PRs without an explicit, documented maintainer decision.
If it's skipped, a required check stays pending and the PR can't merge.

#### Flake triage

- Suites are order-dependent: run them in the order listed above and keep the
  Postgres service healthy (readiness probe) before starting the suite.
- On a suspected flake, re-run the job once and capture the failing spec name in
  the PR before retrying; repeated failures are treated as real regressions.

#### Local parity

Run the same suites locally against a Postgres instance to reproduce CI:

```bash
cd backend
DATABASE_URL=postgres://postgres:postgres@localhost:5432/myfans_test \
  npm run test:e2e -- security-hardening.e2e-spec.ts csrf.e2e-spec.ts
```

## 4. History & Commit Requirements
- [x] **Require linear history**: Use **Squash and merge** or **Rebase and merge**.
- [x] **Require signed commits**: All commits must be verified with a GPG or SSH key.

## 5. Other Restrictions
- [x] **Restrict pushes**: Only designated maintainers or automated bots should push
  directly to protected branches.
- [x] **Include administrators**: All of the above rules apply to administrators as well.

---

## GitHub CLI

The ruleset commands live in [`docs/BRANCH_PROTECTION.md`](../../docs/BRANCH_PROTECTION.md#applying-the-rules-on-github).
To check that the live rules match the repo:

```bash
node scripts/ci/verify-required-checks.mjs --remote
```

## Maintenance
Review quarterly; `node scripts/ci/verify-required-checks.mjs --remote` does the
cross-check. Last reviewed: **2026-09-27**.
