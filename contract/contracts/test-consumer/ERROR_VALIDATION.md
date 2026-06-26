# Error Code and Panic Message Validation

## Overview

The **test-consumer** contract is a read-only integration test harness with no custom error types. All public functions are view functions that cannot produce errors or panics.

## Public Functions Error Analysis

### `is_active`

- **Errors:** None. Always succeeds.
- **Panics:** None. Performs a simple equality check on a `SubscriptionStatus` enum.

### `error_code`

- **Errors:** None. Always succeeds.
- **Panics:** None. Performs a simple cast of a `MyfansError` enum to u32.

### `content_code`

- **Errors:** None. Always succeeds.
- **Panics:** None. Performs a simple cast of a `ContentType` enum to u32.

## Imported Error Types

The test-consumer imports and validates the following error types from other contracts:

### MyfansError (from `myfans-lib`)

| Code | Variant | Collision Risk |
|------|---------|----------------|
| 1 | `AlreadyInitialized` | ✓ No collision with earnings contract (earnings also uses code 1 for `AlreadyInitialized`, but they are separate contracts) |
| 2 | `NotInitialized` | ✓ Unique |
| 3 | `NotAuthorized` | ✓ Unique |
| 4 | `InsufficientBalance` | ✓ Unique |
| 5 | `InvalidFeeBps` | ✓ Unique |
| 6 | `RateLimited` | ✓ Unique |
| 7 | `AlreadyRegistered` | ✓ Unique |
| 8 | `NotLiked` | ✓ Unique |
| 9 | `Paused` | ✓ Unique |
| 101 | `ContentPriceNotSet` | ✓ Unique |
| 102 | `SubscriptionNotFound` | ✓ Unique |
| 103 | `SubscriptionExpired` | ✓ Unique |
| 104 | `AdminNotInitialized` | ✓ Unique |
| 105 | `NegativeMinBalance` | ✓ Unique |
| 106 | `MinBalanceViolation` | ✓ Unique |

**Numbering Scheme:**
- Codes 1–9: General contract state and authorization errors.
- Codes 100+: Content and subscription-specific errors.
- All codes are non-zero and unique within `MyfansError`.

**Collision Check with Earnings Contract:**
The earnings contract defines `Error::AlreadyInitialized = 1`. This is the only error code in the earnings contract. Since the earnings contract is a separate contract, there is no namespace collision (each contract has its own error type). Both contracts can use code 1 for `AlreadyInitialized` without conflict.

### Earnings Contract Error (from `earnings`)

| Code | Variant |
|------|---------|
| 1 | `AlreadyInitialized` |

**Validation:** The earnings contract error enum derives `#[contracterror]` and has a single unique non-zero code.

## Test Coverage

The test-consumer includes the following tests to validate error codes:

### `error_codes_are_stable` (lines 55–73)
Verifies that all `MyfansError` variants produce the expected error codes when cast to u32. This ensures that error codes remain stable across contract versions and that consumers can correctly interpret error responses.

### `earnings_double_init_fails` (lines 1286–1301)
Verifies that attempting to initialize the earnings contract twice returns error code 1 (`AlreadyInitialized`), confirming that the earnings contract error type is correctly defined and returns the expected code.

## Conclusion

- **test-consumer has no custom errors and cannot panic.**
- **All imported error types are correctly defined with unique, non-zero codes.**
- **Existing tests validate error code stability for all imported types.**
- **No changes required for error validation.**
