# Contract Testing Guide

This guide covers testing strategies, patterns, and best practices for MyFans Soroban smart contracts.

## Overview

Contract testing ensures:
- **Correctness**: Logic behaves as designed
- **Security**: Edge cases and invalid inputs are handled safely
- **Regressions**: Changes don't break existing functionality
- **Integration**: Cross-contract calls work properly

Tests run in the isolated Soroban test environment and do not require network access.

## Running Tests

### Run all tests
```bash
cd contract
cargo test
```

### Run tests for a specific contract
```bash
cd contract/contracts/myfans-token
cargo test
```

### Run a specific test
```bash
cd contract
cargo test test_transfer
```

### Run tests with output
```bash
cd contract
cargo test -- --nocapture
```

### Run tests in release mode (slower but more optimized)
```bash
cd contract
cargo test --release
```

## Test Structure

### Unit Tests (Tests in `mod test` blocks)

Located at the end of each contract's `lib.rs` or in a separate `test.rs` module.

**Example**: [myfans-token/src/test.rs](../contracts/myfans-token/src/test.rs)

```rust
#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::testutils::{Address as _, Ledger};
    use soroban_sdk::{Address, Env};

    #[test]
    fn test_basic_functionality() {
        // 1. Setup
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, MyContract);
        let client = MyContractClient::new(&env, &contract_id);

        // 2. Exercise
        let result = client.some_method(&arg);

        // 3. Assert
        assert_eq!(result, expected);
    }
}
```

### Test Organization

Tests should be organized by functionality:

```rust
#[cfg(test)]
mod test {
    // Test helper functions
    fn setup_env() -> (Env, Address, Address) {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let user = Address::generate(&env);
        (env, admin, user)
    }

    // Happy path tests
    #[test]
    fn test_transfer_success() { /* ... */ }
    
    #[test]
    fn test_mint_success() { /* ... */ }

    // Error condition tests
    #[test]
    fn test_insufficient_balance() { /* ... */ }
    
    #[test]
    fn test_zero_amount_fails() { /* ... */ }

    // Edge case tests
    #[test]
    fn test_max_balance() { /* ... */ }
}
```

## Key Testing Patterns

### 1. Environment Setup

Every test needs a Soroban test environment:

```rust
#[test]
fn test_example() {
    let env = Env::default();
    env.mock_all_auths();  // Bypass auth checks for testing
    
    // Register the contract
    let contract_id = env.register_contract(None, MyContract);
    let client = MyContractClient::new(&env, &contract_id);
}
```

### 2. Authorization Testing

Test that methods properly check authorization:

```rust
#[test]
fn test_admin_only_method() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    
    let contract_id = env.register_contract(None, MyContract);
    let client = MyContractClient::new(&env, &contract_id);
    
    client.initialize(&admin);
    
    // This should succeed (admin)
    client.admin_method(&admin);
    
    // This should fail (user is not admin)
    assert!(client.try_admin_method(&user).is_err());
}
```

### 3. State Verification

Use client methods to verify contract state changed correctly:

```rust
#[test]
fn test_balance_update() {
    let env = Env::default();
    env.mock_all_auths();
    
    let contract_id = env.register_contract(None, TokenContract);
    let client = TokenContractClient::new(&env, &contract_id);
    
    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    
    client.initialize(&admin, &String::from_str(&env, "Token"), &String::from_str(&env, "T"), &7, &0);
    
    // Check initial state
    assert_eq!(client.balance(&user), 0);
    
    // Mint tokens
    client.mint(&user, &1000);
    
    // Verify state changed
    assert_eq!(client.balance(&user), 1000);
    assert_eq!(client.total_supply(), 1000);
}
```

### 4. Error Testing

Test both success paths and error conditions:

```rust
#[test]
fn test_transfer_fails_insufficient_balance() {
    let env = Env::default();
    env.mock_all_auths();
    
    let contract_id = env.register_contract(None, TokenContract);
    let client = TokenContractClient::new(&env, &contract_id);
    
    let admin = Address::generate(&env);
    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);
    
    client.initialize(&admin, &String::from_str(&env, "Token"), &String::from_str(&env, "T"), &7, &0);
    client.mint(&user1, &100);
    
    // Attempt to transfer more than balance
    let result = client.try_transfer(&user1, &user2, &101);
    
    // Verify the expected error
    assert_eq!(result, Err(Ok(Error::InsufficientBalance)));
}
```

### 5. Cross-Contract Interaction

Test interactions between multiple contracts:

