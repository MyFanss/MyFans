# Contract Regression Testing Guide

This document explains how the MyFans project ensures contract regressions are caught before merge, with automated CI enforcement.

## Overview

The goal is to:
1. ✅ Run `cargo test` on every PR
2. ✅ Fail the CI job if tests don't pass  
3. ✅ Block PR merge when contract tests fail
4. ✅ Build and verify WASM artifacts

## CI/CD Pipeline

### GitHub Actions Workflow

The workflow file [`.github/workflows/contract-ci.yml`](.github/workflows/contract-ci.yml) runs on:
- Every pull request
- Every push to `main` or `master`
- Manual workflow dispatch

### Workflow Steps

1. **Setup Rust Toolchain**
   - Uses stable Rust
   - Installs wasm32 target for Soroban compilation
   - Includes `rustfmt` and `clippy` for linting

2. **Format Check** (`cargo fmt --all --check`)
   - Ensures code follows Rust style conventions
   - Fails if formatting issues found

3. **Linting** (`cargo clippy --all-targets --all-features -- -D warnings`)
   - Runs static analysis
   - Treats warnings as errors

4. **Unit Tests** (`cargo test --all-features --manifest-path Cargo.toml`)
   - Runs all Soroban contract tests
   - Tests all features combinations
   - **This step fails the workflow if any test fails**

5. **WASM Build** (`cargo build --release --target wasm32-unknown-unknown`)
   - Builds optimized WASM artifacts
   - Required for Soroban contract deployment

6. **WASM Artifact Verification**
   - Verifies all expected contracts are produced:
     - `subscription.wasm`
     - `myfans_token.wasm`
     - `content_access.wasm`
     - `creator_registry.wasm`
     - `earnings.wasm`
   - Fails if any artifact is missing or empty

## Branch Protection

### Main and Master Branches

Required status checks for merge:
- **`contract`** — The contract-ci workflow job must pass

This means:
- ✅ All contract tests must pass
- ✅ Code must pass formatting and linting checks
- ✅ WASM artifacts must build successfully
- ✅ No merges allowed if any of the above fail

Configuration via GitHub CLI:
```bash
gh api -X PUT /repos/MyFanss/MyFans/branches/main/protection \
  -f required_status_checks='{"strict":true,"contexts":["contract"]}' \
  -f enforce_admins=true
```

## Running Tests Locally

### Before Opening a PR

```bash
cd contract

# Run all checks that CI will run
cargo fmt --all --check && \
  cargo clippy --all-targets --all-features -- -D warnings && \
  cargo test --all-features && \
  cargo build --release --target wasm32-unknown-unknown
```

### Quick Test Run

```bash
cd contract && cargo test --all-features
```

### Watch Mode (During Development)

```bash
cd contract && cargo watch -x test
```

(Install `cargo-watch` with: `cargo install cargo-watch`)

## Test Structure

All tests are in contract source files under `mod test` blocks:

```
contract/contracts/
├── myfans-token/src/
│   ├── lib.rs          # Main contract code
│   ├── test.rs         # Test module (imported in lib.rs)
│   └── gas_tests.rs    # Performance/gas tests
├── subscription/src/
│   ├── lib.rs
│   └── (tests in lib.rs)
├── content-access/src/
│   ├── lib.rs
│   └── (tests in lib.rs)
└── [other contracts]/
```

## Regression Testing Strategy

### Unit Tests

Each contract has comprehensive unit tests covering:
- **Happy path**: Normal operation succeeds
- **Error conditions**: Invalid inputs are rejected
- **State changes**: Verify state updates correctly
- **Authorization**: Auth guards work properly
- **Cross-contract interactions**: Calls to other contracts work

### Test Coverage Goals

For each public method, tests should cover:
- ✅ Successful execution
- ✅ All documented error conditions
- ✅ Authorization requirements
- ✅ State persistence
- ✅ Event emissions (if applicable)

### Writing Tests

Example of a complete regression test:

