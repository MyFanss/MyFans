# Branch Protection Rules: Backend

To maintain the stability and security of the MyFans backend, the following branch protection rules must be applied to the `main` and `develop` branches in GitHub.

## 1. Protect Matching Branches
- **Branch name patterns**: `main`, `develop`

## 2. Pull Request Requirements
- [x] **Require a pull request before merging**
    - [x] **Require approvals**: `1` (Minimum)
    - [x] **Dismiss stale pull request approvals when new commits are pushed**
    - [x] **Require review from Code Owners**: This ensures that any changes to the `backend/` directory are approved by the `@MyFanss/backend` team.

## 3. Status Check Requirements
- [x] **Require status checks to pass before merging**
    - [x] **Require branches to be up to date before merging**
    - **Required Status Checks**:
        - `Backend (Node.js 20)`
        - `Backend (Node.js 22)`
        - `Backend DB Migrations (Postgres)`
        - `Postgres Backup / Restore Drill`
        - `ci/commitlint` (if applicable)

## 4. History & Commit Requirements
- [x] **Require linear history**: Prevent merge commits; use **Squash and merge** or **Rebase and merge**.
- [x] **Require signed commits**: All commits must be verified with a GPG or SSH key to ensure authenticity.

## 5. Other Restrictions
- [x] **Restrict pushes**: Only designated maintainers or automated bots should be allowed to push directly to protected branches.
- [x] **Include administrators**: All of the above rules apply to administrators as well.

---

## Configuration Template (GitHub CLI)

If you have the [GitHub CLI](https://cli.github.com/) installed, you can apply these rules using the following command (adjust repo name):

```bash
gh api -X PUT /repos/MyFans/MyFans/branches/main/protection \
  -H "Accept: application/vnd.github+json" \
  -f required_status_checks='{"strict":true,"contexts":["Backend (Node.js 20)","Backend (Node.js 22)","Backend DB Migrations (Postgres)","Postgres Backup / Restore Drill"]}' \
  -f enforce_admins=true \
  -f required_pull_request_reviews='{"dismiss_stale_reviews":true,"require_code_owner_reviews":true,"required_approving_review_count":1}' \
  -f restrictions=null \
  -f required_linear_history=true \
  -f required_signatures=true
```

## Maintenance
These rules should be reviewed quarterly to ensure they align with the team's evolving workflow and security posture.
