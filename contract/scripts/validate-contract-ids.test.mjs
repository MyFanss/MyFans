// Tests for validate-contract-ids.mjs and test-deploy-output.sh (Issue #1848).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  contractsFromEnv,
  extractContracts,
  isContractStrkey,
  validateContracts,
} from './validate-contract-ids.mjs';

const SCRIPTS = fileURLToPath(new URL('.', import.meta.url));
const VALIDATOR = join(SCRIPTS, 'validate-contract-ids.mjs');
const WRAPPER = join(SCRIPTS, 'test-deploy-output.sh');

// Real, checksum-valid futurenet contract IDs from contract/deployed-local.json.
const IDS = {
  myfansToken: 'CC3KRIRFHMF5U2HEQBDDOL5OZUZ3SOJJIJE7EHFP3C6SJLONGJE4WNFF',
  creatorRegistry: 'CCBZ6F3E4LT25O633WFDXVAOTQT6IT25K5TBYFG4VMA4O7EDL6JXN67D',
  subscription: 'CDV2DF2BV3R7UM4LPETP77DAERE4DYX3FLC7HRVJV3KVHON7ZGLFLQ4U',
  contentAccess: 'CCQQRSVNHDUQAEXNUZ6IPCPW23RR52C5YQ2SLXVOSR3HZA3TRS6ZT7NC',
  earnings: 'CCK3EFATET2MILFOVS7MFHKKFHVQDD64WHSNHTUQUCK7QHV6UXWG57QT',
};
const ACCOUNT_KEY = 'GBF2SFW76UZVFXDTGDGAC2KERBJOSRUO7K45ZGGUA55BA6AZJN2PQXHR';

const dir = mkdtempSync(join(tmpdir(), 'contract-ids-'));
function fixture(name, doc) {
  const path = join(dir, name);
  writeFileSync(path, typeof doc === 'string' ? doc : JSON.stringify(doc, null, 2));
  return path;
}

function run(cmd, args, env = {}) {
  const res = spawnSync(cmd, args, {
    encoding: 'utf8',
    env: { PATH: process.env.PATH, HOME: process.env.HOME, ...env },
  });
  return { code: res.status, out: res.stdout + res.stderr };
}

// ── strkey ──────────────────────────────────────────────────────────────────

test('isContractStrkey accepts real contract IDs', () => {
  for (const id of Object.values(IDS)) assert.equal(isContractStrkey(id), true, id);
});

test('isContractStrkey rejects account keys, bad checksums and junk', () => {
  assert.equal(isContractStrkey(ACCOUNT_KEY), false);
  const flipped = IDS.earnings.slice(0, -1) + (IDS.earnings.endsWith('T') ? 'U' : 'T');
  assert.equal(isContractStrkey(flipped), false);
  assert.equal(isContractStrkey(IDS.earnings.toLowerCase()), false);
  assert.equal(isContractStrkey(IDS.earnings.slice(1)), false);
  assert.equal(isContractStrkey(''), false);
  assert.equal(isContractStrkey(null), false);
});

// ── validateContracts ───────────────────────────────────────────────────────

test('complete canonical map is valid', () => {
  const r = validateContracts({ ...IDS });
  assert.equal(r.valid, true);
  assert.deepEqual(r.results.map((x) => x.status), ['ok', 'ok', 'ok', 'ok', 'ok']);
});

test('deploy-output aliases (token, subscriptions) are accepted', () => {
  const { myfansToken, subscription, ...rest } = IDS;
  const r = validateContracts({ token: myfansToken, subscriptions: subscription, ...rest });
  assert.equal(r.valid, true);
});

test('all-empty IDs fail and every key is reported', () => {
  const r = validateContracts(Object.fromEntries(Object.keys(IDS).map((k) => [k, ''])));
  assert.equal(r.valid, false);
  assert.equal(r.errors.length, 5);
  assert.ok(r.errors.every((e) => e.endsWith(': empty')));
});

test('partial IDs fail and name exactly the missing / empty ones', () => {
  const r = validateContracts({ myfansToken: IDS.myfansToken, subscription: '  ', earnings: IDS.earnings });
  assert.equal(r.valid, false);
  assert.deepEqual(r.errors.sort(), ['contentAccess: missing', 'creatorRegistry: missing', 'subscription: empty']);
});

test('malformed and duplicate IDs fail', () => {
  const r = validateContracts({ ...IDS, earnings: ACCOUNT_KEY, contentAccess: IDS.myfansToken });
  assert.equal(r.valid, false);
  assert.ok(r.errors.includes('earnings: malformed'));
  assert.ok(r.errors.some((e) => e.startsWith('contentAccess: same contract ID as')));
});

test('extra placeholder entries (e.g. treasury) fail too', () => {
  const r = validateContracts({ ...IDS, treasury: '' });
  assert.deepEqual(r.errors, ['treasury: empty']);
});

test('network must match when expected', () => {
  assert.equal(validateContracts(IDS, { network: 'testnet', expectedNetwork: 'testnet' }).valid, true);
  assert.match(validateContracts(IDS, { network: 'mainnet', expectedNetwork: 'testnet' }).errors[0], /does not match/);
  assert.match(validateContracts(IDS, { network: null, expectedNetwork: 'testnet' }).errors[0], /network: missing/);
});

test('schemaVersion is checked when present or required', () => {
  assert.deepEqual(validateContracts(IDS, { schemaVersion: '' }).errors, ['schemaVersion: empty']);
  assert.deepEqual(validateContracts(IDS, { requireSchemaVersion: true }).errors, ['schemaVersion: missing']);
  assert.equal(validateContracts(IDS, { schemaVersion: '1.0.0', requireSchemaVersion: true }).valid, true);
});

