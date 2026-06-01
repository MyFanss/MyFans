# Contract Regression Prevention Checklist

Use this checklist when modifying or adding contracts to ensure regressions are caught by CI before merge.

## Before Opening a PR

### Code Changes
- [ ] All contract modifications are in `contract/contracts/*/src/`
- [ ] New public methods have corresponding tests
- [ ] Modified methods have test coverage for changes
- [ ] Authorization requirements are tested

### Testing
- [ ] Run local tests: `cd contract && cargo test --all-features`
- [ ] All tests pass locally
- [ ] Test coverage includes:
  - [ ] Happy path scenarios
  - [ ] Error conditions with proper error codes
  - [ ] Authorization checks (both allow and deny cases)
  - [ ] State changes are verified
  - [ ] Edge cases (zero amounts, max values, overflow)
  - [ ] Cross-contract interactions (if applicable)

### Code Quality
- [ ] Code is formatted: `cargo fmt --all --check`
- [ ] Linting passes: `cargo clippy --all-targets --all-features -- -D warnings`
- [ ] No compiler warnings

### Documentation
- [ ] Contract interface documentation updated if needed
- [ ] AUTH_MATRIX.md updated if auth rules changed
- [ ] Test function names are descriptive
- [ ] Complex test logic includes comments

## When Contract Interface Changes

- [ ] Update `contract/AUTH_MATRIX.md` with new/modified methods
- [ ] Document authorization requirements for each method
- [ ] Add integration test if another contract now calls this one
- [ ] Verify all related contracts' tests still pass

## PR Description

Include in your PR description:

```markdown
### Contract Changes
- [ ] Added new contract: [name]
- [ ] Modified existing contract: [name]
- [ ] No contract changes (non-contract PR)

### Tests Added/Modified
- [ ] Unit tests for [functionality]
- [ ] Cross-contract tests for [interaction]
- [ ] Error condition tests for [scenario]

### Regression Impact
- No expected regressions / Regression prevention:
  - [Specific test added for X]
  - [Specific test added for Y]
```

## After Opening PR

### Monitor CI
- [ ] Contract CI workflow starts automatically
- [ ] Workflow reaches the test step
- [ ] Tests pass in CI
- [ ] WASM artifacts build successfully
- [ ] All 5 WASM files verified:
  - subscription.wasm
  - myfans_token.wasm
  - content_access.wasm
  - creator_registry.wasm
  - earnings.wasm

### Addressing Test Failures

If CI fails at test step:
1. [ ] Read the error message carefully
2. [ ] Reproduce locally: `cargo test -- --nocapture`
3. [ ] Debug the issue
4. [ ] Fix the code or test
5. [ ] Push new commit
6. [ ] Verify CI passes on retry

If CI fails at other steps:
1. [ ] Format: `cargo fmt --all && cargo test --all-features`
2. [ ] Linting: `cargo clippy --all-targets --all-features -- -D warnings`
3. [ ] WASM build: `cargo build --release --target wasm32-unknown-unknown`

## Testing New Cross-Contract Interactions

When adding a call from one contract to another:

- [ ] Setup both contracts in test
- [ ] Initialize the called contract properly
- [ ] Test successful call path
- [ ] Test error path (if caller contract should handle errors)
- [ ] Verify state changes in both contracts
- [ ] Test authorization requirements in called contract

Example test structure:
```rust
#[test]
fn test_cross_contract_success() {
    let env = Env::default();
    env.mock_all_auths();
    
    // Setup contract A
    let contract_a_id = env.register_contract(None, ContractA);
    let contract_a = ContractAClient::new(&env, &contract_a_id);
    
    // Setup contract B
    let contract_b_id = env.register_contract(None, ContractB);
    let contract_b = ContractBClient::new(&env, &contract_b_id);
    
    // Initialize
    contract_a.initialize(...);
    contract_b.initialize(&contract_a_id, ...);
    
    // Exercise interaction
    let result = contract_b.method_calling_contract_a(...);
    
    // Verify both contracts updated correctly
    assert_eq!(contract_a.some_state(), expected);
    assert_eq!(contract_b.other_state(), expected);
}
```

## Common Regression Prevention Patterns

### State Initialization
- [ ] Test that initialization sets expected state
- [ ] Test that re-initialization fails appropriately
- [ ] Test that uninitialized contract properly errors

### Authorization  
- [ ] Test that admin-only methods reject non-admins
- [ ] Test that user methods work with proper permissions
- [ ] Test that cross-contract calls respect authorization

### Balance/Amount Validation
- [ ] Test zero amount rejection (if applicable)
- [ ] Test insufficient balance scenarios
- [ ] Test amount precision handling
- [ ] Test overflow/underflow handling

### State Consistency
- [ ] Test that ledger updates are atomic (or properly handle partial failures)
- [ ] Test that related state remains consistent
- [ ] Test that events properly reflect state changes

### Error Recovery
- [ ] Test that failed operations don't corrupt state
- [ ] Test that retrying valid operations works correctly
- [ ] Test idempotency where applicable

## Regression Testing Metrics

Track these to ensure quality:
- ✅ Number of tests per contract (target: ≥ 5-10)
- ✅ Test execution time (target: < 30 seconds for `cargo test`)
- ✅ Code coverage for contracts (target: > 80% for public APIs)
- ✅ Test pass rate (target: 100% on main)

## Reporting Issues

If you find a contract regression:

1. [ ] Create a failing test that demonstrates the regression
2. [ ] Add test to the contract's test module
3. [ ] Open an issue with details:
   - When was it introduced? (commit/PR)
   - What is the impact?
   - How can it be reproduced?
4. [ ] Commit fix with test passing
5. [ ] Ensure test remains in codebase to prevent re-regression

## Useful Commands

```bash
# Test everything
cd contract && cargo test --all-features

# Test specific contract
cd contract/contracts/myfans-token && cargo test

# Test with output
cd contract && cargo test -- --nocapture

# Single test
cd contract && cargo test test_transfer -- --nocapture

# Watch mode (requires cargo-watch)
cd contract && cargo watch -x test

# Pre-commit hook (run before git commit)
./contract && cargo fmt --all --check && \
  cargo clippy --all-targets --all-features -- -D warnings && \
  cargo test --all-features
```

## References

- **Testing Guide**: [contract/TESTING.md](./TESTING.md)
- **Regression Testing**: [contract/REGRESSION_TESTING.md](./REGRESSION_TESTING.md)
- **Branch Protection**: [contract/docs/BRANCH_PROTECTION.md](./docs/BRANCH_PROTECTION.md)
- **CI Workflow**: [.github/workflows/contract-ci.yml](.github/workflows/contract-ci.yml)
- **Soroban Docs**: https://developers.stellar.org/docs/build/guides/testing
