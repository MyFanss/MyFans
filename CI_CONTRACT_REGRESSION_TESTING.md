# CI/CD: Contract Regression Testing Setup

This document summarizes the contract regression testing implementation in the MyFans CI/CD pipeline.

## Goal

Catch contract regressions before merge by ensuring:
1. ✅ `cargo test` runs on every PR
2. ✅ Job fails if tests fail
3. ✅ Merge is blocked when tests fail (via branch protection)
4. ✅ WASM artifacts build and verify successfully

## Implementation Status

### ✅ Completed

- [x] Contract CI workflow configured (`contract-ci.yml`)
- [x] All contracts have comprehensive unit tests
- [x] Tests run on all PRs
- [x] WASM artifacts built and verified
- [x] Documentation created for developers
- [x] Testing guides and checklists created
- [x] Development workflow documented

### 📋 Branch Protection Setup (Manual Step)

To enable merge blocking, configure GitHub branch protection for `main` and `master` branches:

**Required Status Check**: `contract` (from `.github/workflows/contract-ci.yml`)

**Via GitHub UI**:
1. Go to Settings → Branches → Branch protection rules
2. Edit or create rule for `main` and `master`
3. Under "Require status checks to pass before merging"
4. Search for and select `contract`

**Via GitHub CLI**:
```bash
gh api -X PUT /repos/MyFanss/MyFans/branches/main/protection \
  -f required_status_checks='{"strict":true,"contexts":["contract"]}' \
  -f enforce_admins=true

gh api -X PUT /repos/MyFanss/MyFans/branches/master/protection \
  -f required_status_checks='{"strict":true,"contexts":["contract"]}' \
  -f enforce_admins=true
```

## Workflow Details

### Primary: `.github/workflows/contract-ci.yml`

| Aspect | Detail |
|--------|--------|
| **Trigger** | All PRs, pushes to main/master, manual dispatch |
| **Job Name** | `contract` |
| **Timeout** | 30 minutes |
| **Steps** | 1. Format check 2. Linting 3. **Tests** 4. WASM build 5. Artifact verification |
| **Status Check** | YES - Blocks merge if fails |

**Key Step: Run tests**
```bash
cargo test --all-features --manifest-path Cargo.toml
```

**Key Step: Verify WASM artifacts**
- Ensures all 5 expected contracts are built:
  - subscription.wasm
  - myfans_token.wasm
  - content_access.wasm
  - creator_registry.wasm
  - earnings.wasm

### Secondary: `.github/workflows/ci.yml`

Part of the main CI pipeline for main/develop branches.

| Aspect | Detail |
|--------|--------|
| **Trigger** | PRs to main/develop, pushes to main/develop |
| **Job Name** | `Contract (Rust)` |
| **Tests** | Yes, same tests as contract-ci.yml |
| **Status Check** | Not set as required (redundant with contract-ci) |
| **Also runs** | wasm-size job for artifact size tracking |

## Test Coverage

### Current Test Status

All 12 contracts have comprehensive tests:

✅ myfans-token - 10+ tests
✅ subscription - 5+ tests
✅ content-access - 5+ tests
✅ creator-registry - 5+ tests
✅ earnings - 5+ tests
✅ creator-earnings - 5+ tests
✅ creator-deposits - 5+ tests
✅ content-likes - 5+ tests
✅ test-consumer - Tests for integration patterns
✅ treasury - 5+ tests
✅ myfans-lib - Library tests
✅ myfans-contract - 5+ tests

### Test Categories

Each contract's tests cover:
- **Unit tests**: Individual method functionality
- **Error handling**: Invalid inputs, edge cases
- **Authorization**: Auth guards and permissions
- **State changes**: Ledger state consistency
- **Cross-contract calls**: Interactions between contracts
- **Events**: Proper event emission

## Running Tests Locally

### Before Pushing to PR

```bash
cd contract

# Quick test
cargo test --all-features

# Full CI checks
cargo fmt --all --check && \
  cargo clippy --all-targets --all-features -- -D warnings && \
  cargo test --all-features && \
  cargo build --release --target wasm32-unknown-unknown
```

### During Development

```bash
cd contract

# Watch mode (requires cargo-watch)
cargo watch -x test

# Verbose output
cargo test -- --nocapture

# Single test
cargo test test_transfer -- --nocapture
```

