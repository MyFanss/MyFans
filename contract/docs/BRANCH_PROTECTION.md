# Branch Protection Rules: Smart Contracts

To maintain the stability and security of the MyFans Soroban smart contracts, the following branch protection rules must be applied to the `main` and `master` branches in GitHub.

## 1. Protect Matching Branches
- **Branch name patterns**: `main`, `master`

## 2. Pull Request Requirements
- [x] **Require a pull request before merging**
    - [x] **Require approvals**: `1` (Minimum)
    - [x] **Dismiss stale pull request approvals when new commits are pushed**
    - [x] **Require review from Code Owners**: This ensures that any changes to the `contract/` directory are approved by the `@MyFanss/contract` team (if applicable).

## 3. Status Check Requirements
- [x] **Require status checks to pass before merging**
    - [x] **Require branches to be up to date before merging**
    - **Required Status Checks**:
        - `contract` — Soroban contract formatting, linting (clippy), unit tests, and WASM build verification

## 4. History & Commit Requirements
- [x] **Require linear history**: Prevent merge commits; use **Squash and merge** or **Rebase and merge**.
- [x] **Require signed commits**: All commits should be verified with a GPG or SSH key to ensure authenticity (recommended for production contracts).

## 5. Other Restrictions
- [x] **Restrict pushes**: Only designated maintainers or automated bots should be allowed to push directly to protected branches.
- [x] **Include administrators**: All of the above rules apply to administrators as well.

---

## Contract CI Workflow

The contract CI workflow (`contract-ci.yml`) performs the following checks:

1. **Formatting Check** (`cargo fmt`)
   - Ensures code follows Rust style conventions
   - Automatically formatters may be applied locally before committing

2. **Linting** (`cargo clippy`)
   - Static analysis to catch common mistakes and improve code quality
   - Warnings are treated as errors

3. **Unit Tests** (`cargo test --all-features`)
   - All Soroban contract tests run with all feature flags enabled
   - Covers individual contract logic and cross-contract interactions

4. **WASM Build & Verification**
   - Builds the optimized WASM targets for Soroban deployment
   - Verifies all expected contract artifacts are produced:
     - `subscription.wasm`
     - `myfans_token.wasm`
     - `content_access.wasm`
     - `creator_registry.wasm`
     - `earnings.wasm`

## Configuration Template (GitHub CLI)

If you have the [GitHub CLI](https://cli.github.com/) installed, you can apply these rules using the following command:

```bash
gh api -X PUT /repos/MyFanss/MyFans/branches/main/protection \
  -H "Accept: application/vnd.github+json" \
  -f required_status_checks='{"strict":true,"contexts":["contract"]}' \
  -f enforce_admins=true \
  -f required_pull_request_reviews='{"dismiss_stale_reviews":true,"require_code_owner_reviews":false,"required_approving_review_count":1}' \
  -f restrictions=null \
  -f required_linear_history=true \
  -f required_signatures=false
```

## Running Checks Locally

Before pushing to a protected branch, run the same checks locally:

```bash
cd contract

# Format check
cargo fmt --all --check

# Linting
cargo clippy --all-targets --all-features -- -D warnings

# Unit tests
cargo test --all-features

# WASM build
cargo build --release --target wasm32-unknown-unknown
```

Or run all checks at once:

```bash
cd contract && cargo fmt --all --check && \
  cargo clippy --all-targets --all-features -- -D warnings && \
  cargo test --all-features && \
  cargo build --release --target wasm32-unknown-unknown
```

## Adding New Tests

When adding a new contract or modifying existing ones:

1. Add comprehensive unit tests in the contract's `mod test` section
2. Use `Env::default()` for isolated test environments
3. Test both happy path and error cases
4. Use descriptive test names that indicate what is being tested
5. Mock external dependencies (other contracts, ledger state) as needed

Example test structure:

```rust
#[test]
fn test_happy_path_scenario() {
    let env = Env::default();
    env.mock_all_auths();
    
    // Setup
    let contract_id = env.register_contract(None, MyContract);
    let client = MyContractClient::new(&env, &contract_id);
    
    // Exercise
    let result = client.some_method(&arg);
    
    // Verify
    assert_eq!(result, expected_value);
}

#[test]
fn test_error_condition() {
    let env = Env::default();
    env.mock_all_auths();
    
    let contract_id = env.register_contract(None, MyContract);
    let client = MyContractClient::new(&env, &contract_id);
    
    let result = client.try_invalid_method(&bad_arg);
    assert_eq!(result, Err(Ok(Error::InvalidInput)));
}
```

## Testing Contract Interactions

For cross-contract interactions, set up multiple contract instances and test call chains:

```rust
#[test]
fn test_cross_contract_call() {
    let env = Env::default();
    env.mock_all_auths();
    
    let token_id = env.register_contract(None, TokenContract);
    let token_client = TokenContractClient::new(&env, &token_id);
    
    let subscription_id = env.register_contract(None, SubscriptionContract);
    let subscription_client = SubscriptionContractClient::new(&env, &subscription_id);
    
    // Initialize and test interaction
    token_client.initialize(&admin, &String::from_str(&env, "Token"));
    subscription_client.initialize(&admin, &token_id);
    
    // Test the interaction
    let result = subscription_client.subscribe(&subscriber, &amount);
    assert!(result.is_ok());
}
```

## Maintenance

These rules and tests should be reviewed:
- **Quarterly**: Ensure rules align with the team's evolving workflow
- **Per PR**: When adding new contracts or modifying interfaces
- **After Security Reviews**: When addressing security findings or audit recommendations

## References

- [Soroban Rust SDK - Testing](https://developers.stellar.org/docs/build/guides/testing)
- [Cargo Test Documentation](https://doc.rust-lang.org/cargo/commands/cargo-test.html)
- [GitHub Branch Protection](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/defining-the-mergeability-of-pull-requests/about-protected-branches)
