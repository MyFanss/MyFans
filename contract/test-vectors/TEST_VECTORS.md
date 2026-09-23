# Contract Test Vectors — Freighter / XDR Fingerprints

This document describes the shared test vector system that guards against drift
between the Soroban contract ABI and the TypeScript frontend builders
(Freighter integration).

---

## Problem

Contract builders in `frontend/src/lib/stellar.ts` encode Soroban transaction
arguments using `@stellar/stellar-sdk`. If a contract's method signature
changes (argument order, type, or name) and only the Rust side is updated,
the frontend silently passes wrong arguments — the transaction succeeds the
signing step in the wallet but fails on-chain.

**Shared test vectors** provide a single source of truth for argument shapes
that is tested by both the TypeScript vitest suite and (optionally) the Rust
`cargo test` suite.

---

## Files

| File | Purpose |
|---|---|
| `contract/test-vectors/contract-args.json` | Shared vector definitions — method name, arg names, types, order, and example values |
| `frontend/src/lib/__tests__/contract-test-vectors.test.ts` | TypeScript vitest tests that load the JSON and verify encoding correctness |

---

## What is covered

| Method | Vectors |
|---|---|
| `create_plan` | `create_plan_basic` (USDC), `create_plan_xlm` (XLM) |
| `subscribe` | `subscribe_basic` (plan_id=1), `subscribe_plan_zero` (edge case) |
| `cancel` | `cancel_basic` (reason=0), `cancel_reason_too_expensive` (reason=1) |

---

## How to regenerate after a contract interface change

1. **Update the contract** — change the method signature in Rust source.

2. **Update `stellar.ts`** — update the relevant builder in
   `frontend/src/lib/stellar.ts` to match the new arg order/types.

3. **Update `contract-args.json`** — change the affected vector's
   `arg_types`, `arg_order`, and/or `args` fields.

4. **Update `CANONICAL_ARG_ORDERS` and `CANONICAL_ARG_TYPES`** in
   `frontend/src/lib/__tests__/contract-test-vectors.test.ts`.

5. **Run the tests** to get new fingerprints:

   ```bash
   cd frontend
   npx vitest run src/lib/__tests__/contract-test-vectors.test.ts
   ```

   The bootstrap fingerprints (where `GOLDEN_FINGERPRINTS[id] === null`) will
   print the current fingerprint to stdout. Copy each value into the
   `GOLDEN_FINGERPRINTS` map to promote it from bootstrap to golden.

6. **Tick the checklist** — tick "Test vectors regenerated" in the PR template.

---

## Network passphrase

All vectors default to the **testnet** passphrase:

```
Test SDF Network ; September 2015
```

The passphrase is included in the JSON `network` object and is checked by the
vitest suite. Mainnet vectors are out of scope per issue #1644.

---

## CI

The CI job `contract-test-vectors` (in `.github/workflows/ci.yml`) runs:

```bash
npx vitest run src/lib/__tests__/contract-test-vectors.test.ts
```

This job is separate from the full `frontend-lint-test` job so failures give
targeted, actionable feedback ("XDR vector mismatch" vs. "lint error").

---

## Adding new vectors

1. Add a new entry to `contract/test-vectors/contract-args.json`.
2. If it covers a new method, add entries to `CANONICAL_ARG_ORDERS` and
   `CANONICAL_ARG_TYPES` in the test file.
3. Add `null` to `GOLDEN_FINGERPRINTS` for the new vector id, run the tests,
   then replace `null` with the printed fingerprint.
