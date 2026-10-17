import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  REQUIRED_CONTRACTS,
  isContractStrkey,
  extractContracts,
  contractsFromEnv,
  validateContracts,
} from './validate-contract-ids.mjs';

// A checksum-valid Soroban contract strkey (C…, 56 chars).
const VALID_ID = 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM';
const OTHER_VALID_ID = 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4';

// Build a valid strkey from a 32-byte payload so fixtures stay checksum-correct.
const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function crc16xmodem(bytes) {
  let crc = 0;
  for (const b of bytes) {
    crc ^= b << 8;
    for (let i = 0; i < 8; i++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc;
}
function base32Encode(bytes) {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out;
}
function makeStrkey(seed) {
  const payload = new Uint8Array(32);
  payload[0] = seed;
  const versioned = new Uint8Array(33);
  versioned[0] = 2 << 3; // 'C'
  versioned.set(payload, 1);
  const crc = crc16xmodem(versioned);
  const full = new Uint8Array(35);
  full.set(versioned, 0);
  full[33] = crc & 0xff;
  full[34] = (crc >> 8) & 0xff;
  return base32Encode(full);
}

const ID_A = makeStrkey(1);
const ID_B = makeStrkey(2);

function validMap(overrides = {}) {
  const map = {};
  for (const key of Object.keys(REQUIRED_CONTRACTS)) map[key] = ID_A;
  return { ...map, ...overrides };
}

test('fixtures are checksum-valid strkeys', () => {
  assert.equal(isContractStrkey(ID_A), true);
  assert.equal(isContractStrkey(ID_B), true);
  assert.equal(isContractStrkey(VALID_ID), true);
  assert.equal(isContractStrkey(OTHER_VALID_ID), true);
});

test('two keys sharing one valid strkey are flagged as duplicate', () => {
  const contracts = validMap();
  // Give every key a distinct ID, then force a collision between two keys.
  let i = 3;
  for (const key of Object.keys(REQUIRED_CONTRACTS)) contracts[key] = makeStrkey(i++);
  contracts.creatorRegistry = contracts.myfansToken;

  const result = validateContracts(contracts);

  assert.equal(result.valid, false);
  const dup = result.results.find((r) => r.status === 'duplicate');
  assert.ok(dup, 'expected a duplicate status in results');
  assert.equal(dup.key, 'creatorRegistry');
  const message = result.errors.find((e) => e.includes('same contract ID'));
  assert.ok(message, 'expected an error mentioning the duplicate');
  assert.ok(message.includes('creatorRegistry'), 'error should name the duplicate key');
  assert.ok(message.includes('myfansToken'), 'error should name the original key');
});

test('token and subscriptions aliases resolve to ok', () => {
  const contracts = {
    token: ID_A,
    creatorRegistry: ID_B,
    subscriptions: makeStrkey(4),
    contentAccess: makeStrkey(5),
    earnings: makeStrkey(6),
  };

  const result = validateContracts(contracts);

  assert.equal(result.valid, true, JSON.stringify(result.errors));
  const token = result.results.find((r) => r.key === 'myfansToken');
  const subs = result.results.find((r) => r.key === 'subscription');
  assert.equal(token?.status, 'ok');
  assert.equal(subs?.status, 'ok');
});

test('extractContracts returns null for non-contract documents', () => {
  assert.equal(extractContracts([ID_A]), null);
  assert.equal(extractContracts('not-an-object'), null);
  assert.equal(extractContracts({ network: 'testnet' }), null);
  assert.equal(extractContracts(null), null);
});

test('extractContracts reads contracts and contractIds maps', () => {
  assert.deepEqual(extractContracts({ contracts: { a: ID_A } }), { a: ID_A });
  assert.deepEqual(extractContracts({ contractIds: { a: ID_A } }), { a: ID_A });
});

test('contractsFromEnv maps each CONTRACT_ID_* var to its canonical key', () => {
  const env = {};
  let i = 7;
  for (const spec of Object.values(REQUIRED_CONTRACTS)) env[spec.env] = makeStrkey(i++);

  const map = contractsFromEnv(env);

  for (const [key, spec] of Object.entries(REQUIRED_CONTRACTS)) {
    assert.equal(map[key], env[spec.env]);
  }
});

test('contractsFromEnv yields empty string when unset', () => {
  const map = contractsFromEnv({});
  for (const key of Object.keys(REQUIRED_CONTRACTS)) {
    assert.equal(map[key], '');
  }
});
