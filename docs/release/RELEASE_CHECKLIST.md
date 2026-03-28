# Frontend Release Checklist

Use this checklist for every production frontend release from `frontend/`. It is intended to keep the release process repeatable and aligned with the backend in `backend/` and the Soroban contracts in `contract/`.

## Release Summary

| Field | Value |
| --- | --- |
| Release name | `...` |
| Release date | `YYYY-MM-DD` |
| Release owner | `@name` |
| Frontend branch / commit | `...` |
| Backend branch / commit | `...` |
| Contract branch / commit | `...` |
| Target environment | `staging` / `production` |
| Deployment window | `...` |
| Rollback owner | `@name` |

## 1. Pre-release Checks

- [ ] All required CI checks are green for the release branch.
- [ ] Frontend validation passes for the release branch.
  Frontend commands on this repo:
  - `cd frontend && npm run lint`
  - `cd frontend && npm run build`
- [ ] Backend validation passes for the backend version that will support this release.
  Backend commands on this repo:
  - `cd backend && npm test`
  - `cd backend && npm run test:e2e`
- [ ] Contract validation passes for the contract version the frontend depends on.
  Contract commands on this repo:
  - `cd contract && cargo test`
  - `cd contract && cargo build --target wasm32-unknown-unknown --release`
- [ ] No new console errors or warnings appear in the production build for changed flows.
- [ ] Environment variables are reviewed for the target environment.
  Minimum checks:
  - API base URL
  - wallet/network configuration
  - contract addresses and asset identifiers
  - monitoring or analytics keys
- [ ] Feature flags are reviewed and the intended post-release state is documented.
- [ ] PR review and approval are complete.
- [ ] Changelog or release notes are updated.
- [ ] Dependency audit is complete with no critical vulnerabilities accepted into the release.

## 2. Backend Compatibility Checks

- [ ] Frontend API calls used by this release are available on the target backend version.
- [ ] No pending backend schema, auth, payload, or response-shape changes block the release.
- [ ] Staging frontend has been tested against the exact backend commit planned for production.
- [ ] Monitoring exists for release-critical backend flows:
  - authentication/session restore
  - creator discovery and creator profile data
  - subscriptions and checkout
  - gated content access
  - earnings/settings updates where applicable

## 3. Contract Compatibility Checks

- [ ] The correct contract package versions are identified for the release.
- [ ] Contract addresses and network configuration used by the frontend are verified.
- [ ] Contract-backed flows were tested on the target environment:
  - subscription plan selection
  - payment or checkout initiation
  - status polling or confirmation
  - gated access after successful subscription
- [ ] Any contract migration, deploy ordering, or maintenance window is documented before release.

## 4. Staging Verification

- [ ] Staging deploy completed successfully.
- [ ] The smoke test matrix in [SMOKE_TEST_MATRIX.md](./SMOKE_TEST_MATRIX.md) is completed for staging.
- [ ] Known issues and acceptable risks are documented before production approval.
- [ ] Backend owner confirms target API readiness.
- [ ] Contract owner confirms target contract readiness.

## 5. Production Go/No-Go

- [ ] Frontend owner approves release.
- [ ] Backend owner approves release.
- [ ] Contract owner approves release.
- [ ] Product/support stakeholders are aware of the deployment window.
- [ ] Rollback plan from [ROLLBACK_TEMPLATE.md](./ROLLBACK_TEMPLATE.md) is prepared before deploy starts.

## 6. Post-deploy Checks

- [ ] Production deploy completed successfully.
- [ ] The smoke test matrix in [SMOKE_TEST_MATRIX.md](./SMOKE_TEST_MATRIX.md) is completed for production.
- [ ] Error rate, wallet failures, checkout failures, and backend API health remain within expected range.
- [ ] Release completion is announced with links to monitoring and any follow-up items.

## Sign-off

| Team | Owner | Status | Notes |
| --- | --- | --- | --- |
| Frontend | `@name` | `Pending / Approved` | `...` |
| Backend | `@name` | `Pending / Approved` | `...` |
| Contract | `@name` | `Pending / Approved` | `...` |
| Product / Support | `@name` | `Pending / Approved` | `...` |