```rust
#[test]
fn test_subscription_prevents_duplicate_subscription() {
    let env = Env::default();
    env.mock_all_auths();
    
    let token_id = env.register_contract(None, MyFansToken);
    let token_client = MyFansTokenClient::new(&env, &token_id);
    
    let subscription_id = env.register_contract(None, SubscriptionContract);
    let subscription_client = SubscriptionContractClient::new(&env, &subscription_id);
    
    let admin = Address::generate(&env);
    let creator = Address::generate(&env);
    let fan = Address::generate(&env);
    
    // Setup
    token_client.initialize(&admin, &String::from_str(&env, "Token"), &7, &0);
    subscription_client.initialize(&admin, &token_id);
    token_client.mint(&fan, &1000);
    
    // First subscription should succeed
    subscription_client.subscribe(&fan, &creator, &100);
    
    // Duplicate subscription should fail
    let result = subscription_client.try_subscribe(&fan, &creator, &100);
    assert_eq!(result, Err(Ok(Error::DuplicateSubscription)));
}
```

## Adding Tests for New Features

When adding new functionality to a contract:

1. **Create test cases** covering:
   - Normal operation (happy path)
   - All error conditions
   - Edge cases (zero amounts, max values, etc.)
   - Authorization requirements
   - State changes

2. **Run tests locally**:
   ```bash
   cargo test
   ```

3. **Verify CI passes** before requesting review

4. **Update `contract/TESTING.md`** if new patterns are introduced

## Debugging Test Failures

### Test Fails Locally but CI Passes

Ensure you're testing the same Cargo workspace:
```bash
cd contract
cargo test --all-features --manifest-path Cargo.toml
```

### Test Times Out

Some tests may take longer than expected. Run with output:
```bash
cargo test -- --nocapture --test-threads=1
```

### Contract Panic / Undefined Behavior

If a test panics unexpectedly:
```bash
# Run with backtrace
RUST_BACKTRACE=1 cargo test -- --nocapture

# Run a single test
cargo test test_name -- --nocapture
```

### Import Errors in Tests

Ensure the test module imports are correct:
```rust
#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::testutils::{Address as _, Ledger};
    use soroban_sdk::{Address, Env};
    
    #[test]
    fn test_something() {
        // ...
    }
}
```

## CI Failure Scenarios

| Scenario | Cause | Solution |
|----------|-------|----------|
| Workflow fails at test step | Test assertion failed | Debug and fix the failing test locally |
| Workflow fails at format step | Code not formatted | Run `cargo fmt --all` |
| Workflow fails at clippy step | Linting warnings | Address warnings from `cargo clippy` |
| Workflow fails at WASM build | Compilation error | Check error message and fix code |
| Workflow fails at artifact verification | Expected WASM not built | Verify contract is in Cargo.toml workspace members |

## Continuous Monitoring

### Performance

Monitor test execution time:
```bash
cd contract && time cargo test --all-features
```

If tests become slow, consider:
- Breaking large tests into smaller units
- Using feature flags to skip heavy tests in development
- Running tests in parallel: `cargo test --all-features -- --test-threads=4`

### Security

After each contract update:
1. Review changes for potential security issues
2. Run full test suite including edge cases
3. Consider implications for user flows
4. Update AUTH_MATRIX.md if auth rules changed

## Escalation

If a PR fails contract CI and the failure seems unrelated to your changes:

1. Check if `main` branch passes CI
2. Run tests locally to reproduce
3. Check for recent changes to Soroban SDK or dependencies
4. Post in development channel with details

## References

- [contract/TESTING.md](./TESTING.md) — Testing patterns and best practices
- [contract/docs/BRANCH_PROTECTION.md](./docs/BRANCH_PROTECTION.md) — Branch protection setup
- [Soroban Testing Guide](https://developers.stellar.org/docs/build/guides/testing)
- [GitHub Actions Workflow](../.github/workflows/contract-ci.yml)
