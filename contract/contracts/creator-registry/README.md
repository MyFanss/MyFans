# Creator Registry Contract

Soroban smart contract for registering and looking up MyFans creators, with
admin-gated control, anti-spam rate limiting, and an optional registration
fee.

## Features

- **initialize**: Set up the contract with an admin address
- **register_creator**: Admin or the creator themself registers a `creator_id`, rate-limited per caller
- **unregister_creator**: Admin removes a creator's registration
- **get_creator_id**: Look up a creator's `creator_id` by address
- **Anti-spam**: Configurable minimum ledger gap between registrations per caller, plus an optional token fee on registration

## Functions

### initialize
```rust
pub fn initialize(env: Env, admin: Address)
```
Initialize the contract with an admin address. Also sets the default rate
limit (10 ledgers) and a zero spam fee.

**Parameters:**
- `admin` - Admin address

**Auth:** `admin` (`require_auth`)

**Errors:**
- `Error::AlreadyInitialized` - contract was already initialized

### set_rate_limit
```rust
pub fn set_rate_limit(env: Env, ledgers: u32)
```
Stores a minimum-ledger-gap value for registrations from the same caller.
Admin only.

**Parameters:**
- `ledgers` - minimum ledger gap between registrations per caller

**Auth:** admin (`require_auth`)

> **Known limitation:** `register_creator`'s rate-limit check currently
> always uses the hardcoded `DEFAULT_RATE_LIMIT` (10 ledgers) rather than
> the value stored by this function, so calling `set_rate_limit` does not
> yet change registration behavior.

### set_spam_fee
```rust
pub fn set_spam_fee(env: Env, token: Address, amount: i128)
```
Set a token fee charged to the caller on each registration. Admin only.

**Parameters:**
- `token` - token contract address the fee is paid in
- `amount` - fee amount; must be non-negative

**Auth:** admin (`require_auth`)

**Errors:**
- `Error::InvalidAmount` - `amount` is negative

### register_creator
```rust
pub fn register_creator(env: Env, caller: Address, creator_address: Address, creator_id: u64)
```
Register `creator_address` with `creator_id`. Can only be called by the
admin or by the creator themself.

**Parameters:**
- `caller` - the address invoking registration (must authorize the transaction)
- `creator_address` - the creator address being registered
- `creator_id` - the numeric ID to associate with `creator_address`

