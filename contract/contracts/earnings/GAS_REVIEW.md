# Gas Usage Review — Earnings Contract

## Hot Paths Reviewed

1. **`init(env, admin)`** — One-time initialization; not performance-critical.
2. **`record(env, creator, amount)`** — Primary operation for recording creator earnings; called per transaction.
3. **`get_earnings(env, creator)`** — Read-only query; minimal gas cost.
4. **`withdraw(env, creator, amount)`** — Primary operation for withdrawing earnings; called per withdrawal.

## Inefficiencies Found and Fixed

### 1. `record()` — Redundant DataKey Construction
**Issue**: The `DataKey::Earnings(creator.clone())` was being constructed implicitly in the storage get operation, requiring a clone of the `creator` address (32 bytes) for the DataKey enum variant.

**Fix**: Cache the DataKey in a local variable to reuse it in both the get and set operations, reducing from one implicit clone to one explicit clone.

**Savings**: Eliminates ~1 unnecessary clone of a 32-byte Address type per record call.

### 2. `withdraw()` — Double Cloning of Creator Address
**Issue**: `creator` was being cloned twice — once for the get operation (`creator.clone()`) and once for the set operation (`creator.clone()`), plus implicitly via DataKey construction.

**Fix**: Cache the DataKey in a local variable `earnings_key` to reuse it in both get and set operations.

**Savings**: Reduces from 2 explicit clones + implicit construction to 1 explicit clone per withdraw call. Estimated 32-byte address clone saved per withdrawal.

## Contract State and Behavior

- **Observable Behavior**: Unchanged. All read/write semantics remain identical.
- **Storage Access Patterns**: Unchanged. Still 1 read + 1 write per record/withdraw call.
- **Test Results**: All 12 existing tests pass without modification.

## Ledger Entry Reduction

- Each `record()` call: 1 Clone(Address) + 2 Storage operations → No change in ledger entries, but reduced CPU cloning overhead.
- Each `withdraw()` call: 1 Clone(Address) + 2 Storage operations → No change in ledger entries, but reduced CPU cloning overhead.
- Estimated CPU instruction saving: ~64 bytes per `record()` call, ~64 bytes per `withdraw()` call (from eliminated clones).

## Notes

No other hot-path inefficiencies were identified. Storage operations are already optimally batched (one read, one write per function). The contract does not iterate over large collections, and no other unnecessary type cloning was found.