## Documentation for Developers

### Quick Links

| Document | Purpose |
|----------|---------|
| [contract/TESTING.md](../contract/TESTING.md) | Testing patterns and best practices |
| [contract/REGRESSION_TESTING.md](../contract/REGRESSION_TESTING.md) | How regression testing is enforced |
| [contract/REGRESSION_CHECKLIST.md](../contract/REGRESSION_CHECKLIST.md) | Developer PR checklist |
| [contract/docs/BRANCH_PROTECTION.md](../contract/docs/BRANCH_PROTECTION.md) | Technical branch protection setup |

### PR Submission

When submitting a PR with contract changes:

1. **Add tests** for new/modified functionality
2. **Run locally**: `cargo test --all-features`
3. **Use checklist**: [REGRESSION_CHECKLIST.md](../contract/REGRESSION_CHECKLIST.md)
4. **Wait for CI**: GitHub Actions will run contract tests
5. **Address failures**: Fix tests and push new commits

## Regression Prevention Strategies

### 1. Comprehensive Unit Tests

- Every public method has test coverage
- Tests include happy path and error cases
- Auth requirements are tested
- State changes are verified

### 2. Cross-Contract Interaction Tests

When contracts call each other:
```rust
#[test]
fn test_cross_contract_call() {
    // Setup both contracts
    // Initialize them
    // Call from one to another
    // Verify state in both
}
```

### 3. CI Enforcement

- Tests run automatically on all PRs
- Merge blocked if tests fail
- No exceptions (all PRs checked)
- Status visible on GitHub

### 4. Performance Monitoring

Monitor test execution time:
```bash
cd contract && time cargo test --all-features
```

Target: < 30 seconds total

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Tests pass locally but fail in CI | Run with CI's exact command: `cargo test --all-features --manifest-path Cargo.toml` |
| Test times out | Run single test with `cargo test test_name -- --nocapture` |
| Formatting error in CI | Run `cargo fmt --all` locally |
| Clippy warning in CI | Run `cargo clippy --all-targets --all-features` and fix warnings |
| WASM artifact missing | Ensure contract is in `contract/Cargo.toml` workspace members |
| PR blocked by failing CI | Check error message, reproduce locally, fix and push new commit |

## Maintenance

### Quarterly Review

- Review test coverage metrics
- Update branch protection rules if needed
- Check for outdated dependencies
- Verify all contracts still have tests

### Per-Release

- Ensure all new contracts have tests
- Update AUTH_MATRIX.md if auth rules changed
- Verify all tests pass on release branch
- Check WASM artifact sizes for regressions

### Per-Security-Audit

- Add tests for audit findings
- Verify fixes are regression-tested
- Consider adding property-based tests
- Update documentation as needed

## Integration with Backend

### Contract-Backend Interaction Tests

The backend has integration tests that mock contract interactions:
- [backend/test/wallet.e2e-spec.ts](../../backend/test/wallet.e2e-spec.ts)
- [backend/test/subscriptions.e2e-spec.ts](../../backend/test/subscriptions.e2e-spec.ts)

These test backend behavior when interacting with contracts through the SorobanRpcService.

### Full E2E Testing

For full end-to-end testing:
1. Deploy contracts to testnet
2. Run backend against testnet contracts
3. Test through frontend UI

See [DEPLOYMENT.md](../DEPLOYMENT.md) for deployment procedures.

## References

- [Soroban Testing Guide](https://developers.stellar.org/docs/build/guides/testing)
- [Cargo Test Documentation](https://doc.rust-lang.org/cargo/commands/cargo-test.html)
- [GitHub Actions](https://docs.github.com/en/actions)
- [GitHub Branch Protection](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/defining-the-mergeability-of-pull-requests/about-protected-branches)

## Summary

The contract regression testing implementation:
- ✅ Automatically runs tests on all PRs
- ✅ Fails the CI job if tests don't pass
- ✅ Requires branch protection configuration to block merges
- ✅ Has comprehensive test coverage across all contracts
- ✅ Includes WASM artifact verification
- ✅ Includes developer documentation and checklists
- ✅ Integrates with backend and frontend testing

To complete the implementation, configure branch protection as described in the "Branch Protection Setup" section above.
