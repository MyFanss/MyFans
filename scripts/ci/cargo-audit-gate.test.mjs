import { test } from 'node:test';
import assert from 'node:assert/strict';

import { evaluateCargoAudit } from './cargo-audit-gate.mjs';

/**
 * Build a vulnerability entry shaped like `cargo audit --json` output.
 *
 * @param {{ id: string, title?: string, name?: string, version?: string }} opts
 */
function vuln({ id, title = 'test advisory', name = 'some-crate', version = '1.0.0' }) {
  return {
    advisory: { id, title },
    package: { name, version },
  };
}

/**
 * Build a minimal `cargo audit --json` report fixture.
 *
 * @param {{ vulnerabilities?: object[], warnings?: Record<string, object[]> }} opts
 */
function report({ vulnerabilities = [], warnings = {} } = {}) {
  return {
    vulnerabilities: { list: vulnerabilities },
    warnings,
  };
}

test('vulnerability not in ignore list is blocking', () => {
  const result = evaluateCargoAudit(
    report({ vulnerabilities: [vuln({ id: 'RUSTSEC-2024-0001' })] }),
    [],
  );

  assert.equal(result.blocking.length, 1);
  assert.equal(result.blocking[0].id, 'RUSTSEC-2024-0001');
  assert.equal(result.ignored.length, 0);
  assert.deepEqual(result.staleIgnores, []);
});

test('vulnerability matching an ignore id is ignored, not blocking', () => {
  const result = evaluateCargoAudit(
    report({ vulnerabilities: [vuln({ id: 'RUSTSEC-2024-0002' })] }),
    [{ id: 'RUSTSEC-2024-0002', issue: 'https://github.com/org/repo/issues/1' }],
  );

  assert.equal(result.blocking.length, 0);
  assert.equal(result.ignored.length, 1);
  assert.equal(result.ignored[0].id, 'RUSTSEC-2024-0002');
  assert.deepEqual(result.staleIgnores, []);
});

test('ignore entry with no matching vulnerability or warning is reported as stale', () => {
  const result = evaluateCargoAudit(
    report({ vulnerabilities: [vuln({ id: 'RUSTSEC-2024-0003' })] }),
    [
      { id: 'RUSTSEC-2024-0003', issue: 'https://github.com/org/repo/issues/1' },
      { id: 'RUSTSEC-2024-9999', issue: 'https://github.com/org/repo/issues/2' },
    ],
  );

  assert.equal(result.ignored.length, 1);
  assert.deepEqual(result.staleIgnores.map((e) => e.id), ['RUSTSEC-2024-9999']);
});

test('an ignore id that only matches a warning (not a vulnerability) is not stale', () => {
  const result = evaluateCargoAudit(
    report({
      warnings: {
        unmaintained: [{ advisory: { id: 'RUSTSEC-2024-0004' }, package: { name: 'old-crate', version: '0.1.0' } }],
      },
    }),
    [{ id: 'RUSTSEC-2024-0004', issue: 'https://github.com/org/repo/issues/3' }],
  );

  assert.equal(result.blocking.length, 0);
  assert.equal(result.warnings.length, 1);
  assert.equal(result.warnings[0].id, 'RUSTSEC-2024-0004');
  assert.deepEqual(result.staleIgnores, []);
});

test('throws when the report has no vulnerabilities section', () => {
  assert.throws(() => evaluateCargoAudit({}, []));
});

test('throws when report is null', () => {
  assert.throws(() => evaluateCargoAudit(null, []));
});
