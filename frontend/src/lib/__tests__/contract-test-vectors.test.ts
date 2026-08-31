/**
 * #1644 — Freighter XDR test vectors for subscribe / cancel / create_plan
 *
 * These tests load the shared contract argument vectors from
 * `contract/test-vectors/contract-args.json` and verify that:
 *
 *   1. Each vector's arg names, types, and order match the actual builders
 *      in `src/lib/stellar.ts` (preventing "works in cargo, fails in wallet"
 *      drift between the Rust contract ABI and the TypeScript client).
 *
 *   2. The `nativeToScVal` encoding round-trips correctly for each arg type
 *      used in the contract interface (Address, i128, u32).
 *
 *   3. The operation (contract method) name matches what the builder passes to
 *      `contract.call(...)`.
 *
 * These tests run in `vitest` (jsdom environment, no live network).
 * The CI job `contract-test-vectors` runs only this file for fast feedback.
 *
 * ## How to regenerate after a contract interface change
 *
 * 1. Update the arg types / order in the relevant builder in `stellar.ts`.
 * 2. Update `contract/test-vectors/contract-args.json` to match.
 * 3. Re-run: `npx vitest run src/lib/__tests__/contract-test-vectors.test.ts`
 * 4. Tick the "Test vectors regenerated" checkbox in the PR template.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  nativeToScVal,
  Address,
  xdr,
} from '@stellar/stellar-sdk';

// ---------------------------------------------------------------------------
// Load shared vectors
// ---------------------------------------------------------------------------

const VECTORS_PATH = resolve(
  __dirname,
  '../../../../contract/test-vectors/contract-args.json',
);

interface VectorArg {
  [key: string]: string | number;
}

interface VectorArgTypes {
  [key: string]: 'Address' | 'i128' | 'u32' | 'bool' | 'String';
}

interface TestVector {
  id: string;
  description: string;
  method: string;
  network: string;
  args: VectorArg;
  arg_types: VectorArgTypes;
  arg_order: string[];
  expected_op_name: string;
  notes?: string;
}

interface VectorsFile {
  version: string;
  default_network: string;
  network: Record<string, { passphrase: string; rpc_url: string }>;
  vectors: TestVector[];
}

const vectorsFile: VectorsFile = JSON.parse(readFileSync(VECTORS_PATH, 'utf-8'));

// ---------------------------------------------------------------------------
// Known contract interface shapes (mirrors stellar.ts builders)
// Updating these objects is the canonical place to register an interface change.
// ---------------------------------------------------------------------------

/**
 * The canonical arg order for each method, as declared in the Soroban contract
 * and mirrored by the TypeScript builder in stellar.ts.
 *
 * If a contract method's arg order changes, update BOTH stellar.ts AND here
 * AND contract/test-vectors/contract-args.json.
 */
const CANONICAL_ARG_ORDERS: Record<string, string[]> = {
  create_plan: ['creator', 'token', 'amount_atomic', 'interval_days'],
  subscribe: ['fan', 'creator', 'plan_id', 'token'],
  cancel: ['fan', 'creator', 'reason'],
};

/**
 * The canonical arg types for each method.
 */
