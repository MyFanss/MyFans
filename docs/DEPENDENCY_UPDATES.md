# Dependency Update Policy

> Issue #1856. Config: [`.github/dependabot.yml`](../.github/dependabot.yml).

Outdated dependencies and slow responses to advisories are supply-chain risks across our three packages. Dependabot opens update PRs on a fixed, low-noise schedule. They go through the same CI and review as human PRs.

## What is covered

| Ecosystem | Directory | Schedule | Grouping |
|---|---|---|---|
| npm | `backend/` | Weekly, Monday 05:00 UTC | 1 PR for all minor+patch; majors individually; security separately |
| npm | `frontend/` | Weekly, Monday 05:00 UTC | Storybook group; 1 PR for other minor+patch; majors individually; security separately |
| Cargo | `contract/` | Weekly, Monday 05:00 UTC | 1 PR for minor+patch; majors individually; security separately |
| GitHub Actions | `.github/workflows/` | Monthly | 1 PR for everything |

Not covered, on purpose:

- **Root `package.json`.** It has no dependencies, only orchestration scripts.
- **`contract/package.json`.** It only has scripts and no lockfile.
- **`soroban-sdk`.** It is pinned exactly in `contract/Cargo.toml` and asserted by `contract/scripts/release-check.sh`. SDK bumps change host semantics and ABI snapshots, so they are done by hand and follow [Contract Upgrade Governance](CONTRACT_UPGRADE_GOVERNANCE.md). The pin in `release-check.sh` must be updated in the same PR. Advisories are still caught by `cargo audit` ([security-audit.yml](../.github/workflows/security-audit.yml)).
- **`frontend/pnpm-lock.yaml`.** npm (`package-lock.json`) is the lockfile CI installs from. Dependabot updates `package-lock.json` only. Do not hand-edit the pnpm lock to follow.

## Rules for bot PRs

1. **CI is required.** Bot PRs trigger the same `pull_request` workflows as human PRs (lint, tests, `npm audit`, `cargo audit`, e2e). Branch protection ([BRANCH_PROTECTION.md](BRANCH_PROTECTION.md)) applies unchanged. A red bot PR is never merged.
2. **No auto-merge.** A CODEOWNER must approve every bot PR, and nobody enables unrestricted auto-merge for bot PRs. This is out of scope for #1856 and would need a separate policy decision.
3. **Secrets are not available** to Dependabot-triggered runs by GitHub design. Jobs that need secrets skip on non-release branches (for example [Futurenet Smoke](../.github/workflows/futurenet-smoke.yml)). This is expected and does not count as a pass for those checks.
4. **Majors are reviewed individually.** Read the upstream changelog or migration guide and note breaking changes in the PR. If the upgrade needs code changes, push them to the bot branch or close the PR and open a human one.
5. **Security groups first.** `*-security` PRs take priority over routine bumps. Target turnaround is 2 business days for high/critical advisories and one weekly cycle for the rest.

## Triage rotation

Each package's CODEOWNERS team triages its own bot PRs. A weekly look on Monday is enough.

| PR | Owner |
|---|---|
| `backend-*` | @MyFanss/backend |
| `frontend-*` | @MyFanss/frontend |
| `contract-*` | @MyFanss/contract |
| `github-actions` | Repo admins |

If a grouped PR fails because of one package, reply `@dependabot ignore <dependency> minor version` (or `major`), or split the offending package out. Then record why in the PR.

## Controlling noise

- `open-pull-requests-limit` caps concurrent PRs per ecosystem (5 npm, 3 cargo, 3 actions).
- Weekly or monthly schedules replace daily ones.
- To pause an ecosystem temporarily, set its `open-pull-requests-limit: 0` in a PR that explains why and when it will be restored.

## Labels

PRs are labelled `dependencies` plus an area label (`backend`, `frontend`, `contract`, `ci`). A repo admin should create any missing labels once. If a label is missing, Dependabot still opens the PR and only warns in a comment.

## Validation

[`repo-config-validate.yml`](../.github/workflows/repo-config-validate.yml) checks `dependabot.yml` against the official schema on every PR that touches it. To run the same check locally:

```bash
pip install check-jsonschema
check-jsonschema --builtin-schema vendor.dependabot .github/dependabot.yml
```

After merging a config change, open **Insights → Dependency graph → Dependabot**. Confirm each ecosystem shows a recent successful check, and review the first PR batch.

## Commit messages

Bot commits use the Conventional Commit prefixes `build(deps): …` and `build(deps-dev): …` (`ci(deps): …` for Actions). They show up under **Build** / **CI** in generated release notes. See [Changelog Guide](CHANGELOG_GUIDE.md).
