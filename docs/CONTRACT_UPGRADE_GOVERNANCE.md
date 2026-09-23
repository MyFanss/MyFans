# Contract Upgrade Governance

This document defines the process for upgrading MyFans Soroban (wasm) contracts
safely. Upgrading wasm without a controlled process risks bricking storage or
losing funds. Follow this process for every mainnet upgrade.

Related documents:

- [`contract/docs/CONTRACT_DEPLOY_RUNBOOK.md`](../contract/docs/CONTRACT_DEPLOY_RUNBOOK.md) — deploy runbook
- [`contract/CHANGELOG.md`](../contract/CHANGELOG.md) — contract changelog
- [`SECURITY.md`](../SECURITY.md) — security policy and disclosure process

## Upgrade Phases

Every upgrade moves through the following six phases in order. Do not skip a
phase; each phase has an explicit exit condition.

### 1. Propose

- Open an issue/PR describing the change, motivation, and affected contracts.
- Record the current wasm hash of each contract being upgraded.
- Identify storage key changes (see the compatibility checklist below).
- Exit: proposal reviewed by at least one maintainer.

### 2. Review

- Code review of the contract diff by a maintainer who did not author it.
- Confirm the storage key compatibility checklist is complete.
- Confirm the rollback plan is viable (previous wasm hash is known and stored).
- Exit: review approved and checklist signed off.

### 3. Audit

- For changes touching funds, auth, or storage layout, obtain an independent
  audit or a documented internal security review.
- Record audit findings and their resolution.
- Exit: no unresolved high/critical findings.

### 4. Timelock / Announce

- Announce the upgrade (contract IDs, wasm hashes, planned execution window)
  to users and integrators at least 48 hours before execution.
- Respect any on-chain timelock configured for the admin.
- Exit: announcement window elapsed with no blocking objections.

### 5. Execute

- Execute upgrades in dependency order (see multi-contract ordering below).
- Use dual control for the admin key (see Security considerations).
- Record the execution transaction hash for each contract.
- Exit: all target contracts report the new wasm hash.

### 6. Verify

- Run post-deploy verification from the deploy runbook.
- Confirm storage reads/writes still succeed and funds are intact.
- Complete the Upgrade Log entry below.
- Exit: verification results recorded and no regressions observed.

## Upgrade Log

Record one entry per upgrade. Keep this log in the PR that performs the upgrade
and append it to the release notes.

| Field | Value |
| --- | --- |
| Date (UTC) | |
| Contract(s) | |
| Previous wasm hash | |
| New wasm hash | |
| Proposer | |
| Reviewers / approvals | |
| Audit reference | |
| Timelock window | |
| Execution tx hash | |
| Verification results | |
| Rollback performed? | yes / no |

## Rollback Criteria

Roll back to the previous wasm hash if any of the following occur after
upgrade:

- Storage reads or writes fail, or stored data is unreadable/corrupted.
- Funds are inaccessible, mis-accounted, or a transfer fails unexpectedly.
- Auth or admin checks behave incorrectly (unauthorized access or lockout).
- Post-deploy verification fails and cannot be resolved forward quickly.
- A high/critical issue is discovered in the new wasm.

### Rollback Procedure

1. Freeze further upgrades and announce the rollback.
2. Redeploy the previously recorded wasm hash for the affected contract(s).
3. Re-run post-deploy verification and confirm storage and funds are intact.
4. Record the rollback in the Upgrade Log (set `Rollback performed?` to yes).
5. Open a follow-up issue to diagnose the root cause before retrying.

## Storage Key Compatibility Checklist

Complete before executing any upgrade:

- [ ] No existing storage keys were renamed or removed.
- [ ] No existing storage key changed its value type or encoding.
- [ ] New keys are additive and namespaced to avoid collisions.
- [ ] Enum/struct variants used in storage remain backward compatible.
- [ ] Migration logic (if any) is idempotent and tested on a fork/testnet.
- [ ] Old wasm can still read data written by the new wasm (and vice versa)
      where a rollback may be needed.
- [ ] TTL/expiration handling for persistent storage is preserved.

## Edge Cases & Failure Modes

### Partial upgrade / multi-contract ordering

When multiple contracts must change together, upgrade in dependency order
(dependencies first, dependents last). If an upgrade fails partway, stop,
roll back the already-upgraded contracts to their previous hashes, and re-plan.
Never leave the system in a mixed state across a breaking interface change.

### Admin key loss

If the admin key is lost, upgrades and admin operations are blocked. Mitigate by
using dual control (below) and by storing recovery material in a secure,
access-controlled location. Document the recovery path before mainnet.

## Security Considerations

- **Dual control:** require two independent approvers for admin operations and
  upgrades; do not rely on a single key.
- **Disclosure:** report vulnerabilities per [`SECURITY.md`](../SECURITY.md).

## Out of Scope

On-chain DAO governance is out of scope for this document.
