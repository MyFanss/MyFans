# MyFans Token Contract

Soroban smart contract for the MyFans platform's fungible token (MFAN). Implements a standard token interface with administrative controls, approval mechanism, and metadata updatability.

## Features

- **initialize**: Set up the token with admin, name, symbol, decimals, and initial supply.
- **admin**: Retrieve the current admin address.
- **set_admin**: Transfer admin privileges to another address (requires current admin auth).
- **set_metadata**: Update token name and symbol (admin only).
- **name**: Get the token name.
- **symbol**: Get the token symbol.
- **decimals**: Get the token decimals.
- **total_supply**: Get the total token supply.
- **approve**: Approve an allowance for a spender to transfer tokens on behalf of the owner.
- **transfer_from**: Transfer tokens from one account to another using an allowance.
- **clear_allowance**: Reset an allowance to zero.
- **allowance**: Check the remaining allowance for a spender.
- **mint**: Mint new tokens (admin only).
- **burn**: Destroy tokens from the caller's balance.
- **balance**: Get the token balance of an account.
- **transfer**: Transfer tokens from the caller to another address.

## Functions

### initialize
```rust
pub fn initialize(
    env: Env,
    admin: Address,
    name: String,
    symbol: String,
    decimals: u32,
    initial_supply: i128,
)
```
Initialize the contract with admin and token metadata. This function must be called once before any other functions.

**Parameters:**
- `admin` - Admin address authorized to manage the token (mint, set_admin, set_metadata).
- `name` - Token name (e.g., "MyFans Token").
- `symbol` - Token symbol (e.g., "MFAN").
- `decimals` - Number of decimal places (typically 7 for Soroban tokens).
- `initial_supply` - Initial token supply to be minted to the admin account (actual minting is deferred to Issue 3, but total supply is set).

### admin
```rust
pub fn admin(env: Env) -> Address
```
Get the current admin address.

**Returns:**
- The admin address.

### set_admin
```rust
pub fn set_admin(env: Env, new_admin: Address)
```
Transfer admin privileges to a new address. Requires authorization from the current admin.

**Parameters:**
- `new_admin` - The address to become the new admin.

### set_metadata
```rust
pub fn set_metadata(env: Env, new_name: String, new_symbol: String)
```
Update the token's name and symbol. Only callable by the admin. Decimals remain immutable.

**Parameters:**
- `new_name` - New token name.
- `new_symbol` - New token symbol.

### name
```rust
pub fn name(env: Env) -> String
```
Get the token name.

**Returns:**
- The token name.

### symbol
```rust
pub fn symbol(env: Env) -> String
```
Get the token symbol.

**Returns:**
- The token symbol.

### decimals
```rust
pub fn decimals(env: Env) -> u32
```
Get the token decimals.

**Returns:**
- The number of decimal places.

### total_supply
```rust
pub fn total_supply(env: Env) -> i128
```
Get the total token supply.

**Returns:**
- The total supply of tokens in circulation.

### approve
```rust
pub fn approve(
    env: Env,
    from: Address,
    spender: Address,
    amount: i128,
    expiration_ledger: u32,
) -> Result<(), Error>
```
Approve a spender to transfer tokens on behalf of the owner, with an expiration.

**Parameters:**
- `from` - The token owner authorizing the spender (must authorize this transaction).
- `spender` - The address authorized to transfer tokens.
- `amount` - The amount of tokens approved for transfer.
- `expiration_ledger` - The ledger at which the approval expires.

**Returns:**
- `Ok(())` on success, or an `Error` if:
  - `from` does not authorize the transaction (handled by `require_auth`).
  - `amount` is negative (`Error::InvalidAmount`).
  - `expiration_ledger` is in the past (`Error::InvalidExpiration`).

**Behavior:**
- Stores allowance data in temporary storage with a TTL extended to allow reading after expiration.
- Emits an `approve` event.

### transfer_from
```rust
pub fn transfer_from(
    env: Env,
    spender: Address,
    from: Address,
    to: Address,
    amount: i128,
) -> Result<(), Error>
```
Transfer tokens from one account to another using an approved allowance. The spender must authorize this transaction.

**Parameters:**
- `spender` - The address initiating the transfer (must have been approved by `from` and authorize this transaction).
- `from` - The token owner's address.
- `to` - The recipient address.
- `amount` - The amount of tokens to transfer.

**Returns:**
- `Ok(())` on success, or an `Error` if:
  - `spender` does not authorize the transaction.
  - `amount` is not positive (`Error::InvalidAmount`).
  - No allowance exists for `(from, spender)` (`Error::NoAllowance`).
  - The allowance has expired (`Error::AllowanceExpired`).
  - The allowance amount is insufficient (`Error::InsufficientAllowance`).
  - The `from` account has insufficient balance (`Error::InsufficientBalance`).

**Behavior:**
- Deducts the amount from the allowance.
- Transfers tokens from `from` to `to` by updating balances.
- Emits a `transfer_from` event to distinguish from ordinary `transfer` events.

### clear_allowance
```rust
pub fn clear_allowance(env: Env, from: Address, spender: Address)
```
Set the allowance for `(from, spender)` to zero. The token owner (`from`) must authorize this transaction.

**Parameters:**
- `from` - The token owner who granted the allowance (must authorize).
- `spender` - The spender whose allowance is being cleared.

**Behavior:**
- Sets the allowance amount to 0 with expiration set to the current ledger.
- Emits an `approve` event with amount 0.

