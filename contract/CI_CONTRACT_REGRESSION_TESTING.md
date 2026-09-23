# CI Contract Regression Testing

This document defines the **required regression CI** for the contract workspace and the
**exact status check names** that GitHub rulesets must require before a PR can merge to
`main`. It is the source of truth referenced by `docs/BRANCH_PROTECTION.md`.

## Required workflow

The regression workflow lives at `.github/workflows/contract-regression.yml` and runs on
pull requests and pushes to `main` that touch the contract workspace.

It has two jobs:

| Job name (status check) | Command | Purpose |
| --- | --- | --- |
| `contract-workspace-tests` | `cargo test --workspace` | Gate merge on the full contract workspace test suite. |
| `contract-audit` | `cargo audit` | Fail on high/critical advisories unless explicitly ignored with a reason. |

These names are stable and are the ones to configure as **required status checks** in the
GitHub branch protection / ruleset for `main`.

## Workspace tests

- Runs `cargo test --workspace` from the contract workspace root.
- Must be RPC-less and deterministic; tests that require a live RPC endpoint are out of
  scope and must not be added to the default workspace test run (avoids flaky CI).
- A failing workspace test blocks merge.

## Audit job

- Runs `cargo audit` using `audit.toml` and `.auditignore`.
- **High** and **critical** advisories fail the job by default.
- An advisory may only be ignored when it is listed in `.auditignore` **with a documented
  reason** (and, for critical advisories, a link to a tracking issue).
- Critical advisories must never be silently ignored without an issue link.

## Verifying required checks

After the workflow has run at least once, confirm the required check names match this
document with:

```sh
gh api repos/:owner/:repo/branches/main/protection \
  --jq '.required_status_checks.contexts'
```

The output must contain `contract-workspace-tests` and `contract-audit`.

## Out of scope

Formal-methods CI is not part of this regression workflow.
