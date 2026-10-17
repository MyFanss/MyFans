# Branch Protection — Contract

Required check names for the whole repo are maintained in
[`.github/required-checks.json`](../../.github/required-checks.json) and documented in
[`docs/BRANCH_PROTECTION.md`](../../docs/BRANCH_PROTECTION.md). CI verifies them with
`scripts/ci/verify-required-checks.mjs`, so this file doesn't repeat the list.

## Contract-relevant required checks

| Check name | Branches | Gates |
| --- | --- | --- |
| `cargo audit — contract` | `main`, `release/**` | No RustSec vulnerability in `contract/Cargo.lock` unless listed in `contract/.auditignore` with a tracking issue |
| `Futurenet smoke — contract ID gate` | `release/**` | Fails closed when any contract ID is missing, empty, malformed or duplicated in release context (see `scripts/validate-contract-ids.mjs`) |

`Contract — tests + wasm build`, `Contract — ABI snapshot drift` and
`Contract — interface docs drift` run on every PR but are **not yet required**
because they currently fail for pre-existing reasons. See "Not yet required" in
the canonical doc.

## Contributor expectations

- Any PR that changes a contract interface must update the corresponding ABI
  snapshot and interface docs in the same PR. See
  [`contract/abi-snapshots/README.md`](../abi-snapshots/README.md) for the
  update procedure.
- Don't commit stale snapshots to hide interface changes. The ABI snapshot
  job fails on unexpected diffs.
- Never hand-edit `contract/contract-ids.json`. Regenerate it from a real deploy
  and validate it with `./scripts/test-deploy-output.sh contract-ids.json`
  (see [CONTRACT_DEPLOY_RUNBOOK.md](CONTRACT_DEPLOY_RUNBOOK.md)).
