import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAuditIgnore } from './auditignore.mjs';
import { evaluateNpmAudit } from './npm-audit-gate.mjs';
import { evaluateCargoAudit } from './cargo-audit-gate.mjs';

const ISSUE = 'https://github.com/MyFanss/MyFans/issues/1847';
const TODAY = new Date('2026-09-27T00:00:00Z');

test('auditignore: accepts GHSA, RUSTSEC and NPM ids with an issue link', () => {
  const { entries, errors } = parseAuditIgnore(
    [
      '# comment',
      '',
      `GHSA-abcd-efgh-ijkl: dev-only path ${ISSUE}`,
      `RUSTSEC-2024-0001: wasm target unaffected ${ISSUE} expires 2027-01-01`,
      `NPM-1234: legacy id ${ISSUE}  # trailing comment`,
    ].join('\n'),
    { today: TODAY },
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(
    entries.map((e) => [e.id, e.expires]),
    [
      ['GHSA-ABCD-EFGH-IJKL', null],
      ['RUSTSEC-2024-0001', '2027-01-01'],
      ['NPM-1234', null],
    ],
  );
});

test('auditignore: rejects entries without an issue link', () => {
  const { entries, errors } = parseAuditIgnore('GHSA-abcd-efgh-ijkl: trust me', { today: TODAY });
  assert.equal(entries.length, 0);
  assert.match(errors[0], /no tracking issue link/);
});

test('auditignore: rejects expired, duplicate, malformed and unknown ids', () => {
  const { entries, errors } = parseAuditIgnore(
    [
      `RUSTSEC-2020-0001: old ${ISSUE} expires 2026-01-01`,
      `NPM-1: ok ${ISSUE}`,
      `NPM-1: again ${ISSUE}`,
      'no separator here',
      `CVE-2024-1234: wrong id type ${ISSUE}`,
    ].join('\n'),
    { today: TODAY },
  );
  assert.equal(entries.length, 1);
  assert.equal(errors.length, 4);
  assert.match(errors[0], /expired/);
  assert.match(errors[1], /duplicate/);
  assert.match(errors[2], /expected/);
  assert.match(errors[3], /not a GHSA/);
});

test('auditignore: the committed .auditignore files are valid', async () => {
  const { loadAuditIgnore } = await import('./auditignore.mjs');
  for (const pkg of ['backend', 'frontend', 'contract']) {
    const url = new URL(`../../${pkg}/.auditignore`, import.meta.url);
    const { errors } = loadAuditIgnore(url.pathname);
    assert.deepEqual(errors, [], `${pkg}/.auditignore`);
  }
});

function npmReport(vulns) {
  return { auditReportVersion: 2, vulnerabilities: vulns, metadata: {} };
}

test('npm gate: blocks high/critical, ignores listed, skips moderate', () => {
  const report = npmReport({
    axios: {
      severity: 'high',
      via: [
        { source: 1, url: 'https://github.com/advisories/GHSA-aaaa-bbbb-cccc', severity: 'high', title: 'SSRF' },
        { source: 2, url: 'https://github.com/advisories/GHSA-dddd-eeee-ffff', severity: 'moderate', title: 'x' },
      ],
    },
    // transitive pointer: must not double count
    '@stellar/stellar-sdk': { severity: 'high', via: ['axios'] },
    toml: {
      severity: 'critical',
      via: [{ source: 3, url: 'https://github.com/advisories/GHSA-1111-2222-3333', severity: 'critical', title: 'pp' }],
    },
  });
  const result = evaluateNpmAudit(report, [{ id: 'GHSA-1111-2222-3333' }, { id: 'GHSA-zzzz-zzzz-zzzz' }], 'high');
  assert.deepEqual(result.blocking.map((a) => a.id), ['GHSA-AAAA-BBBB-CCCC']);
  assert.deepEqual(result.ignored.map((a) => a.id), ['GHSA-1111-2222-3333']);
  assert.deepEqual(result.staleIgnores.map((e) => e.id), ['GHSA-zzzz-zzzz-zzzz']);
  assert.equal(result.belowThreshold, 1);
});

test('npm gate: falls back to NPM-<source> ids when no GHSA url is present', () => {
  const report = npmReport({ foo: { severity: 'high', via: [{ source: 99, severity: 'high', title: 't' }] } });
  assert.deepEqual(evaluateNpmAudit(report, [{ id: 'NPM-99' }]).blocking, []);
});

test('npm gate: fails closed on npm errors and malformed reports', () => {
  assert.throws(() => evaluateNpmAudit({ error: { code: 'ENOLOCK', summary: 'no lockfile' } }, []), /no lockfile/);
  assert.throws(() => evaluateNpmAudit({}, []), /no "vulnerabilities"/);
  assert.throws(() => evaluateNpmAudit(null, []), /no JSON/);
  assert.throws(() => evaluateNpmAudit(npmReport({}), [], 'bogus'), /unknown audit level/);
});

test('npm gate: a clean report passes', () => {
  const result = evaluateNpmAudit(npmReport({}), []);
  assert.equal(result.blocking.length, 0);
});

test('cargo gate: blocks vulnerabilities, ignores listed, reports warnings only', () => {
  const report = {
    vulnerabilities: {
      found: true,
      count: 2,
      list: [
        { advisory: { id: 'RUSTSEC-2024-0001', title: 'bad' }, package: { name: 'a', version: '1.0.0' } },
        { advisory: { id: 'RUSTSEC-2024-0002', title: 'known' }, package: { name: 'b', version: '2.0.0' } },
      ],
    },
    warnings: {
      unmaintained: [{ advisory: { id: 'RUSTSEC-2024-0436' }, package: { name: 'paste', version: '1.0.15' } }],
      yanked: [{ advisory: null, package: { name: 'c', version: '0.1.0' } }],
    },
  };
  const result = evaluateCargoAudit(report, [{ id: 'RUSTSEC-2024-0002' }, { id: 'RUSTSEC-2099-0001' }]);
  assert.deepEqual(result.blocking.map((f) => f.id), ['RUSTSEC-2024-0001']);
  assert.deepEqual(result.ignored.map((f) => f.id), ['RUSTSEC-2024-0002']);
  assert.equal(result.warnings.length, 2);
  assert.deepEqual(result.staleIgnores.map((e) => e.id), ['RUSTSEC-2099-0001']);
});

test('cargo gate: fails closed on malformed reports', () => {
  assert.throws(() => evaluateCargoAudit({}, []), /no "vulnerabilities"/);
});