### allowance
```rust
pub fn allowance(env: Env, from: Address, spender: Address) -> i128
```
Get the remaining allowance that `spender` is allowed to transfer from `from`.

**Parameters:**
- `from` - The token owner address.
- `spender` - The spender address.

**Returns:**
- The amount of tokens the spender is allowed to transfer (0 if none or expired).

### mint
```rust
pub fn mint(env: Env, to: Address, amount: i128) -> Result<(), Error>
```
Mint new tokens and add them to `to`'s balance. Only callable by the admin.

**Parameters:**
- `to` - The address receiving the newly minted tokens.
- `amount` - The amount of tokens to mint.

**Returns:**
- `Ok(())` on success, or an `Error` if:
  - The caller is not the admin (`Error::Unauthorized`).
  - `amount` is zero or negative (`Error::InvalidAmount`).

**Behavior:**
- Increases the balance of `to` by `amount`.
- Increases the total supply by `amount`.
- Emits a `mint` event.

### burn
```rust
pub fn burn(env: Env, from: Address, amount: i128) -> Result<(), Error>
```
Destroy tokens from the caller's balance.

**Parameters:**
- `from` - The address whose tokens will be burned (must authorize this transaction).
- `amount` - The amount of tokens to burn.

**Returns:**
- `Ok(())` on success, or an `Error` if:
  - `from` does not authorize the transaction.
  - `amount` is zero or negative (`Error::InvalidAmount`).
  - The `from` account has insufficient balance (`Error::InsufficientBalance`).

**Behavior:**
- Decreases the balance of `from` by `amount`.
- Decreases the total supply by `amount`.
- Emits a `burn` event.

### balance
```rust
pub fn balance(env: Env, id: Address) -> i128
```
Get the token balance of an address.

**Parameters:**
- `id` - The address to query.

**Returns:**
- The token balance of the address.

### transfer
```rust
pub fn transfer(
    env: Env,
    from: Address,
    to: Address,
    amount: i128,
) -> Result<(), Error>
```
Transfer tokens from the caller to another address. The caller must authorize this transaction.

**Parameters:**
- `from` - The address sending tokens (must authorize this transaction).
- `to` - The recipient address.
- `amount` - The amount of tokens to transfer.

**Returns:**
- `Ok(())` on success, or an `Error` if:
  - `from` does not authorize the transaction.
  - `amount` is zero or negative (`Error::InvalidAmount`).
  - The `from` account has insufficient balance (`Error::InsufficientBalance`).

**Behavior:**
- Transfers tokens from `from` to `to` by updating balances.
- Emits a `transfer` event.

## Storage

The contract uses persistent and temporary storage with the following `DataKey` enum:

- `DataKey::Admin` - Admin address (persistent).
- `DataKey::Name` - Token name (persistent).
- `DataKey::Symbol` - Token symbol (persistent).
- `DataKey::Decimals` - Token decimals (persistent).
- `DataKey::TotalSupply` - Total token supply (persistent).
- `DataKey::Balance(address)` - Balance of an address (persistent).
- `DataKey::Allowance(AllowanceValueKey)` - Allowance data (temporary), where `AllowanceValueKey` contains `from` and `spender` addresses.

Temporary storage entries for allowances have their TTL extended to remain readable until at least one ledger after expiration, allowing the contract to return `Error::AllowanceExpired` instead of `Error::NoAllowance` for expired allowances.

## Tests

Run tests:
```bash
cargo test
```

The contract includes unit tests, property tests, and specific test modules for allowance expiration, error codes, and gas usage.

## Acceptance Criteria

- Contract tests and WASM release build pass in CI.
- No regressions in closely related user or API flows.
- All public functions are documented in this README.
- Handle stale, disconnected, or invalid states gracefully (e.g., expired allowances, insufficient balances).

## Interface Docs

This README serves as the primary interface documentation for the contract.

## Usage Example

```rust
let admin = Address::generate(&env);
let token_address = Address::generate(&env);
let user1 = Address::generate(&env);
let user2 = Address::generate(&env);

// Initialize the token (supply of 1,000,000 MFAN with 7 decimals)
client.initialize(
    &admin,
    &"MyFans Token".into(),
    &"MFAN".into(),
    &7,
    &1_000_000_0000000, // 1,000,000 * 10^7
);

// Admin mints additional tokens to user1
client.mint(&user1, &500_000_0000000); // 500,000 MFAN

// User1 approves user2 to spend 100 tokens
user1.require_auth(); // In actual test, this is done via client.invoke(&user1, &Symbol::short("approve"), ...)
client.approve(&user1, &user2, &100_0000000, &(env.ledger().sequence() + 100)); // 100 tokens

// User2 transfers 50 tokens from user1 to themselves
user2.require_auth();
client.transfer_from(&user2, &user1, &user2, &50_0000000); // 50 tokens

// Check balances
assert_eq!(client.balance(&user1), &450_0000000); // 500,000 - 50
assert_eq!(client.balance(&user2), &50_0000000);

// Check allowance
assert_eq!(client.allowance(&user1, &user2), &50_0000000); // 100 - 50
```

Note: In the example above, `require_auth` calls are shown for clarity, but in actual contract invocation, the authorization is handled by the Soroban host when the transaction is signed by the respective address.

## Integration

This contract works with:
- Other MyFans contracts (e.g., treasury, subscriptions) for token payments.
- Frontend applications (to display token balances and facilitate transfers).
- Backend services (to index token events and monitor activity).