```rust
#[test]
fn test_subscription_with_token() {
    let env = Env::default();
    env.mock_all_auths();
    
    // Setup token contract
    let token_id = env.register_contract(None, MyFansToken);
    let token_client = MyFansTokenClient::new(&env, &token_id);
    
    // Setup subscription contract
    let subscription_id = env.register_contract(None, SubscriptionContract);
    let subscription_client = SubscriptionContractClient::new(&env, &subscription_id);
    
    let admin = Address::generate(&env);
    let creator = Address::generate(&env);
    let fan = Address::generate(&env);
    
    // Initialize contracts
    token_client.initialize(&admin, &String::from_str(&env, "MyFans"), &String::from_str(&env, "MYFANS"), &7, &0);
    subscription_client.initialize(&admin, &token_id);
    
    // Mint tokens to fan
    token_client.mint(&fan, &1000);
    
    // Fan subscribes
    subscription_client.subscribe(&fan, &creator, &100);
    
    // Verify subscription was created
    assert_eq!(subscription_client.get_subscription(&fan, &creator), Some(subscription));
}
```

### 6. Event Verification

Test that contracts emit expected events:

```rust
#[test]
fn test_transfer_emits_event() {
    let env = Env::default();
    env.mock_all_auths();
    
    let contract_id = env.register_contract(None, TokenContract);
    let client = TokenContractClient::new(&env, &contract_id);
    
    let admin = Address::generate(&env);
    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);
    
    client.initialize(&admin, &String::from_str(&env, "Token"), &String::from_str(&env, "T"), &7, &0);
    client.mint(&user1, &100);
    
    // Clear previous events
    env.events().all();
    
    // Execute transfer
    client.transfer(&user1, &user2, &50);
    
    // Verify event was emitted
    let events = env.events().all();
    assert_eq!(events.len(), 1);
}
```

## Test Coverage Goals

Aim for comprehensive coverage of:

- ✅ **Public methods**: All entry points should be tested
- ✅ **State changes**: Verify contract state updates correctly
- ✅ **Authorization**: Verify auth guards work properly
- ✅ **Error paths**: Test all error conditions
- ✅ **Edge cases**: Boundary values, zero amounts, overflow conditions
- ✅ **Cross-contract calls**: If contract calls other contracts, test the interaction

### Coverage Checklist for New Contracts

- [ ] Each public method has at least one test
- [ ] Authorization checks are tested (both allow and deny cases)
- [ ] Error conditions return expected error codes
- [ ] State changes are verified
- [ ] Events are emitted for significant state changes
- [ ] Cross-contract interactions work correctly
- [ ] Initialization requirements are tested
- [ ] Re-initialization is handled correctly (if applicable)

## CI Integration

### GitHub Actions Workflow

The contract CI workflow (`contract-ci.yml`) automatically:

1. Checks code formatting
2. Runs linting (clippy)
3. **Runs all tests** (`cargo test --all-features`)
4. Builds optimized WASM artifacts
5. Verifies WASM artifacts are produced

**Required status check**: `contract`

### Local Pre-commit Check

Run this before pushing to ensure CI will pass:

```bash
cd contract && \
  cargo fmt --all --check && \
  cargo clippy --all-targets --all-features -- -D warnings && \
  cargo test --all-features && \
  cargo build --release --target wasm32-unknown-unknown
```

### Continuous Regression Testing

- Every PR triggers the full test suite
- No merges allowed until all tests pass
- Tests are re-run before merge to catch any regressions

## Common Issues

### Test Times Out
**Symptom**: `test result: err` with no output
**Solution**: 
```bash
# Run with longer timeout and output
cargo test -- --nocapture --test-threads=1
```

### Auth Not Mocked
**Symptom**: `Error: InvokeHostFunction failed with ExecutionError`
**Solution**: Ensure `env.mock_all_auths()` is called in test setup

### Contract Registration Fails
**Symptom**: Panic when registering contract
**Solution**: Ensure the contract struct implements the right traits and derives

### State Not Persisting
**Symptom**: Assertions fail on state that was just set
**Solution**: Use the client's accessor methods to read state; don't create new clients

## Debugging Tests

### Print Test Output
```rust
#[test]
fn test_with_logging() {
    let env = Env::default();
    env.mock_all_auths();
    
    eprintln!("Starting test");
    // ... test code ...
}
```

Run with: `cargo test -- --nocapture`

### Inspect Contract State
```rust
let balance = client.balance(&user);
eprintln!("Balance: {}", balance);
```

### Use Test Utilities
```rust
use soroban_sdk::testutils::{Address as _, Events as _, Ledger};

// Mock time
env.ledger().set_timestamp(12345);

// Check ledger state
env.ledger().sequence();
```

## References

- [Soroban SDK Testing Docs](https://developers.stellar.org/docs/build/guides/testing)
- [soroban_sdk::testutils](https://docs.rs/soroban-sdk/latest/soroban_sdk/testutils/index.html)
- [Rust Testing](https://doc.rust-lang.org/book/ch11-00-testing.html)

## Contributing Tests

When submitting a PR with contract changes:

1. Add/update tests for any new functionality
2. Run `cargo test` locally to verify all tests pass
3. Ensure test coverage meets the goals above
4. Use descriptive test names and comments
5. Test both happy path and error conditions

The contract CI will verify your tests pass before merge.