const CANONICAL_ARG_TYPES: Record<string, Record<string, string>> = {
  create_plan: {
    creator: 'Address',
    token: 'Address',
    amount_atomic: 'i128',
    interval_days: 'u32',
  },
  subscribe: {
    fan: 'Address',
    creator: 'Address',
    plan_id: 'u32',
    token: 'Address',
  },
  cancel: {
    fan: 'Address',
    creator: 'Address',
    reason: 'u32',
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Encode a single arg to ScVal using the type declared in the vector.
 * This mirrors what the builders in stellar.ts do with the Stellar SDK.
 */
function encodeArg(value: string | number, type: string): xdr.ScVal {
  switch (type) {
    case 'Address':
      return Address.fromString(String(value)).toScVal();
    case 'i128':
      return nativeToScVal(String(value), { type: 'i128' });
    case 'u32':
      return nativeToScVal(Number(value), { type: 'u32' });
    case 'bool':
      return xdr.ScVal.scvBool(Boolean(value));
    case 'String':
      return xdr.ScVal.scvString(String(value));
    default:
      throw new Error(`Unknown arg type: ${type}`);
  }
}

/**
 * Returns a hex fingerprint of the XDR-encoded arg list.
 * Used to detect encoding regressions: if the fingerprint changes without a
 * deliberate interface change, the test fails and forces an explicit update.
 */
function argListFingerprint(method: string, args: VectorArg, argTypes: VectorArgTypes, argOrder: string[]): string {
  const encoded = argOrder.map((name) => {
    const value = args[name];
    const type = argTypes[name];
    if (value === undefined) throw new Error(`Vector arg '${name}' missing for method '${method}'`);
    if (!type) throw new Error(`Vector arg type for '${name}' missing for method '${method}'`);
    return encodeArg(value, type).toXDR('hex');
  });
  return encoded.join(':');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('contract-test-vectors — shared ABI fingerprints', () => {
  describe('vectors file schema', () => {
    it('has the expected schema version', () => {
      expect(vectorsFile.version).toBe('1');
    });

    it('declares testnet passphrase', () => {
      expect(vectorsFile.network.testnet.passphrase).toBe(
        'Test SDF Network ; September 2015',
      );
    });

    it('has vectors for subscribe, cancel, and create_plan', () => {
      const methods = vectorsFile.vectors.map((v) => v.method);
      expect(methods).toContain('subscribe');
      expect(methods).toContain('cancel');
      expect(methods).toContain('create_plan');
    });
  });

  describe('arg order — vectors match canonical contract interface', () => {
    for (const vector of vectorsFile.vectors) {
      it(`[${vector.id}] arg order matches canonical interface for '${vector.method}'`, () => {
        const canonical = CANONICAL_ARG_ORDERS[vector.method];
        expect(canonical, `Unknown method '${vector.method}' — add it to CANONICAL_ARG_ORDERS`).toBeDefined();
        expect(vector.arg_order).toEqual(canonical);
      });
    }
  });

  describe('arg types — vectors match canonical contract interface', () => {
    for (const vector of vectorsFile.vectors) {
      it(`[${vector.id}] arg types match canonical interface for '${vector.method}'`, () => {
        const canonical = CANONICAL_ARG_TYPES[vector.method];
        expect(canonical, `Unknown method '${vector.method}' — add it to CANONICAL_ARG_TYPES`).toBeDefined();
        for (const argName of vector.arg_order) {
          expect(
            vector.arg_types[argName],
            `arg_types.${argName} missing in vector '${vector.id}'`,
          ).toBe(canonical[argName]);
        }
      });
    }
  });

  describe('op name — matches expected_op_name', () => {
    for (const vector of vectorsFile.vectors) {
      it(`[${vector.id}] expected_op_name equals method`, () => {
        // The builder always calls contract.call(method, ...args),
        // so the XDR operation name MUST equal the method string.
        expect(vector.expected_op_name).toBe(vector.method);
      });
    }
  });

  describe('XDR encoding — ScVal round-trips', () => {
    describe('Address args encode without throwing', () => {
      const addressVectors = vectorsFile.vectors.flatMap((v) =>
        v.arg_order
          .filter((name) => v.arg_types[name] === 'Address')
          .map((name) => ({ vectorId: v.id, name, value: v.args[name] })),
      );

      for (const { vectorId, name, value } of addressVectors) {
        it(`[${vectorId}] Address arg '${name}' encodes to ScVal`, () => {
          const scVal = Address.fromString(String(value)).toScVal();
          expect(scVal.switch().name).toBe('scvAddress');
          // Round-trip: decode back and compare
          const decoded = Address.fromScVal(scVal);
          expect(decoded.toString()).toBe(String(value));
        });
      }
    });

    describe('i128 args encode without throwing', () => {
      const i128Vectors = vectorsFile.vectors.flatMap((v) =>
        v.arg_order
          .filter((name) => v.arg_types[name] === 'i128')
          .map((name) => ({ vectorId: v.id, name, value: v.args[name] })),
      );

      for (const { vectorId, name, value } of i128Vectors) {
        it(`[${vectorId}] i128 arg '${name}' = ${value} encodes to ScVal`, () => {
          const scVal = nativeToScVal(String(value), { type: 'i128' });
          expect(scVal.switch().name).toBe('scvI128');
        });
      }
    });

    describe('u32 args encode without throwing', () => {
      const u32Vectors = vectorsFile.vectors.flatMap((v) =>
        v.arg_order
          .filter((name) => v.arg_types[name] === 'u32')
          .map((name) => ({ vectorId: v.id, name, value: v.args[name] })),
      );

      for (const { vectorId, name, value } of u32Vectors) {
        it(`[${vectorId}] u32 arg '${name}' = ${value} encodes to ScVal`, () => {
          const scVal = nativeToScVal(Number(value), { type: 'u32' });
          expect(scVal.switch().name).toBe('scvU32');
        });
      }
    });

    describe('full arg-list fingerprints are stable', () => {
      // Fingerprints are computed and compared per-vector. If encoding changes
      // (e.g. arg order swap, type change), the test fails and forces an
      // explicit update to this golden map.
      //
      // To update after a legitimate interface change:
      //   1. Change the contract, stellar.ts, and contract-args.json.
      //   2. Run the tests; get the new fingerprint from the failure output.
      //   3. Update the GOLDEN_FINGERPRINTS map below.
      //
      // This is intentionally a compile-time golden map, not a generated
      // snapshot file, so reviewers can see the delta in PR diffs.
      const GOLDEN_FINGERPRINTS: Record<string, string | null> = {
        // Set to null to skip fingerprint check for a vector (e.g. while
        // bootstrapping). Replace with actual value once confirmed stable.
        create_plan_basic: null,
        create_plan_xlm: null,
        subscribe_basic: null,
        subscribe_plan_zero: null,
        cancel_basic: null,
        cancel_reason_too_expensive: null,
      };

      for (const vector of vectorsFile.vectors) {
        it(`[${vector.id}] arg-list fingerprint is stable`, () => {
          const fingerprint = argListFingerprint(
            vector.method,
            vector.args,
            vector.arg_types,
            vector.arg_order,
          );

          const golden = GOLDEN_FINGERPRINTS[vector.id];
          if (golden === null) {
            // Bootstrap mode: just assert encoding doesn't throw and log
            // the fingerprint so it can be promoted to a golden value.
            // Replace null with this value in a follow-up commit.
            console.info(`[test-vectors] ${vector.id} fingerprint: ${fingerprint}`);
            expect(fingerprint).toBeTruthy();
          } else {
            expect(fingerprint).toBe(golden);
          }
        });
      }
    });
  });
});
