# Treasury Contract

A simple treasury contract for holding platform funds on Stellar/Soroban.

## Features

- **initialize**: Store admin and token address
- **deposit**: Users can deposit tokens (requires authorization)
- **withdraw**: Admin-only withdrawal with balance checks

## Functions

### `initialize(env, admin, token_address)`
Initializes the treasury with an admin and token address.
- Requires admin authorization
- Stores admin and token address in contract storage

### `deposit(env, from, amount)`
Deposits tokens into the treasury.
- Requires authorization from the depositor
- Transfers tokens from depositor to contract

### `withdraw(env, to, amount)`
Withdraws tokens from the treasury.
- Admin only (requires admin authorization)
- Checks for sufficient balance
- Reverts if balance is insufficient

## Tests

All tests are located in `src/test.rs`:

1. **test_deposit_and_withdraw**: Verifies deposit and withdrawal work correctly
2. **test_withdraw_insufficient_balance**: Verifies withdrawal reverts when balance is insufficient
3. **test_unauthorized_withdraw_reverts**: Verifies non-admin cannot withdraw

## Building and Testing

```bash
# Build the contract
cargo build --package treasury --target wasm32-unknown-unknown --release

# Run tests
cargo test --package treasury
```

## Acceptance Criteria

✅ Tokens can be deposited  
✅ Admin can withdraw  
✅ Unauthorized withdraw reverts  
✅ Insufficient balance reverts  
✅ All tests pass