test('a missing contracts object fails', () => {
  assert.equal(extractContracts({ myfans: '' }), null);
  assert.equal(extractContracts([]), null);
  assert.equal(validateContracts(null).valid, false);
});

test('contractsFromEnv maps the CI secret names', () => {
  const map = contractsFromEnv({ CONTRACT_ID_MYFANS_TOKEN: IDS.myfansToken, CONTRACT_ID_EARNINGS: '' });
  assert.equal(map.myfansToken, IDS.myfansToken);
  assert.equal(map.earnings, '');
  assert.equal(map.subscription, '');
});

// ── CLI ─────────────────────────────────────────────────────────────────────

test('CLI --env fails on missing secrets and never prints ID values', () => {
  const env = { CONTRACT_ID_MYFANS_TOKEN: IDS.myfansToken, CONTRACT_ID_EARNINGS: IDS.earnings };
  const res = run('node', [VALIDATOR, '--env'], env);
  assert.equal(res.code, 1);
  assert.match(res.out, /subscription: missing|subscription: empty/);
  assert.ok(!res.out.includes(IDS.myfansToken), 'ID value leaked into output');
});

test('CLI --allow-missing downgrades to warnings and writes a report', () => {
  const report = join(dir, 'report.json');
  const res = run('node', [VALIDATOR, '--env', '--allow-missing', `--report=${report}`]);
  assert.equal(res.code, 0);
  assert.match(res.out, /WARNING/);
  const json = JSON.parse(readFileSync(report, 'utf8'));
  assert.equal(json.valid, false);
  assert.equal(json.results.length, 5);
});

test('CLI --env passes with all secrets set', () => {
  const env = {
    CONTRACT_ID_MYFANS_TOKEN: IDS.myfansToken,
    CONTRACT_ID_CREATOR_REGISTRY: IDS.creatorRegistry,
    CONTRACT_ID_SUBSCRIPTION: IDS.subscription,
    CONTRACT_ID_CONTENT_ACCESS: IDS.contentAccess,
    CONTRACT_ID_EARNINGS: IDS.earnings,
  };
  assert.equal(run('node', [VALIDATOR, '--env'], env).code, 0);
});

test('CLI usage errors exit 2', () => {
  assert.equal(run('node', [VALIDATOR]).code, 2);
  assert.equal(run('node', [VALIDATOR, '--file=/nonexistent.json']).code, 2);
  assert.equal(run('node', [VALIDATOR, '--bogus']).code, 2);
});

// ── test-deploy-output.sh cases ─────────────────────────────────────────────

const deployOutput = {
  schemaVersion: '1.0.0',
  network: 'testnet',
  contracts: {
    token: IDS.myfansToken,
    creatorRegistry: IDS.creatorRegistry,
    subscriptions: IDS.subscription,
    contentAccess: IDS.contentAccess,
    earnings: IDS.earnings,
  },
};

test('test-deploy-output: valid pretty-printed deploy output passes', () => {
  const res = run('bash', [WRAPPER, fixture('deployed.json', deployOutput), '--require-schema-version']);
  assert.equal(res.code, 0, res.out);
});

test('test-deploy-output: canonical contract-ids.json with matching network passes', () => {
  const file = fixture('contract-ids.json', { network: 'testnet', contracts: { ...IDS } });
  assert.equal(run('bash', [WRAPPER, file], { EXPECTED_NETWORK: 'testnet' }).code, 0);
});

test('test-deploy-output: legacy single-line contractIds key still works', () => {
  const file = fixture('legacy.json', JSON.stringify({ schemaVersion: '1', contractIds: { ...IDS } }));
  assert.equal(run('bash', [WRAPPER, file]).code, 0);
});

test('test-deploy-output: committed placeholder contract-ids.json fails closed', () => {
  const res = run('bash', [WRAPPER, join(SCRIPTS, '..', 'contract-ids.json')]);
  assert.equal(res.code, 1);
  assert.match(res.out, /myfansToken: empty/);
});

test('test-deploy-output: partial IDs fail', () => {
  const file = fixture('partial.json', { ...deployOutput, contracts: { ...deployOutput.contracts, earnings: '' } });
  const res = run('bash', [WRAPPER, file]);
  assert.equal(res.code, 1);
  assert.match(res.out, /earnings: empty/);
});

test('test-deploy-output: network mismatch fails', () => {
  const res = run('bash', [WRAPPER, fixture('net.json', deployOutput)], { EXPECTED_NETWORK: 'mainnet' });
  assert.equal(res.code, 1);
  assert.match(res.out, /does not match expected "mainnet"/);
});

test('test-deploy-output: missing schemaVersion fails only when required', () => {
  const { schemaVersion, ...noSchema } = deployOutput;
  void schemaVersion;
  const file = fixture('noschema.json', noSchema);
  assert.equal(run('bash', [WRAPPER, file]).code, 0);
  assert.equal(run('bash', [WRAPPER, file, '--require-schema-version']).code, 1);
});

test('test-deploy-output: missing file and invalid JSON fail', () => {
  assert.equal(run('bash', [WRAPPER, join(dir, 'nope.json')]).code, 1);
  assert.notEqual(run('bash', [WRAPPER, fixture('bad.json', '{ not json')]).code, 0);
});

test('test-deploy-output: SKIP_CONTRACT_ID_CHECK=1 skips explicitly', () => {
  const file = fixture('empty.json', { contracts: {} });
  const res = run('bash', [WRAPPER, file], { SKIP_CONTRACT_ID_CHECK: '1' });
  assert.equal(res.code, 0);
  assert.match(res.out, /skipping contract ID validation/);
});
