import { test } from 'node:test';
import assert from 'node:assert/strict';

import { evaluateNpmAudit } from './npm-audit-gate.mjs';

/**
 * Build a minimal `npm audit --json` report fixture.
 *
 * @param {Record<string, { severity: string, via: Array<object|string> }>} vulnerabilities
 * @returns {{ vulnerabilities: Record<string, unknown> }}
 */
function report(vulnerabilities) {
  return { vulnerabilities };
}

/**
 * Build a `via` advisory object shaped like npm's output.
 *
 * @param {{ source?: number, url?: string, severity?: string, title?: string }} advisory
 */
function via(advisory) {
  return {
    source: advisory.source ?? 1,
    url: advisory.url,
    severity: advisory.severity ?? 'high',
    title: advisory.title ?? 'test advisory',
  };
}

test('advisories at or above the level are blocking, below are counted', () => {
  const result = evaluateNpmAudit(
    report({
      'pkg-high': {
        severity: 'high',
        via: [via({ source: 1001, url: 'https://github.com/advisories/GHSA-aaaa-bbbb-cccc' })],
      },
      'pkg-moderate': {
        severity: 'moderate',
        via: [via({ source: 1002, url: 'https://github.com/advisories/GHSA-dddd-eeee-ffff', severity: 'moderate' })],
      },
    }),
    [],
    'high',
  );

  assert.equal(result.blocking.length, 1);
  assert.equal(result.blocking[0].id, 'GHSA-aaaa-bbbb-cccc');
  assert.equal(result.belowThreshold.length, 1);
  assert.equal(result.belowThreshold[0].id, 'GHSA-dddd-eeee-ffff');
  assert.equal(result.ignored.length, 0);
  assert.deepEqual(result.staleIgnores, []);
});

test('advisory matching an ignore id is ignored, not blocking', () => {
  const result = evaluateNpmAudit(
    report({
      'pkg-high': {
        severity: 'high',
        via: [via({ source: 2001, url: 'https://github.com/advisories/GHSA-1111-2222-3333' })],
      },
    }),
    ['GHSA-1111-2222-3333'],
    'high',
  );

  assert.equal(result.blocking.length, 0);
  assert.equal(result.ignored.length, 1);
  assert.equal(result.ignored[0].id, 'GHSA-1111-2222-3333');
  assert.deepEqual(result.staleIgnores, []);
});

test('ignore entry with no matching advisory is reported as stale', () => {
  const result = evaluateNpmAudit(
    report({
      'pkg-high': {
        severity: 'high',
        via: [via({ source: 3001, url: 'https://github.com/advisories/GHSA-4444-5555-6666' })],
      },
    }),
    ['GHSA-4444-5555-6666', 'GHSA-9999-8888-7777'],
    'high',
  );

  assert.equal(result.ignored.length, 1);
  assert.deepEqual(result.staleIgnores, ['GHSA-9999-8888-7777']);
});

test('plain string via entries (transitive pointers) are skipped', () => {
  const result = evaluateNpmAudit(
    report({
      'pkg-transitive': {
        severity: 'high',
        via: ['pkg-high'],
      },
    }),
    [],
    'high',
  );

  assert.equal(result.blocking.length, 0);
  assert.equal(result.belowThreshold.length, 0);
  assert.equal(result.ignored.length, 0);
});

test('via object without a GHSA url falls back to NPM-<source>', () => {
  const result = evaluateNpmAudit(
    report({
      'pkg-high': {
        severity: 'high',
        via: [via({ source: 4242, url: 'https://npmjs.com/advisories/4242' })],
      },
    }),
    ['NPM-4242'],
    'high',
  );

  assert.equal(result.blocking.length, 0);
  assert.equal(result.ignored.length, 1);
  assert.equal(result.ignored[0].id, 'NPM-4242');
});

test('throws when the report has no vulnerabilities key', () => {
  assert.throws(() => evaluateNpmAudit({}, [], 'high'));
});

test('throws when the report contains an error field', () => {
  assert.throws(() =>
    evaluateNpmAudit({ error: { code: 'ENOAUDIT', summary: 'audit failed' } }, [], 'high'),
  );
});

test('throws for an unknown audit level', () => {
  assert.throws(() => evaluateNpmAudit(report({}), [], 'catastrophic'));
});
