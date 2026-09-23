# Branch Protection

This document lists the required status checks that must pass before a pull
request can be merged into the protected branches (`main`, `release/*`).

## Required status checks

| Check name | Workflow | Purpose |
| --- | --- | --- |
| `abi-snapshot` | `.github/workflows/abi-snapshot.yml` | Fails when a contract's public ABI differs from the committed snapshot in `contract/abi-snapshots/`. |
| `interface-docs-drift` | `.github/workflows/interface-docs-drift.yml` | Fails when interface docs drift from the contract interfaces (missing/renamed methods, undocumented errors). |
| `contract-deploy-smoke` | `.github/workflows/contract-deploy-smoke.yml` | Fail-closed deploy smoke test for all workspace contracts. |

## Enabling the checks

1. Open **Settings → Branches → Branch protection rules** for the target branch.
2. Enable **Require status checks to pass before merging**.
3. Add each check name from the table above (they appear after the workflows
   have run at least once on a PR).
4. Enable **Require branches to be up to date before merging** so snapshots are
   validated against the latest base.

## Contributor expectations

- Any PR that changes a contract interface must update the corresponding ABI
  snapshot and interface docs in the same PR. See
  [`contract/abi-snapshots/README.md`](../abi-snapshots/README.md) for the
  update procedure.
- Do not commit stale snapshots to hide interface changes; the `abi-snapshot`
  check will fail on unexpected diffs.
