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

The required check names below are the **exact `name:` values** from
`.github/workflows/ci.yml`.  They are case-sensitive.

- [x] **Require status checks to pass before merging**
    - [x] **Require branches to be up to date before merging**
    - **Required Status Checks** (backend-relevant subset):
        - `commitlint`
        - `Backend (Node.js 20)`
        - `Backend (Node.js 22)`
        - `Backend DB Migrations (Postgres)`
        - `Postgres Backup / Restore Drill`

> `Frontend` and `Contract` checks are also required on `main`/`develop`.
> See the full list in [`docs/BRANCH_PROTECTION.md`](../../docs/BRANCH_PROTECTION.md).

## 4. History & Commit Requirements
- [x] **Require linear history**: Use **Squash and merge** or **Rebase and merge**.
- [x] **Require signed commits**: All commits must be verified with a GPG or SSH key.

## 5. Other Restrictions
- [x] **Restrict pushes**: Only designated maintainers or automated bots should push
  directly to protected branches.
- [x] **Include administrators**: All of the above rules apply to administrators as well.

---

## GitHub CLI (backend checks only)

To apply or refresh the backend required checks (full set in root docs):

```bash
# Full command in docs/BRANCH_PROTECTION.md — this is the backend-relevant excerpt.
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

## Maintenance
Review quarterly; cross-check with `.github/workflows/ci.yml` job names.  Last
reviewed: **2026-08-31**.