**Behavior:**
- `caller` must authorize the transaction
- Rejects callers other than the admin or `creator_address` itself
- Rate limited: rejects if `caller` registered within the last `DEFAULT_RATE_LIMIT` (10) ledgers (see known limitation under `set_rate_limit` above)
- Rejects if `creator_address` is already registered
- Rejects if `creator_id` is already claimed by a different `creator_address` (creator_id is globally unique)
- If a spam fee is configured, transfers it from `caller` to the contract **before** the registration is persisted, so a failed transfer never leaves a registered-but-unpaid creator
- Extends the persistent TTL on the `Creator` and reverse `CreatorIdOwner` entries (see [TTL Policy](#ttl-policy))

**Auth:** `caller` (`require_auth`)

**Errors:**
- `Error::NotInitialized` - contract was never initialized
- `Error::Unauthorized` - `caller` is neither admin nor `creator_address`
- `Error::RateLimited` - `caller` registered too recently
- `Error::AlreadyRegistered` - `creator_address` is already registered
- `Error::CreatorIdTaken` - `creator_id` is already owned by a different `creator_address`

### unregister_creator
```rust
pub fn unregister_creator(env: Env, creator_address: Address)
```
Remove `creator_address`'s registration. Admin only.

**Parameters:**
- `creator_address` - the creator address to unregister

**Auth:** admin (`require_auth`)

**Panics:** if the contract isn't initialized, or `creator_address` isn't registered

### admin
```rust
pub fn admin(env: Env) -> Address
```
Read-only getter for the configured admin address. Any caller may invoke this.

**Returns:**
- the admin `Address`

**Errors:**
- `Error::NotInitialized` - contract was never initialized

### get_creator_id
```rust
pub fn get_creator_id(env: Env, address: Address) -> Option<u64>
```
Look up a creator's `creator_id` by their registered address. Any caller may
invoke this. If `address` is registered, this also extends the persistent
TTL on its `Creator` entry (see [TTL Policy](#ttl-policy)).

**Parameters:**
- `address` - the address to look up

**Returns:**
- `Some(creator_id)` if `address` is registered, `None` otherwise

## Storage

Uses the enum-based `DataKey` pattern:
- `DataKey::Admin` - admin address
- `DataKey::Creator(address)` - registered creator address → `creator_id`
- `DataKey::LastRegLedger(address)` - last ledger a caller registered at (used for rate limiting; canonical accessor is `DataKey::registration_ledger`)
- `DataKey::CreatorIdOwner(creator_id)` - reverse mapping, `creator_id` → owner address, enforced to be globally unique
- `DataKey::RateLimit` - configured minimum ledger gap between registrations
- `DataKey::SpamFee` - configured registration fee amount
- `DataKey::FeeToken` - token contract address the fee is paid in

## TTL Policy

`DataKey::Creator` and `DataKey::CreatorIdOwner` are persistent entries and are
never touched by `set_rate_limit`/`set_spam_fee` traffic, so without an
explicit bump they risk falling below the network's minimum TTL and being
archived. On every registration (write) and every successful
`get_creator_id` lookup (read), the contract calls
`extend_ttl(key, CREATOR_TTL_THRESHOLD, CREATOR_TTL_EXTEND_TO)` on both keys:
once an entry's remaining TTL drops below `CREATOR_TTL_THRESHOLD` (10,000
ledgers), it is refreshed back up to `CREATOR_TTL_EXTEND_TO` (100,000
ledgers). `DataKey::LastRegLedger` (the rate-limit stamp) is out of scope for
this policy since it is short-lived by design.

## Tests

Run tests:
```bash
cargo test
```

### Test Coverage

1. **test_initialize** - Contract initialization
2. **test_admin_getter_returns_initialized_admin** - Admin getter
3. **test_register_and_lookup_self** - Creator registers themself, then looks up their own ID
4. **test_register_and_lookup_admin** - Admin registers a creator on their behalf
5. **test_unauthorized_registration** - Rejects callers who are neither admin nor the creator
6. **test_duplicate_registration_reverts** - Rejects re-registering an already-registered creator
7. **test_rate_limit_same_caller_within_window_fails** - Rate limit enforcement within the window
8. **test_rate_limit_after_window_succeeds** - Registration succeeds again after the rate-limit window passes
9. **test_registration_ledger_key_helper_keeps_legacy_variant** - `DataKey::registration_ledger` serializes to the legacy `LastRegLedger` variant
10. **test_registration_fee_transfers_to_contract** - Spam fee is transferred from caller to contract on registration
11. **test_registration_fee_insufficient_balance_reverts** - Registration fails if caller can't cover the spam fee
12. **test_registration_fee_zero_allows_free_registration** - Registration succeeds with no fee transfer when the fee is zero
13. **initialize_requires_admin_auth** - `initialize` reverts without the admin's authorization and succeeds with it
14. **duplicate_creator_id_from_different_address_reverts** - A second address cannot claim an already-registered `creator_id`
15. **different_creator_ids_succeed** - Distinct addresses registering distinct `creator_id`s both succeed
16. **creator_id_freed_after_unregister_can_be_reused** - Unregistering frees a `creator_id` for reuse by another address
17. **failed_fee_transfer_leaves_no_creator_or_reverse_mapping** - A failed spam-fee transfer leaves neither the `Creator` nor `CreatorIdOwner` entries written
18. **register_creator_extends_ttl_on_creator_keys** - Registration extends the TTL on the `Creator` and `CreatorIdOwner` keys
19. **get_creator_id_refreshes_ttl_after_it_decays_below_threshold** - A lookup refreshes the TTL once it decays below the threshold

## Interface Docs

Full method reference: [../../docs/interfaces/creator-registry.md](../../docs/interfaces/creator-registry.md)

## Usage Example

```rust
let admin = Address::generate(&env);
let creator = Address::generate(&env);

// Initialize
client.initialize(&admin);

// Creator registers themself
client.register_creator(&creator, &creator, &456);

// Look up creator_id
assert_eq!(client.get_creator_id(&creator), Some(456));

// Admin removes the registration
client.unregister_creator(&creator);
assert_eq!(client.get_creator_id(&creator), None);
```

## Integration

This contract works with:
- Token contracts (for the optional registration spam fee)
- Backend services (to resolve a creator's address to its `creator_id`)
