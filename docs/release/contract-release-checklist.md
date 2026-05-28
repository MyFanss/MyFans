# Contract Release Checklist

Use this checklist for every production contract release from `contract/`. It ensures repeatable, secure, and coordinated releases with backend and frontend dependencies.

## Release Summary

| Field | Value |
| --- | --- |
| Release name | `...` |
| Release date | `YYYY-MM-DD` |
| Release owner | `@name` |
| Contract branch / commit | `...` |
| Backend branch / commit | `...` |
| Frontend branch / commit | `...` |
| Target network | `futurenet` / `testnet` / `mainnet` |
| Deployment window | `...` |
| Rollback owner | `@name` |

## 1. Pre-release Checks

- [ ] All required CI checks are green for the release branch.
- [ ] Contract validation passes for the release branch.
  Contract commands on this repo:
  - `cd contract && cargo fmt --check`
  - `cd contract && cargo clippy --all-targets --all-features`
  - `cd contract && cargo test --all-features`
  - `cd contract && cargo build --release --target wasm32-unknown-unknown`
- [ ] ABI snapshots are up to date and committed.
  - `cd contract && ./scripts/snapshot-abi.sh --check`
- [ ] Deploy dry-run passes without errors.
  - `cd contract && ./scripts/deploy.sh --network futurenet --dry-run`
- [ ] Security audit is complete with no critical findings.
- [ ] Authorization matrix (`AUTH_MATRIX.md`) is updated for any changed methods.
- [ ] Storage keys (`STORAGE_KEYS.md`) are documented for any new persistent state.
- [ ] PR review and approval are complete.
- [ ] Changelog or release notes are updated.
- [ ] Upgrade governance checklist (`docs/CONTRACT_UPGRADE_GOVERNANCE.md`) is followed.

## 2. Backend Compatibility Checks

- [ ] Backend contract client code is compatible with the new contract interface.
- [ ] No pending backend contract address, network config, or RPC URL changes block the release.
- [ ] Backend has been tested against the exact contract commit planned for production.
- [ ] Monitoring exists for release-critical contract flows:
  - subscription creation and renewal
  - content access checks
  - earnings recording
  - token transfers and allowances

## 3. Frontend Compatibility Checks

- [ ] Frontend contract interaction code is compatible with the new contract interface.
- [ ] Contract addresses and network configuration used by the frontend are verified.
- [ ] Frontend-backed flows were tested on the target environment:
  - wallet connection and transaction signing
  - subscription checkout and confirmation
  - gated content access after subscription
  - creator dashboard earnings display
- [ ] Any contract migration, deploy ordering, or maintenance window is documented before release.

## 4. Testnet Verification

- [ ] Testnet deploy completed successfully.
- [ ] Post-deploy smoke tests passed (see `scripts/deploy.sh` output verification).
- [ ] Backend owner confirms target contract readiness on testnet.
- [ ] Frontend owner confirms target contract readiness on testnet.
- [ ] Known issues and acceptable risks are documented before production approval.

## 5. Production Go/No-Go

- [ ] Contract owner approves release.
- [ ] Backend owner approves release.
- [ ] Frontend owner approves release.
- [ ] Security team approves release (for upgrades or breaking changes).
- [ ] Product/support stakeholders are aware of the deployment window.
- [ ] Rollback plan from `docs/release/ROLLBACK_TEMPLATE.md` is prepared before deploy starts.
- [ ] Maintenance mode plan is documented if required.

## 6. Post-deploy Checks

- [ ] Production deploy completed successfully.
- [ ] Post-deploy smoke tests passed (see `scripts/deploy.sh` output verification).
- [ ] Contract addresses are recorded in `deployed.json` and `.env.deployed`.
- [ ] Backend and frontend `.env` files are updated with new contract addresses.
- [ ] Error rate, transaction failures, and RPC health remain within expected range.
- [ ] Upgrade is logged in `docs/upgrade-log.md`.
- [ ] Release completion is announced with links to monitoring and any follow-up items.

## Sign-off

| Team | Owner | Status | Notes |
| --- | --- | --- | --- |
| Contract | `@name` | `Pending / Approved` | `...` |
| Backend | `@name` | `Pending / Approved` | `...` |
| Frontend | `@name` | `Pending / Approved` | `...` |
| Security | `@name` | `Pending / Approved` | `...` |
| Product / Support | `@name` | `Pending / Approved` | `...` |

## Automated Verification

Run the automated release checklist script:

```bash
cd contract && ./scripts/release-check.sh
```

This script verifies:
- Rust formatting and linting
- All tests pass
- WASM builds successfully
- ABI snapshots are current
- Deploy dry-run succeeds
- Deploy output schema is valid

CI runs this script automatically on every PR and push to main.
