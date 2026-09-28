#!/usr/bin/env node
// Contract ID validator (Issue #1848).
//
// Fails closed when any required contract ID is missing, empty, or not a
// well-formed Soroban contract strkey (C…, 56 chars, valid CRC16 checksum).
// Used by release smoke (.github/workflows/futurenet-smoke.yml) and by
// scripts/test-deploy-output.sh for deploy output / contract-ids.json.
//
// ID values are never printed — only key names and statuses — so the output
// is safe to keep in CI logs and artifacts.
//
// Usage:
//   node validate-contract-ids.mjs --file=contract/contract-ids.json [--network=testnet]
//   node validate-contract-ids.mjs --env [--network=futurenet]
//   Options:
//     --report=PATH             write a JSON report (for CI artifacts)
//     --allow-missing           report problems as warnings and exit 0 (non-release branches)
//     --require-schema-version  fail if the file has no schemaVersion (deploy output)
//
// Exit codes: 0 valid (or --allow-missing), 1 invalid IDs, 2 usage / unreadable input.

import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/** Canonical key → accepted aliases in deploy output, and the env var used by CI secrets. */
export const REQUIRED_CONTRACTS = {
  myfansToken: { aliases: ['token'], env: 'CONTRACT_ID_MYFANS_TOKEN' },
  creatorRegistry: { aliases: [], env: 'CONTRACT_ID_CREATOR_REGISTRY' },
  subscription: { aliases: ['subscriptions'], env: 'CONTRACT_ID_SUBSCRIPTION' },
  contentAccess: { aliases: [], env: 'CONTRACT_ID_CONTENT_ACCESS' },
  earnings: { aliases: [], env: 'CONTRACT_ID_EARNINGS' },
};

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const CONTRACT_VERSION_BYTE = 2 << 3; // 'C'

