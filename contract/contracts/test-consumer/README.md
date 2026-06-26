# Test-Consumer Contract

## Overview

The **test-consumer** contract is an integration test harness that exercises the MyFans smart contract ecosystem from the perspective of an external caller. It verifies the importability, stability, and correctness of shared types (error codes, content types, subscription statuses) and tests cross-contract calls to other MyFans contracts, including the **earnings** contract.

This contract serves as a "canary" to ensure that breaking changes to shared types and cross-contract interfaces are caught before they propagate to real consumers.

## Public Functions

### `is_active`

**Signature:**
```rust
pub fn is_active(env: Env, status: SubscriptionStatus) -> bool
```

**Description:**
Returns `true` if and only if the supplied subscription status is `Active`. Used to verify that the `SubscriptionStatus` enum is importable and correctly discriminates active subscriptions.

**Authorization:**
No authorization required.

**Errors/Panics:**
None. Always returns successfully.

**Events:**
None.

---

### `error_code`

**Signature:**
```rust
pub fn error_code(env: Env, err: MyfansError) -> u32
```

**Description:**
Returns the numeric discriminant (error code) of a `MyfansError` variant. This function verifies that the error enum is importable and that all error codes are stable and non-zero. Consumers can use this to confirm that their own error handling matches the shared error codes.

**Authorization:**
No authorization required.

**Errors/Panics:**
None. Always returns successfully.

**Events:**
None.

---

### `content_code`

**Signature:**
```rust
pub fn content_code(env: Env, ct: ContentType) -> u32
```

**Description:**
Returns the numeric discriminant of a `ContentType` variant (e.g., `Free` → 0, `Paid` → 1). Verifies that the `ContentType` enum is importable and that all codes are stable.

**Authorization:**
No authorization required.

**Errors/Panics:**
None. Always returns successfully.

**Events:**
None.

---

## Cross-Contract Integration

### Earnings Contract

The test-consumer includes integration tests that exercise the **earnings** contract through the following public functions:

- **`init(admin: Address)`** – Initializes the earnings contract with an admin. Admin must authorize.
- **`admin() -> Address`** – Returns the stored admin address.
- **`record(creator: Address, amount: i128)`** – Records earnings for a creator. Admin must authorize. Panics if contract not initialized.
- **`get_earnings(creator: Address) -> i128`** – Returns the recorded earnings for a creator; defaults to 0 if not found.
- **`withdraw(creator: Address, amount: i128)`** – Withdraws earnings. Creator must authorize. Panics with "insufficient balance" if amount exceeds recorded balance. Emits a `withdraw` event with topics `(symbol "withdraw", creator)` and data `amount`.

The test-consumer verifies:
- Initialization and admin storage.
- Per-creator earnings accumulation (multiple record calls).
- Per-creator independence (different creators have different balances).
- Withdrawal lifecycle (record → withdraw → verify balance).
- Multiple withdrawals in sequence.
- Insufficient balance rejection.
- Event emission on withdrawal.

## Testing

All tests can be run with:
```bash
cargo test
```

The WASM build can be verified with:
```bash
cargo build --target wasm32-unknown-unknown --release
```

## Error Codes

The test-consumer does not define its own error types. It re-exports `MyfansError` from `myfans-lib` and tests the stability of those codes (see `error_code` function and the `error_codes_are_stable` test).

The earnings contract defines its own error type:

| Code | Variant | Description |
|------|---------|-------------|
| 1 | `AlreadyInitialized` | Attempt to initialize an already-initialized contract. |

## Notes

- The test-consumer is **not** meant to be deployed to production or integrated into other contracts. Its sole purpose is to serve as an integration test harness.
- All public functions are "view-only" in their observable effects—they do not mutate the test-consumer contract's own state.
- Earnings contract state (admin, per-creator balances) is tested but not persisted by the test-consumer itself; it is exercised through the earnings contract's storage.
