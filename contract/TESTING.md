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
  production contracts.

### Happy path: subscription → treasury → registry

```rust
#[test]
fn consumer_subscribe_happy_path() {
    let env = Env::default();
    // Do NOT call env.mock_all_auths() here: we want the real auth tree.

    let (consumer_id, consumer) = register_consumer(&env);
    let (sub_id, sub) = register_subscription(&env);
    let (treasury_id, treasury) = register_treasury(&env);
    let (registry_id, registry) = register_registry(&env);

    let fan = Address::generate(&env);
    let creator = Address::generate(&env);

    // The consumer invokes subscribe as an external contract; the fan authorizes
    // the consumer, and the consumer authorizes the downstream calls.
    env.mock_auths(&[MockAuth {
        address: &fan,
        invoke: &MockAuthInvoke {
            contract: &consumer_id,
            fn_name: "subscribe",
            args: (fan.clone(), creator.clone(), 100i128).into_val(&env),
            sub_invokes: &[],
        },
    }]);

    consumer.subscribe(&fan, &creator, &100);

    // Assert the downstream contracts observed the expected state.
    assert!(sub.get_subscription(&fan, &creator).is_some());
    assert_eq!(treasury.balance(&creator), 100);
    assert!(registry.is_registered(&creator));
}
```

### Negative case: wrong contract id

```rust
#[test]
fn consumer_rejects_wrong_contract_id() {
    let env = Env::default();
    let (consumer_id, consumer) = register_consumer(&env);
    let (sub_id, _sub) = register_subscription(&env);

    let fan = Address::generate(&env);
    let creator = Address::generate(&env);

    // Authorize a *different* contract id than the one being invoked.
    let wrong_id = Address::generate(&env);
    env.mock_auths(&[MockAuth {
        address: &fan,
        invoke: &MockAuthInvoke {
            contract: &wrong_id,
            fn_name: "subscribe",
            args: (fan.clone(), creator.clone(), 100i128).into_val(&env),
            sub_invokes: &[],
        },
    }]);

    // The auth footprint does not match the invocation tree, so the call must fail.
    assert!(consumer.try_subscribe(&fan, &creator, &100).is_err());
}
```

### Negative case: paused callee

```rust
#[test]
fn consumer_fails_when_callee_paused() {
    let env = Env::default();
    let (consumer_id, consumer) = register_consumer(&env);
    let (sub_id, sub) = register_subscription(&env);

    let admin = Address::generate(&env);
    sub.pause(&admin);

    let fan = Address::generate(&env);
    let creator = Address::generate(&env);

    env.mock_auths(&[MockAuth {
        address: &fan,
        invoke: &MockAuthInvoke {
            contract: &consumer_id,
            fn_name: "subscribe",
            args: (fan.clone(), creator.clone(), 100i128).into_val(&env),
            sub_invokes: &[],
        },
    }]);

    // A paused callee must reject the cross-contract call.
    assert!(consumer.try_subscribe(&fan, &creator, &100).is_err());
}
```

### Adding a new consumer test

1. Register the consumer plus every contract in the invocation tree with
   `env.register_contract`.
2. Build the auth tree with `env.mock_auths(&[...])` and `MockAuthInvoke::sub_invokes` so the
   footprint mirrors the production call graph. Do **not** use `env.mock_all_auths()`.
3. Invoke the consumer entry point (not the downstream contract directly) so the
   cross-contract call is exercised.
4. Assert both the downstream state and, for negative cases, that the call returns `Err`.
5. Cover at least one happy path and the negative cases (wrong contract id, paused callee)
   for every new cross-contract flow.

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
