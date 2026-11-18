# Contract Testing Guide

This guide covers testing strategies, patterns, and best practices for MyFans Soroban smart contracts.

## Overview

Contract testing ensures:
- **Correctness**: Logic behaves as designed
- **Security**: Edge cases and invalid inputs are handled safely
- **Regressions**: Changes don't break existing functionality
- **Integration**: Cross-contract calls work properly

Tests run in the isolated Soroban test environment and do not require network access.

## Ledger Time

Soroban contracts measure time in **ledgers**, not wall-clock seconds. On the network this
app targets, one ledger is produced roughly every **five seconds**. So a duration expressed
in ledgers is about `seconds / 5` ledgers.

The subscription contract defines `PERIOD_LEDGERS` in
[`contracts/subscription/src/lib.rs`](contracts/subscription/src/lib.rs) as `17_280`, which
is about one day at a five-second ledger (`17_280 * 5 = 86_400` seconds). Expiry tests
compare against this constant, so they advance the ledger by a number of ledgers rather than
by seconds.

In `soroban_sdk` tests, move time forward with `Env::ledger().set_sequence` (via the
`Ledger` testutils trait):

```rust
use soroban_sdk::testutils::Ledger;

#[test]
fn test_subscription_expires_after_period() {
    let env = Env::default();
    env.mock_all_auths();

    // ... set up and create the subscription ...

    // Advance the ledger by one subscription period (about one day).
    env.ledger().set_sequence(env.ledger().sequence() + PERIOD_LEDGERS);

    // The subscription should now be expired.
    assert!(client.is_expired(&fan, &creator));
}
```

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

### Run the cross-contract auth consumer tests
```bash
cd contract
cargo test -p test-consumer
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

## Cross-Contract Auth Testing (`test-consumer`)

Unit tests that call `env.mock_all_auths()` bypass the authorization tree entirely, so they
cannot catch cross-contract auth footguns (wrong contract id, paused callee, missing
sub-invocations). The `test-consumer` crate is a Cargo member that acts as an **external
consumer contract**: it invokes the subscription, treasury, and registry contracts the same
way production callers do, so the recorded auth footprint matches the real invocation tree.

### Why a separate consumer contract

- The consumer is a real contract, so `require_auth` on the callee is exercised through an
  actual cross-contract call rather than a mocked top-level auth.
- Auth footprints are asserted against the production invocation tree instead of being
  blanket-approved with `mock_all_auths()`.
- Negative cases (wrong contract id, paused callee) are reproducible without touching the
  producti

/* … truncated 4614 chars — edit only what you need near the top … */
