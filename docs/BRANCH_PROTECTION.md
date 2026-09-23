# Branch Protection

This document describes the required status checks and branch protection rules for the `main` branch.

## Required Status Checks

The following status checks MUST pass before a pull request can be merged into `main`. These names must match the `name:` fields of the jobs in `.github/workflows/` exactly, as GitHub rulesets reference them by name.

| Check name | Workflow | Purpose |
| --- | --- | --- |
| `contract-workspace-tests` | `.github/workflows/contract-regression.yml` | Runs `cargo test --workspace` for the contract workspace. Gates merge on workspace test failures. |
| `contract-audit` | `.github/workflows/contract-regression.yml` | Runs `cargo audit` against the contract workspace. Fails on high/critical advisories unless explicitly ignored with a documented reason. |

### `contract-workspace-tests`

- Runs `cargo test --workspace` in the contract workspace.
- Must pass for any change that touches `contract/`.
- Flaky RPC-dependent tests must be marked `#[ignore]` with a reason rather than retried silently.

### `contract-audit`

- Runs `cargo audit` using `audit.toml` and `.auditignore`.
- Fails on `high` and `critical` advisories by default.
- An advisory may be ignored only when it is listed in `.auditignore` (or `audit.toml`) with a documented reason and a tracking issue link.
- Critical advisories MUST NOT be ignored without an issue link.

## Configuring GitHub Rulesets

When creating or updating a ruleset for `main`, add the two check names above verbatim under **Require status checks to pass**. Do not rename the jobs in the workflow without updating this document and the ruleset in the same change.

## Verifying Required Checks

Use the GitHub API to confirm the required checks configured on the branch match this document:

```sh
gh api repos/:owner/:repo/branches/main/protection \
  --jq '.required_status_checks.contexts'
```

The output must contain `contract-workspace-tests` and `contract-audit`.

## References

- `contract/CI_CONTRACT_REGRESSION_TESTING.md`
- `contract/REGRESSION_CHECKLIST.md`
- `.github/workflows/contract-regression.yml`
- `audit.toml`, `.auditignore`