function base32Decode(input) {
  let bits = 0;
  let value = 0;
  const out = [];
  for (const ch of input) {
    const idx = BASE32.indexOf(ch);
    if (idx === -1) return null;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Uint8Array.from(out);
}

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

/** True when `id` is a checksum-valid Soroban contract strkey. */
export function isContractStrkey(id) {
  if (typeof id !== 'string' || !/^C[A-Z2-7]{55}$/.test(id)) return false;
  const raw = base32Decode(id);
  if (!raw || raw.length !== 35 || raw[0] !== CONTRACT_VERSION_BYTE) return false;
  const expected = crc16xmodem(raw.subarray(0, 33));
  const actual = raw[33] | (raw[34] << 8);
  return expected === actual;
}

/** Extracts the contract map from a parsed deploy output or contract-ids.json. */
export function extractContracts(doc) {
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return null;
  const map = doc.contracts ?? doc.contractIds;
  if (!map || typeof map !== 'object' || Array.isArray(map)) return null;
  return map;
}

/** Builds a contract map from CI environment variables (secrets). */
export function contractsFromEnv(env) {
  const map = {};
  for (const [key, spec] of Object.entries(REQUIRED_CONTRACTS)) {
    map[key] = env[spec.env] ?? '';
  }
  return map;
}

/**
 * @param {Record<string, unknown> | null} contracts
 * @param {{ network?: string | null, expectedNetwork?: string | null, schemaVersion?: unknown, requireSchemaVersion?: boolean }} [meta]
 */
export function validateContracts(contracts, meta = {}) {
  const errors = [];
  const results = [];

  if (!contracts) {
    return { valid: false, results, errors: ['no "contracts" (or "contractIds") object found'] };
  }

  const consumed = new Set();
  const seenIds = new Map();

  const check = (key, value) => {
    let status;
    if (value === undefined || value === null) status = 'missing';
    else if (typeof value !== 'string' || value.trim() === '') status = 'empty';
    else if (!isContractStrkey(value.trim())) status = 'malformed';
    else status = 'ok';

    if (status === 'ok') {
      const id = value.trim();
      const dup = seenIds.get(id);
      if (dup) {
        status = 'duplicate';
        errors.push(`${key}: same contract ID as ${dup}`);
      } else {
        seenIds.set(id, key);
      }
    } else {
      errors.push(`${key}: ${status}`);
    }
    results.push({ key, status });
  };

  for (const [key, spec] of Object.entries(REQUIRED_CONTRACTS)) {
    const source = [key, ...spec.aliases].find((k) => Object.hasOwn(contracts, k));
    if (source) consumed.add(source);
    check(key, source ? contracts[source] : undefined);
  }

  // Any extra entries (e.g. treasury) must not be placeholders either.
  for (const key of Object.keys(contracts)) {
    if (!consumed.has(key)) check(key, contracts[key]);
  }

  if (meta.expectedNetwork) {
    if (!meta.network) {
      errors.push(`network: missing (expected "${meta.expectedNetwork}")`);
    } else if (meta.network !== meta.expectedNetwork) {
      errors.push(`network: "${meta.network}" does not match expected "${meta.expectedNetwork}"`);
    }
  }

  if (meta.schemaVersion !== undefined) {
    if (typeof meta.schemaVersion !== 'string' || meta.schemaVersion.trim() === '') {
      errors.push('schemaVersion: empty');
    }
  } else if (meta.requireSchemaVersion) {
    errors.push('schemaVersion: missing');
  }

  return { valid: errors.length === 0, results, errors };
}

function parseArgs(argv) {
  const args = { file: null, env: false, network: null, report: null, allowMissing: false, requireSchemaVersion: false };
  for (const arg of argv) {
    const [key, value] = arg.split('=', 2);
    switch (key) {
      case '--file': args.file = value; break;
      case '--env': args.env = true; break;
      case '--network': args.network = value || null; break;
      case '--report': args.report = value; break;
      case '--allow-missing': args.allowMissing = true; break;
      case '--require-schema-version': args.requireSchemaVersion = true; break;
      default: throw new UsageError(`unknown argument: ${arg}`);
    }
  }
  if (Boolean(args.file) === args.env) throw new UsageError('pass exactly one of --file=PATH or --env');
  return args;
}

class UsageError extends Error {}

function emit(level, message) {
  if (process.env.GITHUB_ACTIONS === 'true') console.log(`::${level}::${message}`);
  else (level === 'error' ? console.error : console.log)(`${level.toUpperCase()}: ${message}`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const expectedNetwork = args.network ?? process.env.EXPECTED_NETWORK ?? null;

  let contracts;
  let meta = { expectedNetwork, requireSchemaVersion: args.requireSchemaVersion };
  let source;

  if (args.env) {
    source = 'environment';
    contracts = contractsFromEnv(process.env);
    // Network is supplied by the workflow, not by secrets; nothing to cross-check.
    meta = { ...meta, expectedNetwork: null };
  } else {
    source = args.file;
    let doc;
    try {
      doc = JSON.parse(readFileSync(args.file, 'utf8'));
    } catch (err) {
      throw new UsageError(`cannot read ${args.file}: ${err.message}`);
    }
    contracts = extractContracts(doc);
    meta = { ...meta, network: doc?.network ?? null, schemaVersion: doc?.schemaVersion };
  }

  const result = validateContracts(contracts, meta);

  console.log(`Validating contract IDs from ${source}${expectedNetwork ? ` (network: ${expectedNetwork})` : ''}`);
  for (const r of result.results) console.log(`  ${r.status === 'ok' ? '✓' : '✗'} ${r.key}: ${r.status}`);

  if (args.report) {
    writeFileSync(
      args.report,
      JSON.stringify({ source, expectedNetwork, valid: result.valid, results: result.results, errors: result.errors }, null, 2) + '\n',
    );
  }

  if (result.valid) {
    console.log('All contract IDs present and well-formed.');
    return 0;
  }

  const level = args.allowMissing ? 'warning' : 'error';
  for (const e of result.errors) emit(level, `contract IDs: ${e}`);
  return args.allowMissing ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.exit(main());
  } catch (err) {
    emit('error', err.message);
    process.exit(err instanceof UsageError ? 2 : 1);
  }
}
