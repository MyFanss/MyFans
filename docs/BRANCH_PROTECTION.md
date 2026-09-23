# Branch Protection — Required Checks

This document is the **single source of truth** for the GitHub required-status-checks
configuration on `main` and `develop`.

Whenever a job is renamed or added in `.github/workflows/ci.yml`, **this file must be
updated in the same PR**.  Stale check names cause one of two failure modes:

- GitHub blocks the PR permanently because a check it expects never runs.
- GitHub lets the PR merge even though relevant CI is red (the old name never updated).

---

## Workflow files and their job names

### `.github/workflows/ci.yml`

| `name:` in YAML (= check context string in GitHub) | Triggers on |
|-----------------------------------------------------|-------------|
| `commitlint`                                        | push / PR   |
| `Backend (Node.js 20)`                              | push / PR   |
| `Backend (Node.js 22)`                              | push / PR   |
| `Backend DB Migrations (Postgres)`                  | push / PR   |
| `Postgres Backup / Restore Drill`                   | push / PR   |
| `Frontend`                                          | push / PR   |
| `Contract`                                          | push / PR   |

### `.github/workflows/futurenet-smoke.yml`

| `name:` in YAML | Triggers on |
|-----------------|-------------|
| `Check contract IDs and secrets` | schedule / push main / dispatch |
| `Smoke – invoke contract getters on Futurenet` | (only when IDs present) |

> Futurenet smoke jobs are **not** required checks for PRs — they run on a schedule
> and on push to `main` only.  Do not add them to the branch-protection list.

---

## Required checks — `main` and `develop`

Add **exactly** these strings to
`Settings → Branches → Branch protection rules → Require status checks to pass → Search for status checks`:

```
commitlint
Backend (Node.js 20)
Backend (Node.js 22)
Backend DB Migrations (Postgres)
Postgres Backup / Restore Drill
Frontend
Contract
```

All checks are provided by the workflow in `.github/workflows/ci.yml`.  The name
must match exactly (case-sensitive, spaces included).

---

## GitHub UI checklist (admin)

1. Go to **Settings → Branches** in the MyFanss/MyFans repository.
2. Click **Edit** on the `main` rule (or create one if absent).
3. Check ✅ **Require status checks to pass before merging**.
4. Check ✅ **Require branches to be up to date before merging**.
5. In the search box, add each check name from the table above — one at a time.
6. Repeat steps 2–5 for the `develop` rule.
7. Check ✅ **Require a pull request before merging** with at least **1 approval**.
8. Check ✅ **Dismiss stale pull request approvals when new commits are pushed**.
9. Check ✅ **Require review from Code Owners** (see `.github/CODEOWNERS`).
10. Check ✅ **Require linear history** (squash or rebase merges only).
11. Check ✅ **Include administrators**.
12. Save.

### GitHub CLI equivalent (for automation)

```bash
gh api -X PUT /repos/MyFanss/MyFans/branches/main/protection \
  -H "Accept: application/vnd.github+json" \
  --input - <<'EOF'
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "commitlint",
      "Backend (Node.js 20)",
      "Backend (Node.js 22)",
      "Backend DB Migrations (Postgres)",
      "Postgres Backup / Restore Drill",
      "Frontend",
      "Contract"
    ]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": true,
    "required_approving_review_count": 1
  },
  "restrictions": null,
  "required_linear_history": true
}
EOF
```

---

## Admins / maintainers

| GitHub username | Role |
|-----------------|------|
| @Emmanuel5vohd  | Owner / maintainer |

Admins are also subject to branch-protection rules (`enforce_admins: true`).

---

## Adding a new required check

1. Add the job to `.github/workflows/ci.yml` with a stable `name:`.
2. Update the table and the `contexts` list in this file.
3. Add the check name in GitHub branch settings (or re-run the CLI command).
4. Update `backend/docs/BRANCH_PROTECTION.md` if it covers the same check.

## Removing / renaming a check

1. Remove / rename the job in `.github/workflows/ci.yml`.
2. **Remove the old name** from GitHub branch settings immediately — GitHub does
   not auto-clean stale check entries.
3. Add the new name (if renaming).
4. Update this file.

---

## commitlint

`commitlint` enforces [Conventional Commits](https://www.conventionalcommits.org/).
The check runs on every PR and push.  Commit messages must follow the pattern:

```
type(scope): subject

# type: feat | fix | docs | style | refactor | test | chore | ci | build | revert
# scope: optional, e.g. frontend | backend | contract | ci
```

Configuration lives in the root `commitlint.config.*` (or `package.json`
`commitlint` key) if present; otherwise `@commitlint/config-conventional` defaults apply.

---

## End-to-end checks (future)

When Playwright e2e tests are added to CI, add the new job name here **and** to GitHub
settings in the same PR.  Suggested name: `E2E (Playwright)`.

---

## Maintenance

Review this document quarterly and after any workflow rename.  Last reviewed: **2026-08-31**.
